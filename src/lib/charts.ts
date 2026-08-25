import type { DriverRaceResult } from "./jolpica";

interface ChartPoint {
  x: number;
  y: number;
  label: string;
  value: string;
}

const W = 600;
const H = 200;
const PAD = { top: 20, right: 20, bottom: 30, left: 40 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

function parseLapTime(time: string | null): number | null {
  if (!time) return null;
  const m = time.match(/^(\d+):(\d+\.\d+)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const s = Number(time);
  return Number.isFinite(s) ? s : null;
}

function gridLines(min: number, max: number, count: number): number[] {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

function svgHeader(): string {
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto" style="color: var(--color-on-surface)">`;
}

function grid(yMin: number, yMax: number, yCount: number, fmt: (v: number) => string): string {
  let s = "";
  for (const v of gridLines(yMin, yMax, yCount)) {
    const py = PAD.top + PH - ((v - yMin) / (yMax - yMin)) * PH;
    s += `<line x1="${PAD.left}" y1="${py}" x2="${W - PAD.right}" y2="${py}" stroke="currentColor" stroke-opacity="0.1" />`;
    s += `<text x="${PAD.left - 6}" y="${py + 4}" text-anchor="end" fill="currentColor" fill-opacity="0.5" font-size="10" font-family="monospace">${fmt(v)}</text>`;
  }
  return s;
}

function xLabels(count: number, labels: string[]): string {
  let s = "";
  for (let i = 0; i < count; i++) {
    const px = PAD.left + (i / Math.max(count - 1, 1)) * PW;
    if (i % Math.ceil(count / 8) === 0 || i === count - 1) {
      s += `<text x="${px}" y="${H - 4}" text-anchor="middle" fill="currentColor" fill-opacity="0.5" font-size="9" font-family="monospace">${labels[i] ?? ""}</text>`;
    }
  }
  return s;
}

function polyline(points: ChartPoint[], color: string): string {
  if (points.length < 2) return "";
  const coords = points.map(
    (p) => `${PAD.left + p.x * PW},${PAD.top + PH - p.y * PH}`,
  );
  return `<polyline fill="none" points="${coords.join(" ")}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
}

function dots(points: ChartPoint[], color: string): string {
  return points
    .map((p) => {
      const cx = PAD.left + p.x * PW;
      const cy = PAD.top + PH - p.y * PH;
      return `<circle cx="${cx}" cy="${cy}" r="3" fill="${color}"><title>${p.label}: ${p.value}</title></circle>`;
    })
    .join("");
}

function areaFill(points: ChartPoint[], color: string): string {
  if (points.length < 2) return "";
  const coords = points.map(
    (p) => `${PAD.left + p.x * PW},${PAD.top + PH - p.y * PH}`,
  );
  const first = `${PAD.left + points[0].x * PW},${PAD.top + PH}`;
  const last = `${PAD.left + points[points.length - 1].x * PW},${PAD.top + PH}`;
  return `<polygon fill="${color}" opacity="0.15" points="${first} ${coords.join(" ")} ${last}" />`;
}

export function positionChart(results: DriverRaceResult[], color: string): string {
  const valid = results.filter((r) => r.position !== null);
  if (!valid.length) return emptyChart("Sin datos de posición");

  const maxY = 20;
  const minY = 1;
  const labels = valid.map((r) => `R${r.round}`);

  const points: ChartPoint[] = valid.map((r, i) => ({
    x: i / Math.max(valid.length - 1, 1),
    y: 1 - ((r.position! - minY) / (maxY - minY)),
    label: `R${r.round}`,
    value: `P${r.position}`,
  }));

  return `${svgHeader()}
    <g class="text-on-surface">
      ${grid(maxY, minY, 5, (v) => `P${Math.round(v)}`)}
      ${xLabels(valid.length, labels)}
      ${areaFill(points, color)}
      ${polyline(points, color)}
      ${dots(points, color)}
    </g>
  </svg>`;
}

export function pointsChart(results: DriverRaceResult[], color: string): string {
  let cumulative = 0;
  const data = results.map((r) => {
    cumulative += r.points;
    return { round: r.round, total: cumulative };
  });

  if (!data.length) return emptyChart("Sin datos de puntos");

  const maxP = Math.max(...data.map((d) => d.total), 10);
  const labels = data.map((d) => `R${d.round}`);

  const points: ChartPoint[] = data.map((d, i) => ({
    x: i / Math.max(data.length - 1, 1),
    y: d.total / maxP,
    label: `R${d.round}`,
    value: `${d.total} pts`,
  }));

  return `${svgHeader()}
    <g class="text-on-surface">
      ${grid(0, maxP, 5, (v) => String(Math.round(v)))}
      ${xLabels(data.length, labels)}
      ${areaFill(points, color)}
      ${polyline(points, color)}
      ${dots(points, color)}
    </g>
  </svg>`;
}

export function lapTimeChart(results: DriverRaceResult[], color: string): string {
  const withTime = results
    .map((r) => ({ round: r.round, seconds: parseLapTime(r.fastestLapTime), rank: r.fastestLapRank }))
    .filter((r): r is { round: number; seconds: number; rank: number | null } => r.seconds !== null);

  if (!withTime.length) return emptyChart("Sin datos de tiempos");

  const times = withTime.map((r) => r.seconds);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const range = Math.max(maxT - minT, 1);
  const pad = range * 0.1;
  const yMin = minT - pad;
  const yMax = maxT + pad;

  const labels = withTime.map((r) => `R${r.round}`);

  const points: ChartPoint[] = withTime.map((r, i) => ({
    x: i / Math.max(withTime.length - 1, 1),
    y: 1 - (r.seconds - yMin) / (yMax - yMin),
    label: `R${r.round}`,
    value: formatSeconds(r.seconds) + (r.rank === 1 ? " 🟣" : ""),
  }));

  return `${svgHeader()}
    <g class="text-on-surface">
      ${grid(yMin, yMax, 5, formatSeconds)}
      ${xLabels(withTime.length, labels)}
      ${polyline(points, color)}
      ${dots(points, color)}
    </g>
  </svg>`;
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return m > 0 ? `${m}:${sec.padStart(6, "0")}` : sec;
}

function emptyChart(msg: string): string {
  return `${svgHeader()}
    <g class="text-on-surface">
      <text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="currentColor" fill-opacity="0.4" font-size="14" font-family="sans-serif">${msg}</text>
    </g>
  </svg>`;
}

export function gapToFastestChart(
  results: DriverRaceResult[],
  seasonFastest: Map<number, { round: number; time: number; driverCode: string }>,
  color: string,
): string {
  const data = results
    .map((r) => {
      const driverTime = parseLapTime(r.fastestLapTime);
      const raceFastest = seasonFastest.get(r.round);
      if (driverTime === null || !raceFastest) return null;
      return {
        round: r.round,
        gap: driverTime - raceFastest.time,
        isFastest: raceFastest.driverCode === r.constructorName ? false : r.fastestLapRank === 1,
      };
    })
    .filter((d): d is { round: number; gap: number; isFastest: boolean } => d !== null);

  if (!data.length) return emptyChart("Sin datos de brecha al más rápido");

  const gaps = data.map((d) => d.gap);
  const maxGap = Math.max(...gaps, 0.5);
  const minGap = Math.min(...gaps, 0);
  const range = Math.max(maxGap - minGap, 0.1);
  const pad = range * 0.15;
  const yMin = minGap - pad;
  const yMax = maxGap + pad;

  const labels = data.map((d) => `R${d.round}`);

  const points: ChartPoint[] = data.map((d, i) => ({
    x: i / Math.max(data.length - 1, 1),
    y: (d.gap - yMin) / (yMax - yMin),
    label: `R${d.round}`,
    value: d.gap === 0 ? "🟢 Más rápido" : `+${d.gap.toFixed(3)}s más lento`,
  }));

  return `${svgHeader()}
    <g class="text-on-surface">
      ${grid(yMin, yMax, 5, (v) => v === 0 ? "0" : `+${v.toFixed(1)}s`)}
      ${xLabels(data.length, labels)}
      ${polyline(points, color)}
      ${dots(points, color)}
    </g>
  </svg>`;
}

export function gapToTeammateChart(
  results: DriverRaceResult[],
  teammateResults: DriverRaceResult[],
  color: string,
): string {
  const teammateMap = new Map(teammateResults.map((r) => [r.round, r]));

  const data = results
    .map((r) => {
      const driverTime = parseLapTime(r.fastestLapTime);
      const tm = teammateMap.get(r.round);
      const tmTime = tm ? parseLapTime(tm.fastestLapTime) : null;
      if (driverTime === null || tmTime === null) return null;
      return {
        round: r.round,
        gap: driverTime - tmTime,
        driverFaster: driverTime < tmTime,
      };
    })
    .filter((d): d is { round: number; gap: number; driverFaster: boolean } => d !== null);

  if (!data.length) return emptyChart("Sin datos de brecha al teammate");

  const gaps = data.map((d) => d.gap);
  const maxGap = Math.max(...gaps.map(Math.abs), 0.5);
  const yMin = -maxGap * 1.15;
  const yMax = maxGap * 1.15;

  const labels = data.map((d) => `R${d.round}`);

  const points: ChartPoint[] = data.map((d, i) => ({
    x: i / Math.max(data.length - 1, 1),
    y: (d.gap - yMin) / (yMax - yMin),
    label: `R${d.round}`,
    value: d.gap === 0 ? "=" : d.driverFaster ? `${d.gap.toFixed(3)}s más rápido` : `+${Math.abs(d.gap).toFixed(3)}s más lento`,
  }));

  return `${svgHeader()}
    <g class="text-on-surface">
      ${grid(yMin, yMax, 5, (v) => v === 0 ? "=" : v > 0 ? `+${v.toFixed(1)}s` : `${v.toFixed(1)}s`)}
      ${xLabels(data.length, labels)}
      ${polyline(points, color)}
      ${dots(points, color)}
      <line x1="${PAD.left}" y1="${PAD.top + PH - (0 - yMin) / (yMax - yMin) * PH}" x2="${W - PAD.right}" y2="${PAD.top + PH - (0 - yMin) / (yMax - yMin) * PH}" stroke="currentColor" stroke-opacity="0.3" stroke-dasharray="4 2" />
    </g>
  </svg>`;
}
