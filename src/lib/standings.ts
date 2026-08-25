import type { DriverInfo } from "./types";
import {
  getChampionshipDrivers,
  getDrivers,
} from "./openf1";
import {
  getConstructorStandings,
  getDriverStandings,
} from "./jolpica";
import { teamColor } from "./utils";

export interface StandingRow {
  position: number;
  name: string;
  code: string;
  team: string;
  points: number;
  wins?: number;
  color?: string;
}

function buildColorMaps(drivers: DriverInfo[]) {
  const colorByTeam = new Map<string, string>();
  for (const d of drivers) colorByTeam.set(d.team_name, d.team_colour);

  const findColor = (team: string): string => {
    const lower = team.toLowerCase();
    for (const [key, color] of colorByTeam) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
        return color;
      }
    }
    return teamColor(team);
  };
  return { findColor };
}

export async function getStandings() {
  const [jDrivers, jConstructors, drivers, champDrivers] = await Promise.all([
    getDriverStandings(),
    getConstructorStandings(),
    getDrivers(),
    getChampionshipDrivers(),
  ]);

  const { findColor } = buildColorMaps(drivers);
  const infoByNumber = new Map(drivers.map((d) => [d.driver_number, d]));

  let driverRows: StandingRow[];
  if (jDrivers.length) {
    driverRows = jDrivers.map((s) => ({
      position: s.position,
      name: `${s.givenName} ${s.familyName}`,
      code: s.code,
      team: s.constructor,
      points: s.points,
      wins: s.wins,
      color: findColor(s.constructor),
    }));
  } else if (champDrivers.length) {
    driverRows = champDrivers
      .map((s) => {
        const info = infoByNumber.get(s.driver_number);
        return {
          position: s.position_current,
          name: info?.full_name ?? `Piloto #${s.driver_number}`,
          code: info?.name_acronym ?? String(s.driver_number),
          team: info?.team_name ?? "",
          points: s.points_current,
          color: info?.team_colour ?? findColor(info?.team_name ?? ""),
        };
      })
      .sort((a, b) => a.position - b.position);
  } else {
    driverRows = [];
  }

  let constructorRows: StandingRow[];
  if (jConstructors.length) {
    constructorRows = jConstructors.map((s) => ({
      position: s.position,
      name: s.name,
      code: s.name,
      team: s.name,
      points: s.points,
      wins: s.wins,
      color: findColor(s.name),
    }));
  } else {
    constructorRows = [];
  }

  return {
    driverRows,
    constructorRows,
    drivers,
    codeByNumber: Object.fromEntries(drivers.map((d) => [d.driver_number, d.name_acronym])),
  };
}
