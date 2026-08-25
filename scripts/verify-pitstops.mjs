/**
 * Verificación independiente:
 * Jolpica → OpenF1
 *
 * - Obtiene la carrera desde Jolpica
 * - Encuentra la sesión Race correspondiente en OpenF1
 * - Obtiene pit stops reales
 * - Obtiene Race Control
 * - Relaciona cada pit stop con el estado de carrera vigente
 *
 * Ejecutar:
 *   node scripts/verify-pitstops.mjs [round]
 *
 * Default:
 *   round 12 (Zandvoort)
 */

const ROUND = parseInt(process.argv[2] || "12", 10);

const JOLPICA = "https://api.jolpi.ca/ergast/f1";
const OPENF1 = "https://api.openf1.org/v1";

async function fetchJson(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} en ${url}`);
  }

  return res.json();
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ");
}

function formatSeconds(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "-- s";
  }

  return `${Number(value).toFixed(3)} s`;
}

function formatTime(dateValue) {
  if (!dateValue) return "--:--:--";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return date.toLocaleTimeString("es-AR", {
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

/**
 * Determina el estado visual según el mensaje de Race Control.
 *
 * 🔴 = bandera roja
 * 🟡 = bandera amarilla / VSC / SC
 * 🟢 = carrera normal
 */
function getRaceControlState(message) {
  const text = normalizeName(
    `${message?.category || ""} ${message?.flag || ""} ${message?.message || ""}`
  );

  // ROJA
  if (
    text.includes("red") ||
    text.includes("roja") ||
    text.includes("red flag")
  ) {
    return "🔴";
  }

  // AMARILLA
  if (
    text.includes("yellow") ||
    text.includes("amarilla") ||
    text.includes("double yellow") ||
    text.includes("safety car") ||
    text.includes("virtual safety car") ||
    text.includes("vsc") ||
    text.includes("sc")
  ) {
    return "🟡";
  }

  // VERDE
  if (
    text.includes("green") ||
    text.includes("verde") ||
    text.includes("green flag")
  ) {
    return "🟢";
  }

  return null;
}

/**
 * Devuelve el estado de Race Control vigente
 * inmediatamente antes del pit stop.
 */
function getStateAtPit(pit, raceControl) {
  const pitDate = new Date(pit.date).getTime();

  if (!Number.isFinite(pitDate)) {
    return "🟢";
  }

  let state = "🟢";

  for (const rc of raceControl) {
    const rcDate = new Date(rc.date).getTime();

    if (!Number.isFinite(rcDate)) {
      continue;
    }

    if (rcDate > pitDate) {
      break;
    }

    const detectedState = getRaceControlState(rc);

    if (detectedState) {
      state = detectedState;
    }
  }

  return state;
}

/**
 * Convierte los pilotos de Jolpica a un mapa por número.
 */
function buildDriverMap(race) {
  const map = new Map();

  const results = race?.Results || [];

  for (const result of results) {
    const number = String(result.number || "").trim();

    if (!number) continue;

    const givenName = result.Driver?.givenName || "";
    const familyName = result.Driver?.familyName || "";

    const fullName = `${givenName} ${familyName}`.trim();

    map.set(number, {
      number,
      name: fullName || result.Driver?.driverId || number,
      driverId: result.Driver?.driverId || null,
    });
  }

  return map;
}

/**
 * Fallback para nombres conocidos.
 *
 * OpenF1 utiliza números de piloto.
 * Jolpica puede no tener todos los datos cuando
 * la temporada todavía está incompleta.
 */
const DRIVER_NAMES = {
  "1": "verstappen",
  "2": "russell",
  "3": "antonelli",
  "4": "alonso",
  "5": "bortoleto",
  "6": "hadjar",
  "10": "gasly",
  "11": "perez",
  "12": "antonelli",
  "14": "alonso",
  "16": "leclerc",
  "18": "stroll",
  "22": "tsunoda",
  "23": "albon",
  "24": "lawson",
  "27": "hulkenberg",
  "30": "lawson",
  "31": "ocon",
  "43": "colapinto",
  "44": "hamilton",
  "55": "sainz",
  "63": "russell",
  "77": "bottas",
  "81": "piastri",
  "87": "bearman",
  "99": "nico",
};

function getDriverName(driverNumber, driverMap) {
  const number = String(driverNumber);

  if (driverMap.has(number)) {
    const driver = driverMap.get(number);

    return normalizeName(driver.name).replace(/\s+/g, "_");
  }

  return DRIVER_NAMES[number] || `driver_${number}`;
}

async function main() {
  console.log("═".repeat(70));
  console.log(`  Verificación de datos — Ronda ${ROUND}`);
  console.log("═".repeat(70));

  // ============================================================
  // 1. JOLPICA
  // ============================================================

  console.log(
    `\n📋 Paso 1: Jolpica — obtener carrera de ronda ${ROUND}`
  );

  const raceJson = await fetchJson(
    `${JOLPICA}/2026/${ROUND}/results.json`
  );

  const race = raceJson?.MRData?.RaceTable?.Races?.[0];

  if (!race) {
    console.error(
      `  ❌ No se encontró la carrera en Jolpica para ronda ${ROUND}`
    );

    process.exit(1);
  }

  console.log(`  ✅ Carrera: ${race.raceName}`);
  console.log(
    `     Circuito: ${race.Circuit?.circuitName}`
  );
  console.log(
    `     Ciudad: ${race.Circuit?.Location?.locality}, ${race.Circuit?.Location?.country}`
  );
  console.log(`     Fecha: ${race.date}`);

  const driverMap = buildDriverMap(race);

  // ============================================================
  // 2. OPENF1 — SESIONES
  // ============================================================

  console.log("\n📋 Paso 2: OpenF1 — buscar sesiones de 2026");

  const sessionsJson = await fetchJson(
    `${OPENF1}/sessions?year=2026`
  );

  const sessions = Array.isArray(sessionsJson)
    ? sessionsJson
    : [];

  console.log(`  Total sesiones 2026: ${sessions.length}`);

  const raceSessions = sessions.filter(
    (s) =>
      s.session_type === "Race" &&
      !(s.session_name || "")
        .toLowerCase()
        .includes("sprint")
  );

  console.log(
    `  Sesiones tipo "Race" sin Sprint: ${raceSessions.length}`
  );

  // ============================================================
  // 3. ENCONTRAR SESIÓN
  // ============================================================

  console.log(
    "\n📋 Paso 3: Buscar sesión de carrera correspondiente"
  );

  const circuitName = race.Circuit?.circuitName || "";

  const circuitShort = circuitName
    .replace(/Grand Prix/gi, "")
    .replace(/Circuit/gi, "")
    .replace(/Autodromo/gi, "")
    .replace(/Autódromo/gi, "")
    .trim()
    .toLowerCase();

  const country = (
    race.Circuit?.Location?.country || ""
  )
    .trim()
    .toLowerCase();

  console.log(
    `  Circuito Jolpica: "${circuitShort}"`
  );

  console.log(`  País Jolpica: "${country}"`);

  let matchedSession = raceSessions.find((s) => {
    const sName = (
      s.circuit_short_name || ""
    )
      .trim()
      .toLowerCase();

    return (
      sName === circuitShort ||
      circuitShort.includes(sName) ||
      sName.includes(circuitShort)
    );
  });

  // Fallback país
  if (!matchedSession) {
    matchedSession = raceSessions.find((s) => {
      const sCountry = (
        s.country_name || ""
      )
        .trim()
        .toLowerCase();

      return sCountry === country;
    });
  }

  // Fallback fecha
  if (!matchedSession) {
    console.log("  ⚠️ Buscando por fecha...");

    matchedSession = raceSessions.find((s) =>
      s.date_start?.startsWith(race.date)
    );
  }

  if (!matchedSession) {
    console.error(
      "  ❌ No se pudo encontrar la sesión de OpenF1"
    );

    process.exit(1);
  }

  console.log("\n  ✅ Sesión encontrada:");

  console.log(
    `     session_key: ${matchedSession.session_key}`
  );

  console.log(
    `     meeting_key: ${matchedSession.meeting_key}`
  );

  console.log(
    `     circuit_short_name: ${matchedSession.circuit_short_name}`
  );

  console.log(
    `     country_name: ${matchedSession.country_name}`
  );

  console.log(
    `     session_name: ${matchedSession.session_name}`
  );

  console.log(
    `     date_start: ${matchedSession.date_start}`
  );

  const sessionKey = matchedSession.session_key;

  // ============================================================
  // 4. PIT STOPS
  // ============================================================

  console.log(
    "\n📋 Paso 4: OpenF1 — obtener pit stops"
  );

  const pitsJson = await fetchJson(
    `${OPENF1}/pit?session_key=${sessionKey}`
  );

  const pits = Array.isArray(pitsJson)
    ? pitsJson
    : [];

  console.log(
    `  Total pit stops: ${pits.length}`
  );

  if (pits.length === 0) {
    console.log(
      "  ⚠️ OpenF1 no devolvió pit stops."
    );
  }

  // ============================================================
  // 5. RACE CONTROL
  // ============================================================

  console.log(
    "\n📋 Paso 5: OpenF1 — obtener Race Control"
  );

  const rcJson = await fetchJson(
    `${OPENF1}/race_control?session_key=${sessionKey}`
  );

  const raceControl = Array.isArray(rcJson)
    ? rcJson
    : [];

  console.log(
    `  Total mensajes Race Control: ${raceControl.length}`
  );

  // IMPORTANTE:
  // Ordenamos ambos datasets cronológicamente.
  pits.sort(
    (a, b) =>
      new Date(a.date).getTime() -
      new Date(b.date).getTime()
  );

  raceControl.sort(
    (a, b) =>
      new Date(a.date).getTime() -
      new Date(b.date).getTime()
  );

  // ============================================================
  // 6. MOSTRAR MENSAJES RC IMPORTANTES
  // ============================================================

  console.log(
    "\n📋 Paso 6: Estados de Race Control detectados"
  );

  const states = raceControl
    .map((rc) => ({
      ...rc,
      state: getRaceControlState(rc),
    }))
    .filter((rc) => rc.state);

  console.log(
    `  Cambios de estado detectados: ${states.length}`
  );

  states.forEach((rc) => {
    console.log(
      `    ${rc.state} ${formatTime(rc.date)} | lap=${rc.lap_number ?? "--"} | ${rc.message || ""}`
    );
  });

  // ============================================================
  // 7. CONSTRUIR RESULTADO FINAL
  // ============================================================

  console.log(
    "\n📋 Paso 7: Construir tabla final"
  );

  const result = [];

  for (const pit of pits) {
    const driverNumber = String(
      pit.driver_number ?? ""
    );

    const driverName = getDriverName(
      driverNumber,
      driverMap
    );

    const lap = pit.lap_number ?? "--";

    const duration =
      pit.stop_duration != null
        ? Number(pit.stop_duration)
        : null;

    const state = getStateAtPit(
      pit,
      raceControl
    );

    result.push({
      stop: null,
      lap,
      driver: driverName,
      duration,
      state,
      time: formatTime(pit.date),
      rawDate: pit.date,
      driverNumber,
    });
  }

  // Numerar las paradas
  let currentStop = 0;

  for (const item of result) {
    currentStop++;
    item.stop = currentStop;
  }

  // ============================================================
  // 8. TABLA
  // ============================================================

  console.log("\n");
  console.log(
    "Nº | Vuelta | Piloto              | Duración    | RC | Hora"
  );

  console.log(
    "───┼────────┼─────────────────────┼─────────────┼────┼──────────"
  );

  for (const item of result) {
    const stop = String(item.stop).padStart(2);

    const lap = String(item.lap).padStart(6);

    const driver = String(item.driver)
      .padEnd(19);

    const duration = item.duration != null
      ? `${item.duration.toFixed(3)} s`.padStart(11)
      : "-- s".padStart(11);

    console.log(
      `${stop} | ${lap} | ${driver} | ${duration} | ${item.state} | ${item.time}`
    );
  }

  // ============================================================
  // 9. VERIFICACIÓN DE DURACIONES
  // ============================================================

  console.log(
    "\n📋 Paso 8: Verificación de duraciones"
  );

  const durations = result
    .map((p) => p.duration)
    .filter(
      (v) =>
        Number.isFinite(v) &&
        v > 0
    );

  if (durations.length > 0) {
    const avg =
      durations.reduce(
        (a, b) => a + b,
        0
      ) / durations.length;

    const min = Math.min(...durations);
    const max = Math.max(...durations);

    console.log(
      `  Paradas con duración válida: ${durations.length}`
    );

    console.log(
      `  Promedio: ${avg.toFixed(3)} s`
    );

    console.log(
      `  Mínimo: ${min.toFixed(3)} s`
    );

    console.log(
      `  Máximo: ${max.toFixed(3)} s`
    );

    // Detectar valores sospechosos
    const suspicious = result.filter(
      (p) =>
        p.duration != null &&
        (
          p.duration < 1 ||
          p.duration > 60
        )
    );

    if (suspicious.length > 0) {
      console.log(
        `\n  ⚠️ Valores sospechosos: ${suspicious.length}`
      );

      suspicious.forEach((p) => {
        console.log(
          `     V${p.lap} ${p.driver}: ${p.duration}s`
        );
      });
    } else {
      console.log(
        "  ✅ Todas las duraciones están dentro de un rango razonable."
      );
    }
  }

  // ============================================================
  // 10. RESUMEN
  // ============================================================

  console.log("\n" + "═".repeat(70));
  console.log("  RESUMEN DE VERIFICACIÓN");
  console.log("═".repeat(70));

  console.log(
    `  Jolpica Round: ${ROUND}`
  );

  console.log(
    `  Race: ${race.raceName}`
  );

  console.log(
    `  OpenF1 session_key: ${sessionKey}`
  );

  console.log(
    `  Pit stops: ${pits.length}`
  );

  console.log(
    `  Race Control: ${raceControl.length}`
  );

  console.log(
    `  Estados RC detectados: ${states.length}`
  );

  console.log(
    `  Registros finales: ${result.length}`
  );

  console.log(
    "\n  ✅ Verificación finalizada."
  );

  console.log(
    "═".repeat(70)
  );
}

main().catch((error) => {
  console.error(
    "\n❌ Error:",
    error.message
  );

  process.exit(1);
});