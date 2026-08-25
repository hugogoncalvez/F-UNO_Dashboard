/**
 * Genera src/lib/circuit-data.ts a partir de los GeoJSON de
 * bacinger/f1-circuits (MIT). Emite el path `d` de cada circuito en su
 * propia coordenada (viewBox w×h), la longitud real del trazado y el punto
 * de salida (primer punto del GeoJSON = línea de meta).
 * Uso: node scripts/generate-circuits.mjs
 */
import { writeFile } from "node:fs/promises";

const BASE = "https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits";

const CIRCUITS = [
  { title: "Albert Park Circuit", id: "au-1953" },
  { title: "Shanghai International Circuit", id: "cn-2004" },
  { title: "Suzuka International Racing Course", id: "jp-1962" },
  { title: "Miami International Autodrome", id: "us-2022" },
  { title: "Circuit Gilles Villeneuve", id: "ca-1978" },
  { title: "Circuit de Monaco", id: "mc-1929" },
  { title: "Circuit de Barcelona-Catalunya", id: "es-1991" },
  { title: "Red Bull Ring", id: "at-1969" },
  { title: "Silverstone Circuit", id: "gb-1948" },
  { title: "Circuit de Spa-Francorchamps", id: "be-1925" },
  { title: "Hungaroring", id: "hu-1986" },
  { title: "Circuit Zandvoort", id: "nl-1948" },
  { title: "Monza Circuit", id: "it-1922" },
  { title: "Madring", id: "es-2026" },
  { title: "Baku City Circuit", id: "az-2016" },
  { title: "Sepang International Circuit", id: "my-1999" },
  { title: "Marina Bay Street Circuit", id: "sg-2008" },
  { title: "Circuit of the Americas", id: "us-2012" },
  { title: "Autódromo Hermanos Rodríguez", id: "mx-1962" },
  { title: "Interlagos Circuit", id: "br-1940" },
  { title: "Las Vegas Grand Prix", id: "us-2023" },
  { title: "Lusail International Circuit", id: "qa-2004" },
  { title: "Yas Marina Circuit", id: "ae-2009" },
];

async function fetchGeoJson(id) {
  const res = await fetch(`${BASE}/${id}.geojson`);
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  return res.json();
}

function polylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return len;
}

/** Convierte el LineString a path `d` en un viewBox w×h sin letterbox. */
function toPath(coords) {
  const pts = coords.filter(
    (p, i) => i === 0 || p[0] !== coords[0][0] || p[1] !== coords[0][1],
  );
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [lon, lat] of pts) {
    if (lon < minX) minX = lon;
    if (lon > maxX) maxX = lon;
    if (lat < minY) minY = lat;
    if (lat > maxY) maxY = lat;
  }
  const pad = Math.max(maxX - minX, maxY - minY) * 0.08;
  minX -= pad; maxX += pad; minY -= pad; maxY += pad;
  const rawW = maxX - minX;
  const rawH = maxY - minY;
  const scale = 1000 / Math.max(rawW, rawH);
  const w = rawW * scale;
  const h = rawH * scale;

  const mapped = pts.map(([lon, lat]) => [
    (lon - minX) * scale,
    (maxY - lat) * scale,
  ]);
  const d = "M" + mapped.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" L") + " Z";

  // Muro de extrusión: quads por segmento (p_i → p_{i+1} → p_{i+1}+OFF →
  // p_i+OFF). Cada tramo es un polígono cerrado independiente; el navegador
  // los superpone y el relleno queda sólido incluso en cruces (Suzuka) y
  // curvas herradura cerradas, sin huecos ni picos del macro-polígono único.
  const OFF_X = 12;
  const OFF_Y = 62;
  const wallSegments = [];
  for (let i = 0; i < mapped.length; i++) {
    const [x1, y1] = mapped[i];
    const [x2, y2] = mapped[(i + 1) % mapped.length];
    wallSegments.push(
      `M${x1.toFixed(2)},${y1.toFixed(2)}L${x2.toFixed(2)},${y2.toFixed(2)}L${(x2 + OFF_X).toFixed(2)},${(y2 + OFF_Y).toFixed(2)}L${(x1 + OFF_X).toFixed(2)},${(y1 + OFF_Y).toFixed(2)}Z`,
    );
  }
  const wallD = wallSegments.join(" ");

  const [sx, sy] = mapped[0];
  return {
    d,
    wallD,
    length: polylineLength(mapped),
    startX: sx,
    startY: sy,
    w,
    h,
  };
}

const out = [];
const entries = [];
const metaEntries = [];
for (const c of CIRCUITS) {
  try {
    const data = await fetchGeoJson(c.id);
    const feature = data.features[0];
    const coords = feature?.geometry?.coordinates;
    if (!coords) throw new Error(`${c.id}: sin geometría`);
    const props = feature?.properties ?? {};
    const { d, wallD, length, startX, startY, w, h } = toPath(coords);
    entries.push(
      `  "${c.id}": { d: "${d}", wallD: "${wallD}", length: ${length.toFixed(1)}, startX: ${startX.toFixed(2)}, startY: ${startY.toFixed(2)}, w: ${w.toFixed(2)}, h: ${h.toFixed(2)} },`,
    );
    metaEntries.push(
      `  "${c.id}": { name: ${JSON.stringify(props.Name ?? "")}, location: ${JSON.stringify(props.Location ?? "")}, opened: ${props.opened ?? null}, firstGP: ${props.firstgp ?? null}, lengthMeters: ${props.length ?? null}, altitude: ${props.altitude ?? null} },`,
    );
    out.push(`  ${c.title.padEnd(35)} ${c.id} (${coords.length} pts)`);
  } catch (e) {
    out.push(`  ${c.title.padEnd(35)} ERROR: ${e.message}`);
  }
}

const moduleSrc = `import type { CircuitMeta, CircuitPath } from "./types";

export const CIRCUIT_PATHS: Record<string, CircuitPath> = {
${entries.join("\n")}
};

export const CIRCUIT_META: Record<string, CircuitMeta> = {
${metaEntries.join("\n")}
};
`;

await writeFile("src/lib/circuit-data.ts", moduleSrc);
console.log(`Generados ${entries.length} circuitos:\n` + out.join("\n"));