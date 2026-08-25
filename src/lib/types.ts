export interface Session {
  session_key: number;
  meeting_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  country_name: string;
  circuit_short_name: string;
  location: string;
  year: number;
}

export interface ChampionshipDriverRow {
  driver_number: number;
  position_current: number;
  points_current: number;
  position_start: number;
  points_start: number;
}

export interface DriverInfo {
  driver_number: number;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  headshot_url: string | null;
}

export interface JSeasonDriver {
  driverId: string;
  permanentNumber: string;
  code: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string | null;
  nationality: string;
  url: string | null;
}

export interface DriverProfile {
  slug: string;
  driverNumber: number;
  code: string;
  fullName: string;
  team: string;
  teamColour: string;
  headshotUrl: string | null;
  nationality: string;
  dateOfBirth: string | null;
  age: number | null;
  wikiUrl: string | null;
  teamNationality: string | null;
  championship: { position: number; points: number; wins: number } | null;
}

export interface JDriverStanding {
  position: number;
  points: number;
  wins: number;
  code: string;
  givenName: string;
  familyName: string;
  constructor: string;
}

export interface JConstructorStanding {
  position: number;
  points: number;
  wins: number;
  name: string;
}

export interface CircuitMeta {
  name: string;
  location: string;
  opened: number | null;
  firstGP: number | null;
  lengthMeters: number | null;
  altitude: number | null;
}

export interface CircuitPath {
  /** Path `d` del trazado en coordenadas viewBox w×h. */
  d: string;
  /** Polígono del muro de extrusión (trazado desplazado hacia abajo-derecha). */
  wallD: string;
  /** Longitud real del trazado en unidades de viewBox (para stroke-dasharray). */
  length: number;
  /** Punto de salida/meta en coordenadas viewBox. */
  startX: number;
  startY: number;
  w: number;
  h: number;
}

export interface RaceSession {
  key: string;
  date: string;
  time: string;
}

export interface Race {
  round: number;
  raceName: string;
  date: string;
  time: string;
  circuit: string;
  locality: string;
  country: string;
  track: CircuitPath | null;
  meta: CircuitMeta | null;
  sprint: boolean;
  status: "past" | "upcoming";
  winnerCode: string | null;
  podium: { code: string }[];
  schedule: RaceSession[];
}

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  date: string | null;
  description: string;
  imageUrl?: string | null;
}

export interface LivePosition {
  driver_number: number;
  position: number;
  date: string;
  gap_to_leader: number | null;
}

export interface Stint {
  driver_number: number;
  stint_number: number;
  compound: "SOFT" | "MEDIUM" | "HARD" | "INTERMEDIATE" | "WET" | string;
  tyre_age_at_start: number;
  lap_start?: number;
  lap_end?: number;
}

export interface PitStop {
  driver_number: number;
  lap_number: number;
  pit_duration: number | null;
  stop_duration: number | null;
  date: string;
}

export interface WeatherData {
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  pressure: number;
  rainfall: number;
  wind_speed: number;
  wind_direction: number;
  date: string;
}

export interface LapData {
  driver_number: number;
  lap_number: number;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  lap_duration: number | null;
  is_pit_out_lap: boolean | null;
  i1_speed: number | null;
  i2_speed: number | null;
  st_speed: number | null;
  date_start: string;
}

export interface RaceControlMessage {
  category: string;
  flag?: "GREEN" | "YELLOW" | "RED" | "CHEQUERED" | "BLUE" | "BLACK AND WHITE" | string;
  message: string;
  scope?: string;
  sector?: number;
  date: string;
  driver_number?: number;
}

export interface LiveDriverState {
  driver_number: number;
  code: string;
  name: string;
  team: string;
  team_colour: string;
  position: number;
  gap_to_leader: number | null;
  interval: number | null;
  current_compound: string;
  tyre_age: number;
  stint_count: number;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  last_lap: number | null;
  best_lap: number | null;
  is_s1_best_session?: boolean;
  is_s2_best_session?: boolean;
  is_s3_best_session?: boolean;
  is_s1_best_personal?: boolean;
  is_s2_best_personal?: boolean;
  is_s3_best_personal?: boolean;
  pit_count: number;
}

export interface JRaceResult {
  number: string;
  position: string;
  positionText: string;
  points: string;
  grid: string;
  laps: string;
  status: string;
  Time?: { millis: string; time: string };
  FastestLap?: {
    rank: string;
    lap: string;
    Time: { time: string };
    AverageSpeed: { speed: string; units: string };
  };
  Driver: {
    driverId: string;
    permanentNumber: string;
    code: string;
    givenName: string;
    familyName: string;
    nationality: string;
  };
  Constructor: {
    constructorId: string;
    name: string;
    nationality: string;
  };
}

export interface JQualifyingResult {
  number: string;
  position: string;
  Q1?: string;
  Q2?: string;
  Q3?: string;
  Driver: {
    driverId: string;
    code: string;
    givenName: string;
    familyName: string;
  };
  Constructor: {
    name: string;
  };
}

export interface JPitStop {
  driverId: string;
  lap: string;
  stop: string;
  time: string;
  duration: string;
}

export interface JLapTime {
  number: string;
  Timings: {
    driverId: string;
    position: string;
    time: string;
  }[];
}


