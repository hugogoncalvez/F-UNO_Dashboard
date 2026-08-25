import type { DriverProfile } from "./types";
import { getDrivers } from "./openf1";
import { getDriverStandings, getSeasonConstructors, getSeasonDrivers } from "./jolpica";
import { teamColor } from "./utils";

const WIKI_FALLBACK: Record<string, { lang: string; title: string }> = {
  arvid_lindblad: { lang: "es", title: "Arvid Lindblad" },
  antonelli: { lang: "en", title: "Kimi Antonelli" },
  colapinto: { lang: "es", title: "Franco Colapinto" },
  bearman: { lang: "es", title: "Oliver Bearman" },
};

const placeholderCache = new Map<string, boolean>();
const wikiImageCache = new Map<string, string | null>();

async function isPlaceholder(url: string): Promise<boolean> {
  const cached = placeholderCache.get(url);
  if (cached !== undefined) return cached;
  let result = false;
  try {
    const res = await fetch(url, { method: "HEAD" });
    const len = Number(res.headers.get("content-length") ?? 0);
    result = len > 0 && len < 10_000;
  } catch {
    result = false;
  }
  placeholderCache.set(url, result);
  return result;
}

async function wikiImage(lang: string, title: string): Promise<string | null> {
  const key = `${lang}/${title}`;
  if (wikiImageCache.has(key)) return wikiImageCache.get(key) ?? null;
  let result: string | null = null;
  try {
    const api = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      title,
    )}&prop=pageimages&format=json&pithumbsize=432&origin=*`;
    const res = await fetch(api);
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
    };
    const page = Object.values(data.query?.pages ?? {})[0];
    const src = page?.thumbnail?.source;
    if (src) result = src.split("?")[0];
  } catch {
    result = null;
  }
  wikiImageCache.set(key, result);
  return result;
}

async function resolveHeadshot(
  slug: string,
  openf1Url: string | null,
): Promise<string | null> {
  if (openf1Url) {
    const ph = await isPlaceholder(openf1Url);
    if (!ph) return openf1Url;
  }
  const fb = WIKI_FALLBACK[slug];
  if (fb) return wikiImage(fb.lang, fb.title);
  return openf1Url;
}

function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export async function getDriverProfiles(): Promise<DriverProfile[]> {
  const [openf1Drivers, seasonDrivers, constructors, standings] = await Promise.all([
    getDrivers(),
    getSeasonDrivers(),
    getSeasonConstructors(),
    getDriverStandings(),
  ]);

  const openf1ByCode = new Map(openf1Drivers.map((d) => [d.name_acronym, d]));
  const teamNationality = new Map(constructors.map((c) => [c.name, c.nationality]));
  const standingByCode = new Map(standings.map((s) => [s.code, s]));

  const headshots = await Promise.all(
    seasonDrivers.map((j) => resolveHeadshot(j.driverId, openf1ByCode.get(j.code)?.headshot_url ?? null)),
  );
  const headshotByDriverId = new Map(seasonDrivers.map((j, i) => [j.driverId, headshots[i]]));

  return seasonDrivers
    .map((j) => {
      const o = openf1ByCode.get(j.code);
      const standing = standingByCode.get(j.code);
      const team = o?.team_name ?? standing?.constructor ?? "";
      return {
        slug: j.driverId,
        driverNumber: o?.driver_number ?? (Number(j.permanentNumber) || 0),
        code: j.code,
        fullName: `${j.givenName} ${j.familyName}`,
        team,
        teamColour: o?.team_colour ?? teamColor(team),
        headshotUrl: headshotByDriverId.get(j.driverId) ?? null,
        nationality: j.nationality,
        dateOfBirth: j.dateOfBirth,
        age: computeAge(j.dateOfBirth),
        wikiUrl: j.url,
        teamNationality: team ? (teamNationality.get(team) ?? null) : null,
        championship: standing
          ? {
              position: standing.position,
              points: Number(standing.points),
              wins: Number(standing.wins),
            }
          : null,
      } satisfies DriverProfile;
    })
    .filter((d) => d.team !== "")
    .sort((a, b) => (a.championship?.position ?? 99) - (b.championship?.position ?? 99));
}

export async function getDriverProfile(slug: string): Promise<DriverProfile | null> {
  const profiles = await getDriverProfiles();
  return profiles.find((d) => d.slug === slug) ?? null;
}
