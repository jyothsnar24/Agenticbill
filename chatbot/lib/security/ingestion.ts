import "server-only";

import { upsertSource } from "./db";
import { embedTexts } from "./embeddings";
import { DEMO_SOURCES } from "./fixtures";
import type { CanonicalSource } from "./types";

export function chunkText(content: string, size = 700, overlap = 100) {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + size);
    chunks.push(normalized.slice(start, end).trim());
    if (end === normalized.length) {
      break;
    }
    start = Math.max(start + 1, end - overlap);
  }
  return chunks.filter(Boolean);
}

export async function syncDemoSources(
  sources: CanonicalSource[] = DEMO_SOURCES
) {
  const results: Awaited<ReturnType<typeof upsertSource>>[] = await Promise.all(
    sources.map(async (source) => {
      const chunks = chunkText(source.content);
      let embeddings: number[][] = [];
      try {
        embeddings = await embedTexts(chunks);
      } catch {
        embeddings = [];
      }
      return upsertSource(
        source,
        chunks.map((content, index) => ({
          content,
          embedding: embeddings[index],
        }))
      );
    })
  );
  return {
    changed: results.filter((result) => result.changed).length,
    total: sources.length,
  };
}
