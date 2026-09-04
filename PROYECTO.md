# F-Uno Center — Resumen técnico del proyecto

> Documento de contexto para retomar el trabajo. Leelo y ya sabés de qué se trata.

## Qué es

Dashboard web de Formula 1 (estático) que agrega calendario, clasificaciones,
resultados, pilotos con perfiles, posiciones en vivo y noticias en español,
usando APIs abiertas gratuitas. Sitio no oficial, en español (es-ES).

## Stack

- **Astro 5** (build 100% estático, generación de rutas dinámicas en build) + TypeScript
- **Tailwind CSS v4** (plugin `@tailwindcss/vite`)
- **pnpm** como gestor (NO usar npm; `package-lock.json` fue eliminado)
- Fuentes de datos (todas REST, sin key):
  - **OpenF1** (`https://api.openf1.org/v1`) — pilotos, sesiones del fin de semana,
    vueltas y sectores (`/laps`), stints (`/stints`), pits (`/pit`),
    clima (`/weather`), race control (`/race_control`), posiciones en vivo
  - **Jolpica-F1** (`https://api.jolpi.ca/ergast/f1`) — calendario, clasificaciones,
    pilotos, constructores, resultados de carrera, clasificación (Q1/Q2/Q3),
    sprint y pit stops por ronda
  - **Feeds RSS Motorsport.com ES/LAT** — noticias en español
  - **Wikipedia API** — imágenes de pilotos (solo fallback)

## Comandos

```bash
pnpm install      # instalar (pnpm approve-builds si es necesario)
pnpm run dev      # dev server → http://localhost:4321
pnpm run build    # genera dist/ estático (53 páginas aprox)
pnpm run preview  # sirve dist/
```

## Estructura

```
src/
├── pages/                    # rutas
│   ├── index.astro           # home: countdown, ticker en vivo, top 5 c/u, noticias
│   ├── calendario.astro      # calendario + resultados de la temporada
│   ├── clasificaciones.astro # pilotos + constructores
│   ├── pilotos.astro         # grid de pilotos (clic → perfil)
│   ├── pilotos/[slug].astro  # perfil dinámico (getStaticPaths por driverId)
│   ├── noticias.astro        # noticias agregadas
│   ├── noticias/[slug].astro # detalle de noticia
│   ├── resultados.astro      # FIN DE SEMANA COMPLETO por GP: Carrera, Clasificación
│   │                         # (Q1/Q2/Q3 Jolpica), Sprint + Sprint Quali (Jolpica/OpenF1),
│   │                         # FP1/FP2/FP3 (OpenF1 mejor vuelta) y Boxes con estado RC
│   │                         # (cruce Jolpica+OpenF1). Todo client-side, selector por ronda (?round=)
│   ├── resultadosD.astro     # duplicado legacy de resultados (pendiente eliminar o redirigir)
│   ├── gp-actual.astro       # GP actual (OpenF1): selector de sesión del meeting,
│   │                         # tabla de mejores vueltas + clima + race control
│   ├── envivo.astro          # vivo: leaderboard, stints, pits, race control
│   ├── donar.astro / contacto.astro
├── components/               # Navbar, Footer, Sidebar, DriverGrid, StandingsTable,
│                              # CalendarList, Countdown, LiveTicker, NewsGrid,
│                              # Circuit3D, CircuitDialog, LocalTime, live/*
├── layouts/Layout.astro      # shell HTML + navbar + footer
└── lib/                      # lógica (ver abajo)
```

## Capa de datos (`src/lib`)

| Archivo | Rol |
|---|---|
| `openf1.ts` | Cliente OpenF1: sessions, drivers, championship, position, intervals, stints, pit, weather, laps, race_control |
| `jolpica.ts` | Cliente Jolpica: standings, calendar (con horarios FP/Quali/Sprint y flag `sprint`), season drivers/constructors, race/qualifying/pitstops/sprint detail por ronda, resultados por piloto, fastest laps |
| `standings.ts` | Fusiona Jolpica (fallback OpenF1 championship) + colores de OpenF1 → `StandingRow[]` |
| `drivers.ts` | **`getDriverProfiles()`**: fusiona OpenF1 + Jolpica + constructores + standings → `DriverProfile[]`. Resuelve headshots con fallback a Wikipedia si F1 Media tiene placeholder (detección por tamaño <10KB). Caché en memoria de módulo (placeholderCache, wikiImageCache) |
| `news.ts` | Fetch de 2 feeds RSS en español, dedupe por título, orden por fecha |
| `utils.ts` | `teamColor`, `formatDate/Time`, `pad`, `flagEmoji`, `nationalityEs`, `headshotTransform` (cambia `.transform/1col/` → 2col/4col para mayor resolución) |
| `types.ts` | Interfaces compartidas (`DriverProfile`, `Race`, `StandingRow`, etc.) |
| `fetch.ts` | `cachedGetJson` con TTL (usado por `openf1.ts` y `jolpica.ts`) |
| `circuits.ts` / `circuit-data.ts` | Metadatos y trazados SVG de circuitos |
| `live-service.ts` / `charts.ts` | Lógica de la página en vivo y gráficos |

**Filosofía**: cada fuente tiene fallback — si una API cae, la página muestra
"no disponible" en vez de romper el build. Las páginas de contenido
(index, calendario, clasificaciones, pilotos, noticias) resuelven datos en el
build (embebidos en HTML). Las páginas de fin de semana (`resultados`,
`gp-actual`, `envivo`) consultan Jolpica/OpenF1 **client-side** en el navegador:
no rompen el build pero dependen de CORS + rate-limit de las APIs. Lo único
client-side permanente además de eso es el ticker en vivo.

**Página `resultados` (fin de semana completo)**: dos `<script>` independientes.
El 1º (existente) maneja Carrera (Jolpica) + Boxes (cruce Jolpica `pitstops` con
OpenF1 `pit` + intervalos SC/VSC/RED construidos desde `race_control` por vuelta).
El 2º (agregado después, envuelto en IIFE para no redeclarar `const` globales)
maneja Clasificación (Jolpica `qualifying.json`), Sprint (Jolpica `sprint.json`)
y SQ/FP1/FP2/FP3 (OpenF1 `sessions` del mismo `meeting_key` + `drivers`/`laps`,
ordenados por mejor vuelta). Los tabs Sprint/SQ se ocultan si `races.json` no
trae `Sprint`; en fines Sprint no hay FP2/FP3 (solo FP1). Carga perezosa con
delay ~300ms entre llamadas y caché por `session_key`.

## Detalles clave / bugs ya resueltos

1. **Jolpica usa `StandingsTable` para pilotos Y constructores** (no
   `ConstructorStandingsTable`). El tipo `MrData` refleja eso.
2. **22 pilotos** en la parrilla 2026 (no 20). El texto del grid usa
   `{drivers.length}` dinámico.
3. **Imágenes de pilotos**: OpenF1 da URLs `.transform/1col/` (93px, pixeladas).
   Se usa 2col (grid) / 4col (perfil). Antonelli, Lindblad y Bearman no tienen
   foto en F1 Media → fallback a Wikipedia (el build detecta el placeholder y
   usa la API de Wikipedia).
4. **Nacionalidades** vienen en inglés de la API → traducidas con
   `nationalityEs()` + bandera emoji con `flagEmoji()`.
5. **Noticias**: BBC/Autosport/PlanetF1 fueron reemplazados por Motorsport.com
   ES y LAT (en español). El feed de sport.es devuelve canal vacío.
6. **pnpm**: los scripts de build de esbuild/sharp están aprobados en
   `package.json` → `pnpm.onlyBuiltDependencies`.

## Branding

- Nombre: **F-Uno Center** (navbar: badge "F1" + texto "UNO CENTER")
- Footer con disclaimer legal completo de Formula One Licensing B.V.
- Favicon SVG embebido en `Layout.astro` (cuadro rojo #e10600 + "F1")
- `package.json` → name `f-uno-center`. La carpeta sigue llamándose `f1-dashboard`
  (pendiente renombrar a `f-uno-center` si se desea)
- El README.md cubre el uso; este archivo es el contexto técnico

## Estado del proyecto

Completo y funcionando: 53 páginas, build OK, todo en español. Repo git en
`github.com/hugogoncalvez/F-UNO_Dashboard`, rama `main`. Falta:

1. **Deploy en Vercel** (free tier, Astro detecta automático).
2. (Opcional) Renombrar la carpeta `f1-dashboard` → `f-uno-center`.
3. (Opcional) Eliminar o redirigir `resultadosD.astro` (duplicado legacy de `resultados`).
4. **Nota OpenF1 2026**: el tier free ahora es solo datos históricos; el en vivo
   durante sesiones requiere sponsor (€9.90/mes). El `LiveTicker` usa
   `session_key=latest` y solo funciona en ventanas de GP. Las páginas
   `gp-actual`/`envivo`/`resultados` muestran estado "restringido / sin datos"
   cuando OpenF1 devuelve 401 en sesión activa.
5. **Límites conocidos Jolpica**: los endpoints `/ergast` clásicos NO tienen
   tiempos de FP ni Sprint Quali (solo horarios en `races.json`); por eso
   FP/SQ salen de OpenF1. Nombres de sesión OpenF1 varían por año
   (`Sprint Qualifying` vs `Sprint Shootout`, `Practice 1/2/3`).

## APIs externas usadas (resumen rápido)

- `https://api.openf1.org/v1/drivers?session_key=latest` → 22 pilotos actuales
- `https://api.jolpi.ca/ergast/f1/current/{driverstandings,constructorstandings,drivers,constructors}.json`
- `https://api.jolpi.ca/ergast/f1/{año}/races.json` → calendario (incluye horarios FP/Quali/Sprint y flag de finde Sprint)
- `https://api.jolpi.ca/ergast/f1/{año}/{round}/{results,qualifying,sprint,pitstops}.json` → fin de semana por ronda
- `https://api.openf1.org/v1/{sessions,laps,drivers,stints,pit,weather,race_control,position,intervals}?session_key=` → sesiones y detalle
- `https://es.motorsport.com/rss/f1/news/` y `https://lat.motorsport.com/rss/f1/news/`
- `https://{es,en}.wikipedia.org/w/api.php?...&prop=pageimages` → headshots fallback
