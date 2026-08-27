/**
 * scripts/fetch-news.mjs
 *
 * Fetches F1 RSS feeds, processes them with Groq AI to generate original
 * Spanish articles, and saves them as static JSON for Astro.
 *
 * Usage: node scripts/fetch-news.mjs
 * Requires: GROQ_API_KEY environment variable
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const DATA_DIR = join(PROJECT_ROOT, "src", "data");
const NEWS_FILE = join(DATA_DIR, "noticias.json");
const PROCESSED_FILE = join(DATA_DIR, "processed-ids.json");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_NEWS_PER_RUN = 15;

if (!GROQ_API_KEY) {
  console.error("Error: GROQ_API_KEY environment variable is required");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// RSS Feeds
// ---------------------------------------------------------------------------
const FEEDS = [
  { name: "Motorsport.com ES", url: "https://es.motorsport.com/rss/f1/news/" },
  { name: "Motorsport.com LAT", url: "https://lat.motorsport.com/rss/f1/news/" },
];

// ---------------------------------------------------------------------------
// Team detection: keywords → { image, color, slug }
// ---------------------------------------------------------------------------
const TEAMS = [
  { slug: "ferrari",       color: "#E8002D", image: "/ferrari.jpeg",       keywords: ["ferrari", "scuderia", "maranello", "leclerc", "sainz", "hamilton"] },
  { slug: "mclaren",       color: "#FF8000", image: "/mclaren.jpeg",       keywords: ["mclaren", "papaya", "norris", "piastri"] },
  { slug: "redbull",       color: "#3671C6", image: "/redbull.jpeg",       keywords: ["red bull", "redbull", "verstappen", "perez", "alonso"] },
  { slug: "mercedes",      color: "#27F4D2", image: "/mercedes.jpeg",      keywords: ["mercedes", "merc", "antonelli", "russell"] },
  { slug: "aston-martin",  color: "#229971", image: "/aston-martin.jpeg",  keywords: ["aston martin", "alonso", "stroll"] },
  { slug: "alpine",        color: "#0093CC", image: "/alpine.jpeg",        keywords: ["alpine", "renault", "gasly", "doohan"] },
  { slug: "williams",      color: "#64C4FF", image: "/williams.jpeg",      keywords: ["williams", "albon", "sainz jr"] },
  { slug: "haas",          color: "#B6BABD", image: "/haas.jpeg",          keywords: ["haas", "bearman", "ocon"] },
  { slug: "rb",            color: "#6692FF", image: "/rb.jpeg",            keywords: ["rb ", "vcarb", "racing bulls", "tsunoda", "lawson"] },
  { slug: "sauber",        color: "#52E252", image: "/audi.jpeg",          keywords: ["sauber", "kick sauber", "audi", "hulkenberg", "bortoleto"] },
  { slug: "cadillac",      color: "#1e1e1e", image: "/cadillac.jpeg",      keywords: ["cadillac", "gmp", "gm"] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectTeam(text) {
  const lower = text.toLowerCase();
  for (const team of TEAMS) {
    for (const kw of team.keywords) {
      if (lower.includes(kw)) {
        return { team: team.slug, image: team.image, color: team.color };
      }
    }
  }
  return { team: "general", image: null, color: "#e10600" };
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
    if (existsSync(path)) {
      const raw = await readFile(path, "utf-8");
      return JSON.parse(raw);
    }
  } catch { /* ignore */ }
  return fallback;
}

async function saveJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// RSS parsing (lightweight, no rss-parser needed for build)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Groq AI call
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Eres un periodista deportivo especializado en Fórmula 1 para el sitio web "F-Uno Center". Tu tarea es redactar una breve noticia informativa 100% original en español neutro, basada ÚNICAMENTE en los hechos proporcionados.

REGLAS ESTRICTAS:
- NO copies frases literales del texto fuente.
- Redacta con tu propio estilo, pero mantén exactitud en los datos (nombres, números, posiciones).
- Tono profesional, dinámico, periodístico deportivo.
- Español neutro (sin regionalismos marcados).

Devuelve SOLAMENTE un JSON válido (sin markdown, sin backticks) con esta estructura:
{
  "title": "Titular impactante y original (máx 120 caracteres)",
  "summary": "Resumen de 2-3 oraciones (máx 280 caracteres)",
  "content": "Cuerpo de la noticia en HTML simple (p, strong, em). 2-3 párrafos breves.",
  "category": "una categoría: Carrera|Piloto|Equipo|Técnica|Reglamento|Off-track",
  "keyPoints": ["punto clave 1", "punto clave 2", "punto clave 3"]
}`;

async function processWithAI(title, description, source) {
  const userPrompt = `Fuente: ${source}\nTitular original: ${title}\nDescripción: ${description}`;

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
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
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
  console.log("🏎️  F-Uno Center — News Ingestion\n");

  // 1. Load existing data
  const existingNews = await loadJson(NEWS_FILE, []);
  const processedIds = new Set(await loadJson(PROCESSED_FILE, []));
  console.log(`  Existing news: ${existingNews.length}`);
  console.log(`  Processed IDs: ${processedIds.size}`);

  // 2. Fetch RSS feeds
  const allItems = [];
  for (const feed of FEEDS) {
    try {
      console.log(`\n  Fetching ${feed.name}...`);
      const res = await fetch(feed.url, {
        headers: { accept: "application/rss+xml, application/xml, text/xml" },
      });
      if (!res.ok) {
        console.log(`    ⚠ HTTP ${res.status}, skipping`);
        continue;
      }
      const xml = await res.text();
      const items = parseRssItems(xml);
      console.log(`    Found ${items.length} items`);
      allItems.push(...items.map((item) => ({ ...item, source: feed.name })));
    } catch (err) {
      console.log(`    ⚠ Error: ${err.message}`);
    }
  }

  // 3. Filter already processed (by link)
  const newItems = allItems.filter((item) => {
    if (!item.title || !item.link) return false;
    return !processedIds.has(item.link);
  });
  console.log(`\n  New items to process: ${newItems.length}`);

  if (newItems.length === 0) {
    console.log("\n  Nothing new to process. Done!");
    return;
  }

  // 4. Process each item with AI (limit per run)
  const toProcess = newItems.slice(0, MAX_NEWS_PER_RUN);
  let successCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    console.log(`\n  [${i + 1}/${toProcess.length}] ${item.title.slice(0, 60)}...`);

    try {
      const ai = await processWithAI(item.title, item.description, item.source);
      const { team, image, color } = detectTeam(`${item.title} ${item.description}`);

      const slug = makeSlug(ai.title);
      const pub = item.pubDate ? new Date(item.pubDate) : null;

      existingNews.push({
        slug,
        title: ai.title,
        summary: ai.summary,
        content: ai.content,
        category: ai.category,
        keyPoints: ai.keyPoints,
        team,
        teamImage: image,
        teamColor: color,
        source: item.source,
        originalLink: item.link,
        date: pub && !Number.isNaN(pub.getTime()) ? pub.toISOString() : new Date().toISOString(),
      });

      processedIds.add(item.link);
      successCount++;
      console.log(`    ✓ ${ai.title.slice(0, 50)}... [${team}]`);
    } catch (err) {
      console.log(`    ✗ Error: ${err.message}`);
    }

    // Small delay to avoid rate limiting
    if (i < toProcess.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // 5. Save results
  // Sort by date descending
  existingNews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  await saveJson(NEWS_FILE, existingNews);
  await saveJson(PROCESSED_FILE, [...processedIds]);

  console.log(`\n  ✅ Done! ${successCount} new articles processed.`);
  console.log(`  Total news: ${existingNews.length}`);
  console.log(`  Saved to: ${NEWS_FILE}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
