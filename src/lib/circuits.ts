import { CIRCUIT_META, CIRCUIT_PATHS } from "./circuit-data";
import type { CircuitMeta, CircuitPath } from "./types";

/**
 * Trazados de circuito generados desde los GeoJSON de bacinger/f1-circuits
 * (MIT) con scripts/generate-circuits.mjs, indexados por el título de la
 * página de Wikipedia que devuelve la API de Jolpica (Circuit.url).
 */
const CIRCUIT_IDS: Record<string, string> = {
  "Albert Park Circuit": "au-1953",
  "Shanghai International Circuit": "cn-2004",
  "Suzuka International Racing Course": "jp-1962",
  "Miami International Autodrome": "us-2022",
  "Circuit Gilles Villeneuve": "ca-1978",
  "Circuit de Monaco": "mc-1929",
  "Circuit de Barcelona-Catalunya": "es-1991",
  "Red Bull Ring": "at-1969",
  "Silverstone Circuit": "gb-1948",
  "Circuit de Spa-Francorchamps": "be-1925",
  "Hungaroring": "hu-1986",
  "Circuit Zandvoort": "nl-1948",
  "Monza Circuit": "it-1922",
  "Madring": "es-2026",
  "Baku City Circuit": "az-2016",
  "Sepang International Circuit": "my-1999",
  "Marina Bay Street Circuit": "sg-2008",
  "Circuit of the Americas": "us-2012",
  "Autódromo Hermanos Rodríguez": "mx-1962",
  "Interlagos Circuit": "br-1940",
  "Las Vegas Grand Prix": "us-2023",
  "Lusail International Circuit": "qa-2004",
  "Yas Marina Circuit": "ae-2009",
};

export function wikipediaTitleFromUrl(wikipediaUrl: string): string | null {
  try {
    const u = new URL(wikipediaUrl);
    if (!u.hostname.endsWith("wikipedia.org")) return null;
    const title = decodeURIComponent((u.pathname.split("/").pop() ?? "").replace(/_/g, " "));
    return title || null;
  } catch {
    return null;
  }
}

/** Datos del trazado de un circuito (null si no está disponible). */
export function getCircuitPath(wikipediaUrl: string): CircuitPath | null {
  const id = circuitIdFromUrl(wikipediaUrl);
  if (!id) return null;
  return CIRCUIT_PATHS[id] ?? null;
}

/** Metadatos estáticos del circuito (longitud, récord, etc.). */
export function getCircuitMeta(wikipediaUrl: string): CircuitMeta | null {
  const id = circuitIdFromUrl(wikipediaUrl);
  if (!id) return null;
  return CIRCUIT_META[id] ?? null;
}

function circuitIdFromUrl(wikipediaUrl: string): string | null {
  const title = wikipediaTitleFromUrl(wikipediaUrl);
  if (!title) return null;
  const id = CIRCUIT_IDS[title];
  return id ?? null;
}