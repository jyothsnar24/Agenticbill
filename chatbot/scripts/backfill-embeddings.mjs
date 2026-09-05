import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const sql = postgres(process.env.POSTGRES_URL ?? "", {
  max: 2,
  prepare: false,
});
const endpoint = (process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/$/, "");
const deployment =
  process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ?? "security-embeddings";
const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2025-04-01-preview";

function delayFor(response, attempt) {
  const retryAfterMs = Number(response.headers.get("retry-after-ms"));
  const retryAfterSeconds = Number(response.headers.get("retry-after"));
  const resetSeconds = Number(response.headers.get("x-ratelimit-reset-tokens"));
  const delay =
    Number.isFinite(retryAfterMs) && retryAfterMs > 0
      ? retryAfterMs
      : Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : Number.isFinite(resetSeconds) && resetSeconds > 0
          ? resetSeconds * 1000
          : 2000 * (attempt + 1);
  return Math.min(Math.max(delay, 1000) + Math.random() * 250, 120_000);
}

async function embed(batch) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: retries must be sequential and rate-aware.
    const response = await fetch(
      `${endpoint}/openai/deployments/${deployment}/embeddings?api-version=${apiVersion}`,
      {
        body: JSON.stringify({ input: batch.map((row) => row.content) }),
        headers: {
          "api-key": process.env.AZURE_OPENAI_API_KEY,
          "content-type": "application/json",
        },
        method: "POST",
      }
    );
    if (response.ok) {
      const payload = await response.json();
      return payload.data
        .sort((left, right) => left.index - right.index)
        .map((item) => item.embedding);
    }
    if (![404, 429, 502, 503, 504].includes(response.status)) {
      throw new Error(`Embedding request failed: ${response.status}`);
    }
    await new Promise((resolve) =>
      setTimeout(resolve, delayFor(response, attempt))
    );
  }
  throw new Error("Embedding request exceeded retry budget");
}

try {
  let embedded = 0;
  while (true) {
    // biome-ignore lint/performance/noAwaitInLoops: the next batch depends on the previous commit.
    const rows = await sql`
      SELECT c.id, c.content
      FROM security_chunks c
      JOIN security_sources s ON s.id = c.source_id AND s.is_current = true
      WHERE c.is_current = true AND c.embedding IS NULL
      ORDER BY c.created_at, c.chunk_index
      LIMIT 16
    `;
    if (!rows.length) {
      break;
    }
    const embeddings = await embed(rows);
    await Promise.all(
      rows.map(
        (row, index) =>
          sql`
          UPDATE security_chunks
          SET embedding = ${sql.unsafe(
            `'[${embeddings[index].join(",")}]'::vector`
          )},
              embedding_model = ${deployment}
          WHERE id = ${row.id} AND is_current = true AND embedding IS NULL
        `
      )
    );
    embedded += rows.length;
    console.log(JSON.stringify({ embedded }));
  }
  console.log(JSON.stringify({ done: true, embedded }));
} finally {
  await sql.end();
}
