/**
 * Shared HTTP helper: throttled fetch + 429 retry + in-memory TTL cache
 * with stale-on-error fallback. Used by openf1.ts and jolpica.ts so the
 * whole app respects third-party rate limits.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface FetchWithRetryOptions {
  retries?: number;
  /** ms mínimo entre requests (throttle cliente). Default 350. */
  minGapMs?: number;
}

interface CachedGetOptions extends FetchWithRetryOptions {
  /** TTL del caché en ms. Default 60 s. */
  ttlMs?: number;
}

let lastRequestAt = 0;
const DEFAULT_MIN_GAP = 350;

/**
 * Fetch con throttle (máx ~3 req/s) y retry exponencial ante 429,
 * respetando el header `Retry-After` cuando viene.
 */
export async function fetchWithRetry(
  url: string,
  { retries = 2, minGapMs = DEFAULT_MIN_GAP }: FetchWithRetryOptions = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const gap = Date.now() - lastRequestAt;
    if (gap < minGapMs) await sleep(minGapMs - gap);
    lastRequestAt = Date.now();

    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.status !== 429) return res;
    if (attempt >= retries) return res;

    const retryAfter = parseFloat(res.headers.get("Retry-After") ?? "");
    const wait = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : (attempt + 1) * 2000;
    await sleep(wait);
  }
}

const cache = new Map<string, { data: unknown; at: number }>();

/**
 * GET JSON con caché en memoria (stale-on-error). En `astro dev` el módulo
 * persiste entre recargas, así que evita re-golpear la API en cada HMR.
 */
export async function cachedGetJson<T>(
  url: string,
  { ttlMs = 60_000, ...retryOpts }: CachedGetOptions = {},
): Promise<T | null> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < ttlMs) return cached.data as T;
  try {
    const res = await fetchWithRetry(url, retryOpts);
    if (!res.ok) return cached ? (cached.data as T) : null;
    const data = (await res.json()) as T;
    cache.set(url, { data, at: Date.now() });
    return data;
  } catch {
    return cached ? (cached.data as T) : null;
  }
}
