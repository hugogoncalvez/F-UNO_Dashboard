/**
 * scripts/fetch-news.mjs
 *
 * Obtiene el RSS de F1, descarga el contenido HTML real de cada nota
 * para pasarle contexto completo a Groq (Qwen 3.8-27b), respetando
 * el límite de 8,000 TPM.
 *
 * Usage: node scripts/fetch-news.mjs
 * Requires: GROQ_API_KEY environment variable
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const DATA_DIR = join(PROJECT_ROOT, "src", "data");
const NEWS_FILE = join(DATA_DIR, "noticias.json");
const PROCESSED_FILE = join(DATA_DIR, "processed-ids.json");

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = "qwen/qwen3.8-27b";
const MAX_NEWS_PER_RUN = 5;
const MAX_ARTICLES = 20;
const DELAY_MS = 7000;

if (!GROQ_API_KEY) {
  console.error("Error: GROQ_API_KEY environment variable is required");
  process.exit(1);
}

const FEEDS = [
  { name: "Motorsport.com ES", url: "https://es.motorsport.com/rss/f1/news/" },
  { name: "Motorsport.com LAT", url: "https://lat.motorsport.com/rss/f1/news/" },
];

const TEAMS = [
  { slug: "ferrari", color: "#E8002D", keywords: ["ferrari", "scuderia", "maranello"] },
  { slug: "mclaren", color: "#FF8000", keywords: ["mclaren", "papaya"] },
  { slug: "redbull", color: "#3671C6", keywords: ["red bull", "redbull"] },
  { slug: "mercedes", color: "#27F4D2", keywords: ["mercedes"] },
  { slug: "aston-martin", color: "#229971", keywords: ["aston martin"] },
  { slug: "alpine", color: "#0093CC", keywords: ["alpine", "renault"] },
  { slug: "williams", color: "#64C4FF", keywords: ["williams"] },
  { slug: "haas", color: "#B6BABD", keywords: ["haas"] },
  { slug: "rb", color: "#6692FF", keywords: ["rb ", "vcarb", "racing bulls"] },
  { slug: "sauber", color: "#52E252", keywords: ["sauber", "kick sauber", "audi"] },
  { slug: "cadillac", color: "#1e1e1e", keywords: ["cadillac", "gmp"] },
];

const DRIVERS = {
  hamilton: "ferrari", leclerc: "ferrari", sainz: "ferrari",
  norris: "mclaren", piastri: "mclaren",
  verstappen: "redbull", hadjar: "redbull",
  russell: "mercedes", antonelli: "mercedes",
  alonso: "aston-martin", stroll: "aston-martin",
  gasly: "alpine", colapinto: "alpine",
  albon: "williams", "sainz jr": "williams",
  bearman: "haas", ocon: "haas",
  tsunoda: "rb", lawson: "rb",
  hulkenberg: "sauber", bortoleto: "sauber",
  bottas: "sauber", perez: "cadillac",
  doohan: "alpine", newey: "aston-martin",
};

function detectTeam(text) {
  const lower = text.toLowerCase();
  const teamsFound = new Set();

  for (const [driver, team] of Object.entries(DRIVERS)) {
    if (lower.includes(driver)) teamsFound.add(team);
  }

  for (const team of TEAMS) {
    for (const kw of team.keywords) {
      if (lower.includes(kw)) teamsFound.add(team.slug);
    }
  }

  if (teamsFound.size === 0) {
    const isGeneral = /piloto|contrato|fichaje|mercado|vin[cú]los|silly season|grid|parrilla/i.test(lower);
    return { team: isGeneral ? "pilotos" : "general", color: "#e10600" };
  }

  if (teamsFound.size > 1) {
    return { team: "pilotos", color: "#e10600" };
  }

  const teamSlug = [...teamsFound][0];
  const teamData = TEAMS.find((t) => t.slug === teamSlug);
  return { team: teamSlug, color: teamData?.color ?? "#e10600" };
}

function makeSlug(title) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

async function loadJson(path, fallback) {
  try {
    if (existsSync(path)) return JSON.parse(await readFile(path, "utf-8"));
  } catch { /* ignore */ }
  return fallback;
}

async function saveJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml))) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${tag}>`, "i"));
      return m ? m[1].trim() : "";
    };
    items.push({
      title: get("title"),
      link: get("link"),
      pubDate: get("pubDate"),
      description: get("description"),
    });
  }
  return items;
}

/**
 * Descarga el HTML del artículo y extrae el texto limpio de los párrafos.
 */
async function fetchArticleBody(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FUnoCenter/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const html = await res.text();

    // Prefer <article> tag → ms-article__body class → fallback to all <p>
    let content = "";
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      content = articleMatch[1];
    } else {
      const bodyMatch = html.match(/class="ms-article__body"[^>]*>([\s\S]*?)(?:<\/div>\s*<\/div>|<footer)/i);
      if (bodyMatch) content = bodyMatch[1];
    }

    const pTags = (content || html).match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    const cleanText = pTags
      .map((p) => p.replace(/<[^>]+>/g, "").trim())
      .filter((t) => t.length > 40 && !/cookie|suscr[ií]bete|publicidad|newsletter|comentarios/i.test(t))
      .join(" ");

    return cleanText.slice(0, 2500);
  } catch (err) {
    console.log(`    ⚠ No se pudo scrapear ${url}: ${err.message}`);
    return "";
  }
}

// ---------------------------------------------------------------------------
// AI Prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Eres el editor periodístico de "F-Uno Center". Reescribe la información en un reporte claro y directo en español neutro.

INSTRUCCIONES:
1. Extrae los DATOS CONCRETOS (nombres, fechas, números, posiciones).
2. Si hay listas o detalles específicos, INCLÚYELOS.
3. Cero relleno o clichés. Ve directo al contenido.

JSON válido:
{
  "title": "Titular conciso y periodístico (máx 120 chars)",
  "summary": "Resumen directo en 2 oraciones (máx 280 chars)",
  "content": "<p>Párrafo 1 con datos principales...</p><p>Párrafo 2 con detalles...</p>",
  "category": "Carrera|Piloto|Equipo|Técnica|Reglamento|Off-track",
  "keyPoints": ["dato 1", "dato 2", "dato 3"]
}`;

async function processWithAI(title, articleBody, fallbackDesc, source) {
  const context = articleBody.length > 200 ? articleBody : fallbackDesc;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Fuente: ${source}\nTitular: ${title}\n\nTexto:\n${context}` },
      ],
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🏎️  F-Uno Center — Ingestión con Scraping\n");

  let existingNews = await loadJson(NEWS_FILE, []);
  const processedIds = new Set(await loadJson(PROCESSED_FILE, []));
  console.log(`  Existing: ${existingNews.length} | Processed IDs: ${processedIds.size}`);

  const allItems = [];
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { accept: "application/rss+xml, text/xml" } });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = parseRssItems(xml);
      console.log(`  ${feed.name}: ${items.length} items`);
      allItems.push(...items.map((item) => ({ ...item, source: feed.name })));
    } catch (err) {
      console.log(`  ⚠ ${feed.name}: ${err.message}`);
    }
  }

  const newItems = allItems.filter((item) => item.title && item.link && !processedIds.has(item.link));
  console.log(`\n  New: ${newItems.length}`);

  if (newItems.length === 0) {
    console.log("  Nothing new. Done!");
    return;
  }

  const toProcess = newItems.slice(0, MAX_NEWS_PER_RUN);
  let successCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    console.log(`\n  [${i + 1}/${toProcess.length}] ${item.title.slice(0, 55)}...`);

    try {
      const articleBody = await fetchArticleBody(item.link);
      console.log(`    Scraped ${articleBody.length} chars`);

      const ai = await processWithAI(item.title, articleBody, item.description, item.source);
      const { team, color } = detectTeam(item.title);
      const pub = item.pubDate ? new Date(item.pubDate) : null;

      existingNews.push({
        slug: makeSlug(ai.title),
        title: ai.title,
        summary: ai.summary,
        content: ai.content,
        category: ai.category || "Fórmula 1",
        keyPoints: ai.keyPoints || [],
        team,
        teamColor: color,
        source: item.source,
        originalLink: item.link,
        date: pub && !Number.isNaN(pub.getTime()) ? pub.toISOString() : new Date().toISOString(),
      });

      processedIds.add(item.link);
      successCount++;
      console.log(`    ✓ ${ai.title.slice(0, 50)} [${team}]`);
    } catch (err) {
      console.log(`    ✗ Error: ${err.message}`);
    }

    if (i < toProcess.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  existingNews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (existingNews.length > MAX_ARTICLES) {
    existingNews = existingNews.slice(0, MAX_ARTICLES);
    console.log(`  Trimmed to ${MAX_ARTICLES} articles`);
  }

  await saveJson(NEWS_FILE, existingNews);
  await saveJson(PROCESSED_FILE, [...processedIds]);

  console.log(`\n  ✅ Done! ${successCount} articles. Total: ${existingNews.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
