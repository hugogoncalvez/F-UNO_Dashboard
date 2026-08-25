import type {
  DriverInfo,
  LapData,
  LiveDriverState,
  PitStop,
  RaceControlMessage,
  Session,
  Stint,
  WeatherData,
} from "./types";

export interface TelemetryBundle {
  session: Session | null;
  drivers: LiveDriverState[];
  weather: WeatherData | null;
  pitStops: PitStop[];
  stintsByDriver: Map<number, Stint[]>;
  raceControl: RaceControlMessage[];
  isLiveActive: boolean;
  latestFlag: string;
  isSimulation?: boolean;
}

export const COMPOUND_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  SOFT: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/40", label: "S" },
  MEDIUM: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/40", label: "M" },
  HARD: { bg: "bg-slate-200/20", text: "text-slate-100", border: "border-slate-300/40", label: "H" },
  INTERMEDIATE: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/40", label: "I" },
  WET: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/40", label: "W" },
  UNKNOWN: { bg: "bg-surface-container", text: "text-on-surface-variant", border: "border-border-subtle", label: "?" },
};

export function getCompoundStyle(compound: string) {
  const norm = (compound || "").toUpperCase();
  if (norm.includes("SOFT")) return COMPOUND_COLORS.SOFT;
  if (norm.includes("MEDIUM")) return COMPOUND_COLORS.MEDIUM;
  if (norm.includes("HARD")) return COMPOUND_COLORS.HARD;
  if (norm.includes("INTER")) return COMPOUND_COLORS.INTERMEDIATE;
  if (norm.includes("WET")) return COMPOUND_COLORS.WET;
  return COMPOUND_COLORS.UNKNOWN;
}

export function fmtTime(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || Number.isNaN(sec) || sec <= 0) return "--:--.---";
  const mins = Math.floor(sec / 60);
  const remainder = (sec % 60).toFixed(3);
  const pad = remainder.padStart(6, "0");
  return mins > 0 ? `${mins}:${pad}` : `${sec.toFixed(3)}s`;
}

export function fmtSector(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || Number.isNaN(sec) || sec <= 0) return "--.---";
  return sec.toFixed(3);
}

export function fmtGap(gap: number | null | undefined): string {
  if (gap === null || gap === undefined) return "LÍDER";
  if (gap === 0) return "+0.000s";
  return `+${gap < 1 ? gap.toFixed(3) : gap.toFixed(2)}s`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Helper: Realizar fetch secuencial con pausa de 350ms para no saturar rate limit (3 req/sec)
export async function fetchJsonThrottled(url: string, delayMs = 350): Promise<any> {
  await sleep(delayMs);
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data;
  } catch (e) {
    return [];
  }
}

// Memoria en cliente de última sesión real válida
let lastValidRealBundle: TelemetryBundle | null = null;
let cachedSession: Session | null = null;
let cachedDriversRaw: DriverInfo[] = [];

export function generateSimulationBundle(): TelemetryBundle {
  const session: Session = {
    session_key: 9999,
    meeting_key: 999,
    session_name: "Carrera — GP España (Simulación Telemétrica)",
    session_type: "Race",
    date_start: new Date().toISOString(),
    date_end: new Date(Date.now() + 7200000).toISOString(),
    country_name: "España",
    circuit_short_name: "Barcelona-Catalunya",
    location: "Montmeló",
    year: 2026,
  };

  const weather: WeatherData = {
    air_temperature: 27.4,
    track_temperature: 38.6,
    humidity: 43,
    pressure: 1014.2,
    rainfall: 0,
    wind_speed: 12.4,
    wind_direction: 180,
    date: new Date().toISOString(),
  };

  const simDriversRaw = [
    { num: 1, code: "VER", name: "Max Verstappen", team: "Red Bull Racing", color: "#3671c6", pos: 1, gap: null, int: null, s1: 21.341, s2: 28.110, s3: 26.961, best: 76.412, last: 76.820, compound: "HARD", age: 14, pit: 1 },
    { num: 4, code: "NOR", name: "Lando Norris", team: "McLaren", color: "#ff8000", pos: 2, gap: 1.428, int: 1.428, s1: 21.410, s2: 28.090, s3: 27.080, best: 76.580, last: 76.910, compound: "HARD", age: 15, pit: 1 },
    { num: 16, code: "LEC", name: "Charles Leclerc", team: "Ferrari", color: "#ef1a2d", pos: 3, gap: 4.810, int: 3.382, s1: 21.520, s2: 28.190, s3: 27.000, best: 76.710, last: 77.105, compound: "MEDIUM", age: 22, pit: 1 },
    { num: 81, code: "PIA", name: "Oscar Piastri", team: "McLaren", color: "#ff8000", pos: 4, gap: 8.230, int: 3.420, s1: 21.480, s2: 28.210, s3: 27.200, best: 76.890, last: 77.340, compound: "HARD", age: 15, pit: 1 },
    { num: 44, code: "HAM", name: "Lewis Hamilton", team: "Ferrari", color: "#ef1a2d", pos: 5, gap: 12.105, int: 3.875, s1: 21.590, s2: 28.250, s3: 27.170, best: 77.010, last: 77.410, compound: "HARD", age: 18, pit: 1 },
    { num: 63, code: "RUS", name: "George Russell", team: "Mercedes", color: "#27f4d2", pos: 6, gap: 15.890, int: 3.785, s1: 21.610, s2: 28.310, s3: 27.230, best: 77.150, last: 77.580, compound: "HARD", age: 16, pit: 1 },
    { num: 55, code: "SAI", name: "Carlos Sainz", team: "Williams", color: "#64c4ff", pos: 7, gap: 22.410, int: 6.520, s1: 21.680, s2: 28.380, s3: 27.280, best: 77.340, last: 77.820, compound: "MEDIUM", age: 12, pit: 1 },
    { num: 14, code: "ALO", name: "Fernando Alonso", team: "Aston Martin", color: "#229971", pos: 8, gap: 28.910, int: 6.500, s1: 21.720, s2: 28.420, s3: 27.370, best: 77.510, last: 77.940, compound: "HARD", age: 14, pit: 1 },
    { num: 43, code: "COL", name: "Franco Colapinto", team: "Alpine", color: "#0093cc", pos: 9, gap: 34.120, int: 5.210, s1: 21.780, s2: 28.490, s3: 27.410, best: 77.680, last: 78.100, compound: "MEDIUM", age: 19, pit: 1 },
    { num: 12, code: "ANT", name: "Kimi Antonelli", team: "Mercedes", color: "#27f4d2", pos: 10, gap: 39.540, int: 5.420, s1: 21.810, s2: 28.520, s3: 27.490, best: 77.820, last: 78.250, compound: "HARD", age: 16, pit: 1 },
    { num: 10, code: "GAS", name: "Pierre Gasly", team: "Alpine", color: "#0093cc", pos: 11, gap: 44.890, int: 5.350, s1: 21.860, s2: 28.580, s3: 27.520, best: 77.960, last: 78.410, compound: "MEDIUM", age: 19, pit: 1 },
    { num: 23, code: "ALB", name: "Alexander Albon", team: "Williams", color: "#64c4ff", pos: 12, gap: 49.320, int: 4.430, s1: 21.910, s2: 28.620, s3: 27.580, best: 78.110, last: 78.600, compound: "HARD", age: 13, pit: 1 },
    { num: 31, code: "OCO", name: "Esteban Ocon", team: "Haas F1 Team", color: "#b6babd", pos: 13, gap: 54.100, int: 4.780, s1: 21.950, s2: 28.690, s3: 27.610, best: 78.250, last: 78.750, compound: "MEDIUM", age: 18, pit: 1 },
    { num: 27, code: "HUL", name: "Nico Hulkenberg", team: "Sauber", color: "#52e252", pos: 14, gap: 59.800, int: 5.700, s1: 21.990, s2: 28.740, s3: 27.680, best: 78.410, last: 78.910, compound: "HARD", age: 15, pit: 1 },
    { num: 18, code: "STR", name: "Lance Stroll", team: "Aston Martin", color: "#229971", pos: 15, gap: 64.210, int: 4.410, s1: 22.040, s2: 28.790, s3: 27.720, best: 78.550, last: 79.050, compound: "HARD", age: 14, pit: 1 },
    { num: 6, code: "HAD", name: "Isack Hadjar", team: "VCARB", color: "#6692ff", pos: 16, gap: 69.450, int: 5.240, s1: 22.100, s2: 28.850, s3: 27.790, best: 78.740, last: 79.200, compound: "SOFT", age: 8, pit: 2 },
    { num: 30, code: "LAW", name: "Liam Lawson", team: "VCARB", color: "#6692ff", pos: 17, gap: 74.120, int: 4.670, s1: 22.150, s2: 28.910, s3: 27.840, best: 78.900, last: 79.400, compound: "MEDIUM", age: 17, pit: 1 },
    { num: 87, code: "BEA", name: "Oliver Bearman", team: "Haas F1 Team", color: "#b6babd", pos: 18, gap: 79.600, int: 5.480, s1: 22.210, s2: 28.970, s3: 27.910, best: 79.090, last: 79.600, compound: "MEDIUM", age: 18, pit: 1 },
    { num: 5, code: "BOR", name: "Gabriel Bortoleto", team: "Sauber", color: "#52e252", pos: 19, gap: 85.300, int: 5.700, s1: 22.280, s2: 29.040, s3: 27.980, best: 79.300, last: 79.850, compound: "HARD", age: 15, pit: 1 },
    { num: 77, code: "BOT", name: "Valtteri Bottas", team: "Sauber", color: "#52e252", pos: 20, gap: 91.100, int: 5.800, s1: 22.340, s2: 29.120, s3: 28.050, best: 79.510, last: 80.100, compound: "MEDIUM", age: 20, pit: 1 },
    { num: 11, code: "PER", name: "Sergio Pérez", team: "Cadillac F1", color: "#b4c5ff", pos: 21, gap: 97.400, int: 6.300, s1: 22.410, s2: 29.200, s3: 28.150, best: 79.760, last: 80.350, compound: "HARD", age: 12, pit: 1 },
    { num: 3, code: "LIN", name: "Arvid Lindblad", team: "VCARB", color: "#6692ff", pos: 22, gap: 104.200, int: 6.800, s1: 22.490, s2: 29.310, s3: 28.240, best: 80.040, last: 80.700, compound: "SOFT", age: 7, pit: 2 },
  ];

  const stintsByDriver = new Map<number, Stint[]>();
  for (const d of simDriversRaw) {
    if (d.pit === 1) {
      stintsByDriver.set(d.num, [
        { driver_number: d.num, stint_number: 1, compound: "MEDIUM", tyre_age_at_start: 18 },
        { driver_number: d.num, stint_number: 2, compound: d.compound, tyre_age_at_start: d.age },
      ]);
    } else {
      stintsByDriver.set(d.num, [
        { driver_number: d.num, stint_number: 1, compound: "MEDIUM", tyre_age_at_start: 15 },
        { driver_number: d.num, stint_number: 2, compound: "HARD", tyre_age_at_start: 16 },
        { driver_number: d.num, stint_number: 3, compound: d.compound, tyre_age_at_start: d.age },
      ]);
    }
  }

  const drivers: LiveDriverState[] = simDriversRaw.map((d) => ({
    driver_number: d.num,
    code: d.code,
    name: d.name,
    team: d.team,
    team_colour: d.color,
    position: d.pos,
    gap_to_leader: d.gap,
    interval: d.int,
    current_compound: d.compound,
    tyre_age: d.age,
    stint_count: d.pit + 1,
    s1: d.s1,
    s2: d.s2,
    s3: d.s3,
    last_lap: d.last,
    best_lap: d.best,
    is_s1_best_session: d.num === 1,
    is_s2_best_session: d.num === 4,
    is_s3_best_session: d.num === 1,
    is_s1_best_personal: true,
    is_s2_best_personal: true,
    is_s3_best_personal: true,
    pit_count: d.pit,
  }));

  const pitStops: PitStop[] = [
    { driver_number: 4, lap_number: 19, pit_duration: 21.40, stop_duration: 2.12, date: new Date(Date.now() - 300000).toISOString() },
    { driver_number: 1, lap_number: 18, pit_duration: 21.65, stop_duration: 2.34, date: new Date(Date.now() - 420000).toISOString() },
    { driver_number: 16, lap_number: 17, pit_duration: 21.82, stop_duration: 2.41, date: new Date(Date.now() - 540000).toISOString() },
    { driver_number: 43, lap_number: 16, pit_duration: 21.95, stop_duration: 2.52, date: new Date(Date.now() - 660000).toISOString() },
    { driver_number: 44, lap_number: 15, pit_duration: 22.10, stop_duration: 2.65, date: new Date(Date.now() - 780000).toISOString() },
  ];

  const raceControl: RaceControlMessage[] = [
    { category: "FLAG", flag: "GREEN", message: "BANDERA VERDE EN PISTA - SECTORES LIMPIOS", date: new Date().toISOString() },
    { category: "PIT", message: "CAR 4 (NOR) - PARADA EN BOXES COMPLETADA (2.12s)", date: new Date(Date.now() - 300000).toISOString() },
    { category: "SAFETY", message: "PISTA SECA Y TEMPERATURA EN AUMENTO (38.6 °C)", date: new Date(Date.now() - 600000).toISOString() },
    { category: "STEWARDS", message: "CAR 12 (ANT) BAJO INVESTIGACIÓN - LÍMITES DE PISTA CURVA 9", date: new Date(Date.now() - 900000).toISOString() },
  ];

  return {
    session,
    drivers,
    weather,
    pitStops,
    stintsByDriver,
    raceControl,
    isLiveActive: true,
    latestFlag: "GREEN",
    isSimulation: true,
  };
}

export async function fetchTelemetryData(sessionKey: number | string = "latest"): Promise<TelemetryBundle> {
  // Si el usuario explícitamente eligió simulación
  if (sessionKey === "sim") {
    return generateSimulationBundle();
  }

  // 1. Fetch Sesión (secuencial)
  let sessions: Session[] = [];
  if (!cachedSession || sessionKey !== "latest") {
    sessions = await fetchJsonThrottled(`https://api.openf1.org/v1/sessions?session_key=${sessionKey}`, 200);
    if (sessions.length) cachedSession = sessions[0];
  } else if (cachedSession) {
    sessions = [cachedSession];
  }

  const session: Session | null = sessions[0] ?? cachedSession;
  const targetKey = session?.session_key ?? sessionKey;

  // 2. Fetch Drivers (secuencial)
  if (!cachedDriversRaw.length || sessionKey !== "latest") {
    const dList = await fetchJsonThrottled(`https://api.openf1.org/v1/drivers?session_key=${targetKey}`, 350);
    if (dList.length) cachedDriversRaw = dList;
  }

  // 3. Fetch Endpoints Dinámicos secuencialmente con pausas de 350ms para evitar HTTP 429
  const positions = await fetchJsonThrottled(`https://api.openf1.org/v1/position?session_key=${targetKey}`, 350);
  const intervals = await fetchJsonThrottled(`https://api.openf1.org/v1/intervals?session_key=${targetKey}`, 350);
  const laps = await fetchJsonThrottled(`https://api.openf1.org/v1/laps?session_key=${targetKey}`, 350);
  const weatherList = await fetchJsonThrottled(`https://api.openf1.org/v1/weather?session_key=${targetKey}`, 350);
  const stints = await fetchJsonThrottled(`https://api.openf1.org/v1/stints?session_key=${targetKey}`, 350);
  const pitStops = await fetchJsonThrottled(`https://api.openf1.org/v1/pit?session_key=${targetKey}`, 350);
  const raceControl = await fetchJsonThrottled(`https://api.openf1.org/v1/race_control?session_key=${targetKey}`, 350);

  // Si esta llamada falló totalmente debido a 429 o vacíos, pero YA TENÍAMOS datos reales válidos anteriores,
  // NO descartamos los datos reales ni cambiamos a simulación: retenemos lastValidRealBundle
  if (!positions.length && !cachedDriversRaw.length) {
    if (lastValidRealBundle) {
      return lastValidRealBundle;
    }
    return generateSimulationBundle();
  }

  const driversRaw = cachedDriversRaw;
  const isLiveActive = positions.length > 0;

  // Clima más reciente
  const weather: WeatherData | null = weatherList.length ? weatherList[weatherList.length - 1] : (lastValidRealBundle?.weather ?? null);

  // Banderas / Control de carrera
  const sortedRaceControl: RaceControlMessage[] = [...raceControl].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const flagMsg = sortedRaceControl.find((m) => m.flag);
  const latestFlag = flagMsg?.flag ?? lastValidRealBundle?.latestFlag ?? "GREEN";

  // Agrupar Drivers
  const driverMap = new Map<number, DriverInfo>();
  for (const d of driversRaw) {
    if (d.driver_number) driverMap.set(d.driver_number, d);
  }

  // Última posición conocida por piloto
  const lastPosMap = new Map<number, { position: number; date: string }>();
  for (const p of positions) {
    const prev = lastPosMap.get(p.driver_number);
    if (!prev || new Date(p.date) > new Date(prev.date)) {
      lastPosMap.set(p.driver_number, p);
    }
  }

  // Último interval conocido por piloto
  const lastIntervalMap = new Map<number, { gap: number | null; interval: number | null; date: string }>();
  for (const i of intervals) {
    const prev = lastIntervalMap.get(i.driver_number);
    if (!prev || new Date(i.date) > new Date(prev.date)) {
      lastIntervalMap.set(i.driver_number, {
        gap: i.gap_to_leader ?? null,
        interval: i.interval ?? null,
        date: i.date,
      });
    }
  }

  // Agrupar Stints por piloto
  const stintsByDriver = new Map<number, Stint[]>();
  for (const s of stints) {
    const list = stintsByDriver.get(s.driver_number) ?? [];
    list.push(s);
    stintsByDriver.set(s.driver_number, list);
  }
  for (const [dNum, list] of stintsByDriver.entries()) {
    list.sort((a, b) => a.stint_number - b.stint_number);
  }

  // Agrupar Pit stops por piloto
  const pitCountByDriver = new Map<number, number>();
  for (const p of pitStops) {
    pitCountByDriver.set(p.driver_number, (pitCountByDriver.get(p.driver_number) ?? 0) + 1);
  }

  // Agrupar vueltas y calcular mejores sectores
  const lapsByDriver = new Map<number, LapData[]>();
  let sessionBestS1 = Infinity;
  let sessionBestS2 = Infinity;
  let sessionBestS3 = Infinity;

  for (const l of laps) {
    const list = lapsByDriver.get(l.driver_number) ?? [];
    list.push(l);
    lapsByDriver.set(l.driver_number, list);

    if (l.duration_sector_1 && l.duration_sector_1 < sessionBestS1) sessionBestS1 = l.duration_sector_1;
    if (l.duration_sector_2 && l.duration_sector_2 < sessionBestS2) sessionBestS2 = l.duration_sector_2;
    if (l.duration_sector_3 && l.duration_sector_3 < sessionBestS3) sessionBestS3 = l.duration_sector_3;
  }

  // Construir estado por piloto
  const driverStateList: LiveDriverState[] = [];
  const allDriverNumbers = new Set<number>([
    ...lastPosMap.keys(),
    ...driverMap.keys(),
  ]);

  for (const dNum of allDriverNumbers) {
    const dInfo = driverMap.get(dNum);
    const posObj = lastPosMap.get(dNum);
    const intObj = lastIntervalMap.get(dNum);
    const dStints = stintsByDriver.get(dNum) ?? [];
    const currentStint = dStints[dStints.length - 1];

    const dLaps = lapsByDriver.get(dNum) ?? [];
    dLaps.sort((a, b) => a.lap_number - b.lap_number);

    let lastLapObj: LapData | null = null;
    let bestLapTime: number | null = null;
    let personalBestS1 = Infinity;
    let personalBestS2 = Infinity;
    let personalBestS3 = Infinity;

    for (const l of dLaps) {
      if (l.lap_duration && (!bestLapTime || l.lap_duration < bestLapTime)) {
        bestLapTime = l.lap_duration;
      }
      if (l.duration_sector_1 && l.duration_sector_1 < personalBestS1) personalBestS1 = l.duration_sector_1;
      if (l.duration_sector_2 && l.duration_sector_2 < personalBestS2) personalBestS2 = l.duration_sector_2;
      if (l.duration_sector_3 && l.duration_sector_3 < personalBestS3) personalBestS3 = l.duration_sector_3;
      if (l.duration_sector_1 || l.duration_sector_2 || l.duration_sector_3 || l.lap_duration) {
        lastLapObj = l;
      }
    }

    const s1 = lastLapObj?.duration_sector_1 ?? null;
    const s2 = lastLapObj?.duration_sector_2 ?? null;
    const s3 = lastLapObj?.duration_sector_3 ?? null;

    driverStateList.push({
      driver_number: dNum,
      code: dInfo?.name_acronym ?? String(dNum),
      name: dInfo?.full_name ?? `Piloto #${dNum}`,
      team: dInfo?.team_name ?? "Equipo N/A",
      team_colour: dInfo?.team_colour ? `#${dInfo.team_colour}` : "#a1a1aa",
      position: posObj?.position ?? 99,
      gap_to_leader: intObj?.gap ?? null,
      interval: intObj?.interval ?? null,
      current_compound: currentStint?.compound ?? "SOFT",
      tyre_age: currentStint?.tyre_age_at_start ?? 0,
      stint_count: dStints.length,
      s1,
      s2,
      s3,
      last_lap: lastLapObj?.lap_duration ?? null,
      best_lap: bestLapTime,
      is_s1_best_session: s1 !== null && Math.abs(s1 - sessionBestS1) < 0.001,
      is_s2_best_session: s2 !== null && Math.abs(s2 - sessionBestS2) < 0.001,
      is_s3_best_session: s3 !== null && Math.abs(s3 - sessionBestS3) < 0.001,
      is_s1_best_personal: s1 !== null && Math.abs(s1 - personalBestS1) < 0.001,
      is_s2_best_personal: s2 !== null && Math.abs(s2 - personalBestS2) < 0.001,
      is_s3_best_personal: s3 !== null && Math.abs(s3 - personalBestS3) < 0.001,
      pit_count: pitCountByDriver.get(dNum) ?? 0,
    });
  }

  driverStateList.sort((a, b) => a.position - b.position);

  // Si tenemos posiciones válidas, guardamos este bundle como última sesión válida
  if (driverStateList.length > 0) {
    lastValidRealBundle = {
      session,
      drivers: driverStateList,
      weather,
      pitStops: [...pitStops].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      stintsByDriver,
      raceControl: sortedRaceControl,
      isLiveActive,
      latestFlag,
      isSimulation: false,
    };
    return lastValidRealBundle;
  }

  if (lastValidRealBundle) return lastValidRealBundle;
  return generateSimulationBundle();
}
