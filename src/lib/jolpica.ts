import type {
  JConstructorStanding,
  JDriverStanding,
  JPitStop,
  JQualifyingResult,
  JRaceResult,
  JSeasonDriver,
  Race,
} from "./types";
import { cachedGetJson } from "./fetch";
import { getCircuitMeta, getCircuitPath } from "./circuits";

const BASE = "https://api.jolpi.ca/ergast/f1";

interface MrData<T> {
  MRData: {
    StandingsTable?: {
      StandingsLists: {
        DriverStandings?: DriverStandingRaw[];
        ConstructorStandings?: ConstructorStandingRaw[];
      }[];
    };
    RaceTable?: { Races: RaceRaw[] };
    DriverTable?: { Drivers: DriverRaw[] };
    ConstructorTable?: { Constructors: ConstructorRaw[] };
  } & T;
}

interface DriverRaw {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  givenName: string;
  familyName: string;
  dateOfBirth?: string;
  nationality: string;
  url?: string;
}

interface ConstructorRaw {
  name: string;
  nationality: string;
}

interface DriverStandingRaw {
  position: string;
  points: string;
  wins: string;
  Driver: { code: string; givenName: string; familyName: string };
  Constructors: { name: string }[];
}

interface ConstructorStandingRaw {
  position: string;
  points: string;
  wins: string;
  Constructor: { name: string };
}

interface RaceRaw {
  round: string;
  raceName: string;
  date: string;
  time: string;
  Circuit: { circuitName: string; url?: string; Location: { locality: string; country: string } };
  Sprint?: unknown;
  Results?: JRaceResult[];
  QualifyingResults?: JQualifyingResult[];
  PitStops?: JPitStop[];
}

async function get<T>(path: string): Promise<T | null> {
  return cachedGetJson<T>(`${BASE}/${path}`, { ttlMs: 5 * 60_000 });
}

export async function getDriverStandings(): Promise<JDriverStanding[]> {
  const data = await get<MrData<object>>("current/driverstandings.json");
  const list = data?.MRData.StandingsTable?.StandingsLists[0]?.DriverStandings;
  if (!list) return [];
  return list.map((s) => ({
    position: Number(s.position),
    points: Number(s.points),
    wins: Number(s.wins),
    code: s.Driver.code,
    givenName: s.Driver.givenName,
    familyName: s.Driver.familyName,
    constructor: s.Constructors[0]?.name ?? "",
  }));
}

export async function getConstructorStandings(): Promise<JConstructorStanding[]> {
  const data = await get<MrData<object>>("current/constructorstandings.json");
  const list = data?.MRData.StandingsTable?.StandingsLists[0]?.ConstructorStandings;
  if (!list) return [];
  return list.map((s) => ({
    position: Number(s.position),
    points: Number(s.points),
    wins: Number(s.wins),
    name: s.Constructor.name,
  }));
}

export async function getSeasonCalendar(year: number): Promise<Race[]> {
  const data = await get<MrData<object>>(`${year}/races.json`);
  const races = data?.MRData.RaceTable?.Races;
  if (!races) return [];
  return races.map((r) => {
    const startUtc = new Date(`${r.date}T${r.time}`);
    const finished = Array.isArray(r.Results) && r.Results.length > 0;
    const podium = finished
      ? (r.Results as JRaceResult[])
          .slice(0, 3)
          .map((res) => ({ code: res.Driver?.code || res.number }))
      : [];
    return {
      round: Number(r.round),
      raceName: r.raceName,
      date: r.date,
      time: r.time,
      circuit: r.Circuit.circuitName,
      locality: r.Circuit.Location.locality,
      country: r.Circuit.Location.country,
      track: r.Circuit.url ? getCircuitPath(r.Circuit.url) : null,
      meta: r.Circuit.url ? getCircuitMeta(r.Circuit.url) : null,
      sprint: Boolean(r.Sprint),
      status: startUtc.getTime() + 3 * 3600_000 < Date.now() ? "past" : "upcoming",
      winnerCode: finished && r.Results![0]?.Driver ? r.Results![0].Driver.code : null,
      podium,
    };
  });
}

export async function getSeasonDrivers(): Promise<JSeasonDriver[]> {
  const data = await get<MrData<object>>("current/drivers.json");
  const drivers = data?.MRData.DriverTable?.Drivers;
  if (!drivers) return [];
  return drivers.map((d) => ({
    driverId: d.driverId,
    permanentNumber: d.permanentNumber ?? "",
    code: d.code ?? "",
    givenName: d.givenName,
    familyName: d.familyName,
    dateOfBirth: d.dateOfBirth ?? null,
    nationality: d.nationality,
    url: d.url ?? null,
  }));
}

export async function getSeasonConstructors(): Promise<{ name: string; nationality: string }[]> {
  const data = await get<MrData<object>>("current/constructors.json");
  const constructors = data?.MRData.ConstructorTable?.Constructors;
  if (!constructors) return [];
  return constructors.map((c) => ({ name: c.name, nationality: c.nationality }));
}

export async function getRaceResultsDetail(year: number | string = "current", round: number | string = "last"): Promise<{ raceName: string; circuit: string; results: JRaceResult[] } | null> {
  const data = await get<MrData<object>>(`${year}/${round}/results.json`);
  const race = data?.MRData.RaceTable?.Races?.[0];
  if (!race || !race.Results) return null;
  return {
    raceName: race.raceName,
    circuit: race.Circuit.circuitName,
    results: race.Results,
  };
}

export async function getQualifyingResultsDetail(year: number | string = "current", round: number | string = "last"): Promise<{ raceName: string; qualifying: JQualifyingResult[] } | null> {
  const data = await get<MrData<object>>(`${year}/${round}/qualifying.json`);
  const race = data?.MRData.RaceTable?.Races?.[0];
  if (!race || !race.QualifyingResults) return null;
  return {
    raceName: race.raceName,
    qualifying: race.QualifyingResults,
  };
}

export async function getPitStopsDetail(year: number | string = "current", round: number | string = "last"): Promise<{ raceName: string; pitStops: JPitStop[] } | null> {
  const data = await get<MrData<object>>(`${year}/${round}/pitstops.json`);
  const race = data?.MRData.RaceTable?.Races?.[0];
  if (!race || !race.PitStops) return null;
  return {
    raceName: race.raceName,
    pitStops: race.PitStops,
  };
}

