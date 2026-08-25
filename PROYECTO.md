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
  - **OpenF1** (`https://api.openf1.org/v1`) — pilotos actuales, posiciones en vivo
  - **Jolpica-F1** (`https://api.jolpi.ca/ergast/f1`) — calendario, clasificaciones, pilotos, constructores
  - **Feeds RSS Motorsport.com ES/LAT** — noticias en español
  - **Wikipedia API** — imágenes de pilotos (solo fallback)

## Comandos

```bash
pnpm install      # instalar (pnpm approve-builds si es necesario)
pnpm run dev      # dev server → http://localhost:4321
pnpm run build    # genera dist/ estático (27 páginas aprox)
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
│   └── noticias.astro        # noticias agregadas
├── components/               # Navbar, Footer, DriverGrid, StandingsTable,
│                              # CalendarList, Countdown, LiveTicker, NewsGrid
├── layouts/Layout.astro      # shell HTML + navbar + footer
└── lib/                      # lógica (ver abajo)
```

## Capa de datos (`src/lib`)

| Archivo | Rol |
|---|---|
| `openf1.ts` | Cliente OpenF1: drivers, championship_drivers, position, intervals, sessions |
| `jolpica.ts` | Cliente Jolpica: driver/constructor standings, calendar, season drivers, constructors |
| `standings.ts` | Fusiona Jolpica (fallback OpenF1 championship) + colores de OpenF1 → `StandingRow[]` |
| `drivers.ts` | **`getDriverProfiles()`**: fusiona OpenF1 + Jolpica + constructores + standings → `DriverProfile[]`. Resuelve headshots con fallback a Wikipedia si F1 Media tiene placeholder (detección por tamaño <10KB). Caché en memoria de módulo (placeholderCache, wikiImageCache) |
| `news.ts` | Fetch de 2 feeds RSS en español, dedupe por título, orden por fecha |
| `utils.ts` | `teamColor`, `formatDate/Time`, `pad`, `flagEmoji`, `nationalityEs`, `headshotTransform` (cambia `.transform/1col/` → 2col/4col para mayor resolución) |
| `types.ts` | Interfaces compartidas (`DriverProfile`, `Race`, `StandingRow`, etc.) |

**Filosofía**: cada fuente tiene fallback — si una API cae, la página muestra
"no disponible" en vez de romper el build. Todas las llamadas se hacen en el
build (datos embebidos en HTML). Lo único client-side es el ticker en vivo.

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

Completo y funcionando: 27 páginas, build OK, todo en español. Falta:

1. **Subir a GitHub + deploy en Vercel** (free tier, Astro detecta automático).
   No hay repo git todavía (`git init` pendiente).
2. (Opcional) Renombrar la carpeta `f1-dashboard` → `f-uno-center`.
3. **Features futuras posibles** (datos ya disponibles en OpenF1, sin costo
   histórico): vueltas y sectores (`/laps`), neumáticos y stints (`/stints`),
   pit stops (`/pit`), clima (`/weather`), telemetría (`/car_data`).
4. **Nota OpenF1 2026**: el tier free ahora es solo datos históricos; el en vivo
   durante sesiones requiere sponsor (€9.90/mes). El `LiveTicker` usa
   `session_key=latest` y solo funciona en ventanas de GP.

## APIs externas usadas (resumen rápido)

- `https://api.openf1.org/v1/drivers?session_key=latest` → 22 pilotos actuales
- `https://api.jolpi.ca/ergast/f1/current/{driverstandings,constructorstandings,drivers,constructors}.json`
- `https://api.jolpi.ca/ergast/f1/{año}/races.json` → calendario
- `https://es.motorsport.com/rss/f1/news/` y `https://lat.motorsport.com/rss/f1/news/`
- `https://{es,en}.wikipedia.org/w/api.php?...&prop=pageimages` → headshots fallback
