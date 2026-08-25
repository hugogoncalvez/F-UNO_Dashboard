# F-Uno Center

Dashboard de Formula 1 con datos de APIs abiertas: calendario, clasificaciones,
resultados, pilotos, posiciones en vivo y noticias agregadas en español.

## Stack

- [Astro](https://astro.build) (estático) + TypeScript
- Tailwind CSS v4
- Fuentes de datos:
  - [OpenF1](https://openf1.org) — posiciones en vivo, drivers, telemetría
  - [Jolpica-F1](https://jolpi.ca) — calendario, resultados, clasificaciones
  - Feeds RSS — Motorsport.com (ES y LAT)

## Desarrollo

```bash
pnpm install
pnpm run dev
```

## Build

```bash
pnpm run build
pnpm run preview
```

## Deploy en Vercel (free tier)

1. Sube el proyecto a GitHub.
2. En [vercel.com](https://vercel.com) → *New Project* → importa el repo.
3. Vercel detecta Astro automáticamente. Deploy directo.

Los datos estáticos se generan en el build. Las posiciones en vivo se consultan
desde el navegador contra OpenF1 durante los fines de semana de GP.

## Notas

- El build no falla si una API está caída: cada fuente tiene fallback y muestra
  "no disponible".
- Los datos históricos de OpenF1 son gratis; el modo en vivo requiere datos de
  la sesión en curso (solo disponibles durante fines de semana de GP).
# F-UNO_Dashboard
