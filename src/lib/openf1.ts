import type {
  ChampionshipDriverRow,
  DriverInfo,
  Session,
  Stint,
  PitStop,
  WeatherData,
  LapData,
  RaceControlMessage,
} from "./types";

import { cachedGetJson } from "./fetch";

const BASE = "https://api.openf1.org/v1";

const TTL_MS: Record<string, number> = {
  sessions: 5 * 60_000,
  drivers: 5 * 60_000,
  championship: 60_000,
  position: 10_000,
  intervals: 10_000,
  stints: 30_000,
  pit: 30_000,
  weather: 15_000,
  laps: 15_000,
  race_control: 15_000,
};
const DEFAULT_TTL = 60_000;

function ttlFor(path: string): number {
  const key = Object.keys(TTL_MS).find((k) => path.startsWith(k));
  return key ? TTL_MS[key] : DEFAULT_TTL;
}

async function get<T>(path: string): Promise<T | null> {
  return cachedGetJson<T>(`${BASE}/${path}`, { ttlMs: ttlFor(path) });
}

export async function getRaceSessions(year: number): Promise<Session[]> {
  return (await get<Session[]>(`sessions?year=${year}&session_type=Race`)) ?? [];
}

export async function getRecentSessions(year: number = 2026): Promise<Session[]> {
  const list = (await get<Session[]>(`sessions?year=${year}`)) ?? [];
  if (!list.length && year > 2023) {
    return (await get<Session[]>(`sessions?year=${year - 1}`)) ?? [];
  }
  return list;
}

export async function getChampionshipDrivers(): Promise<ChampionshipDriverRow[]> {
  return (
    (await get<ChampionshipDriverRow[]>(
      "championship_drivers?session_key=latest",
    )) ?? []
  );
}

export async function getDrivers(sessionKey: number | string = "latest"): Promise<DriverInfo[]> {
  const list =
    (await get<DriverInfo[]>(`drivers?session_key=${sessionKey}`)) ??
    (await get<DriverInfo[]>(`drivers?meeting_key=${sessionKey}`));
  return list ?? [];
}

export async function getLivePositions(sessionKey: number | string = "latest"): Promise<{ driver_number: number; position: number; date: string }[]> {
  return (await get<{ driver_number: number; position: number; date: string }[]>(`position?session_key=${sessionKey}`)) ?? [];
}

export async function getLiveIntervals(sessionKey: number | string = "latest"): Promise<{ driver_number: number; gap_to_leader: number | null; interval: number | null; date: string }[]> {
  return (await get<{ driver_number: number; gap_to_leader: number | null; interval: number | null; date: string }[]>(`intervals?session_key=${sessionKey}`)) ?? [];
}

export async function getStints(sessionKey: number | string = "latest"): Promise<Stint[]> {
  return (await get<Stint[]>(`stints?session_key=${sessionKey}`)) ?? [];
}

export async function getPitStops(sessionKey: number | string = "latest"): Promise<PitStop[]> {
  return (await get<PitStop[]>(`pit?session_key=${sessionKey}`)) ?? [];
}

export async function getWeather(sessionKey: number | string = "latest"): Promise<WeatherData[]> {
  return (await get<WeatherData[]>(`weather?session_key=${sessionKey}`)) ?? [];
}

export async function getLaps(sessionKey: number | string = "latest"): Promise<LapData[]> {
  return (await get<LapData[]>(`laps?session_key=${sessionKey}`)) ?? [];
}

export async function getRaceControl(sessionKey: number | string = "latest"): Promise<RaceControlMessage[]> {
  return (await get<RaceControlMessage[]>(`race_control?session_key=${sessionKey}`)) ?? [];
}

