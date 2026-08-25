import { XMLParser } from "fast-xml-parser";
import type { NewsItem } from "./types";

const FEEDS = [
  { name: "Motorsport.com ES", url: "https://es.motorsport.com/rss/f1/news/" },
  { name: "Motorsport.com LAT", url: "https://lat.motorsport.com/rss/f1/news/" },
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

async function fetchFeed(url: string): Promise<NewsItem[] | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    const doc = parser.parse(text);
    const items = doc.rss?.channel?.item ?? doc.feed?.entry ?? [];
    if (!Array.isArray(items)) return [];
    return items
      .map((item: { title?: string; link?: string; pubDate?: string; description?: string; enclosure?: { "@_url"?: string } }) => {
        const title = typeof item.title === "string" ? item.title.trim() : "";
        const link = typeof item.link === "string" ? item.link.trim() : "";
        if (!title || !link) return null;
        const pub = item.pubDate ? new Date(item.pubDate) : null;
        const rawDesc = typeof item.description === "string" ? item.description : "";
        return {
          title,
          link,
          source: "",
          date: pub && !Number.isNaN(pub.getTime()) ? pub.toISOString() : null,
          description: rawDesc
            .replace(/<!\[CDATA\[|\]\]>/g, "")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 200),
          imageUrl: item.enclosure?.["@_url"] || null,
        } as NewsItem;
      })
      .filter((item: NewsItem | null): item is NewsItem => item !== null);
  } catch {
    return null;
  }
}

export async function getNews(limit = 30): Promise<NewsItem[]> {
  const sources = await Promise.all(
    FEEDS.map(async (feed) => {
      const items = await fetchFeed(feed.url);
      return (items ?? []).map((item) => ({ ...item, source: feed.name }));
    }),
  );

  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const item of sources.flat()) {
    const key = item.title.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged
    .sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    })
    .slice(0, limit);
}
