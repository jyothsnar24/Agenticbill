import "server-only";

import { nanoid } from "nanoid";
import postgres from "postgres";
import { embedTexts } from "./embeddings";
import { sha256 } from "./hash";
import type {
  CanonicalSource,
  Evidence,
  SearchFilters,
  SearchResult,
  SecurityClaim,
} from "./types";

const sql = postgres(process.env.POSTGRES_URL ?? "", {
  max: 5,
  prepare: false,
});

let schemaPromise: Promise<void> | undefined;

export function ensureSecuritySchema() {
  schemaPromise ??= (async () => {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    await sql`CREATE TABLE IF NOT EXISTS security_sources (
      id text PRIMARY KEY,
      external_id text NOT NULL,
      title text NOT NULL,
      source_type text NOT NULL,
      content text NOT NULL,
      author text,
      scope text,
      source_date timestamptz,
      effective_from timestamptz,
      effective_until timestamptz,
      reliability text NOT NULL,
      content_hash text NOT NULL,
      metadata_hash text NOT NULL,
      version integer NOT NULL DEFAULT 1,
      is_current boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS security_sources_current_external_idx
      ON security_sources (external_id) WHERE is_current = true`;
    await sql`CREATE TABLE IF NOT EXISTS security_chunks (
      id text PRIMARY KEY,
      source_id text NOT NULL REFERENCES security_sources(id),
      chunk_index integer NOT NULL,
      content text NOT NULL,
      chunk_hash text NOT NULL,
      embedding vector(1536),
      embedding_model text,
      source_type text NOT NULL,
      title text NOT NULL,
      scope text,
      reliability text NOT NULL,
      source_date timestamptz,
      is_current boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS security_chunks_fts_idx ON security_chunks USING gin (to_tsvector('english', content))`;
    await sql`CREATE INDEX IF NOT EXISTS security_chunks_current_idx ON security_chunks (is_current, source_type)`;
    await sql`CREATE TABLE IF NOT EXISTS security_claims (
      id text PRIMARY KEY,
      question_id text NOT NULL,
      answer jsonb NOT NULL,
      status text NOT NULL,
      scope text,
      confidence real NOT NULL,
      missing_details jsonb NOT NULL DEFAULT '[]'::jsonb,
      version integer NOT NULL,
      supersedes_id text,
      is_current boolean NOT NULL DEFAULT true,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS security_claims_current_question_idx ON security_claims (question_id) WHERE is_current = true`;
    await sql`CREATE TABLE IF NOT EXISTS security_claim_evidence (
      id text PRIMARY KEY,
      claim_id text NOT NULL REFERENCES security_claims(id) ON DELETE CASCADE,
      chunk_id text,
      source_id text,
      excerpt text NOT NULL,
      location text,
      relevance real NOT NULL DEFAULT 0
    )`;
    await sql`CREATE TABLE IF NOT EXISTS security_conflicts (
      id text PRIMARY KEY,
      question_id text NOT NULL,
      description text NOT NULL,
      claim_ids jsonb NOT NULL,
      resolution_status text NOT NULL DEFAULT 'open',
      resolution_note text,
      created_at timestamptz NOT NULL DEFAULT now(),
      resolved_at timestamptz
    )`;
    await sql`CREATE TABLE IF NOT EXISTS security_user_facts (
      id text PRIMARY KEY,
      question_id text NOT NULL,
      answer jsonb NOT NULL,
      note text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  })();
  return schemaPromise;
}

function toVector(values: number[]) {
  return `[${values.join(",")}]`;
}

export async function upsertSource(
  source: CanonicalSource,
  chunks: { content: string; embedding?: number[] }[]
) {
  await ensureSecuritySchema();
  const contentHash = sha256(source.content);
  const metadataHash = sha256({
    author: source.author,
    effectiveFrom: source.effectiveFrom,
    effectiveUntil: source.effectiveUntil,
    reliability: source.reliability,
    scope: source.scope,
    sourceDate: source.sourceDate,
    sourceType: source.sourceType,
    title: source.title,
  });
  const [current] =
    await sql`SELECT id, content_hash, metadata_hash, version FROM security_sources WHERE external_id = ${source.externalId} AND is_current = true LIMIT 1`;
  if (
    current &&
    current.content_hash === contentHash &&
    current.metadata_hash === metadataHash
  ) {
    return { changed: false, sourceId: current.id as string };
  }
  const sourceId = nanoid(16);
  const version = current ? Number(current.version) + 1 : 1;
  if (current) {
    await sql`UPDATE security_sources SET is_current = false WHERE external_id = ${source.externalId} AND is_current = true`;
    await sql`UPDATE security_chunks SET is_current = false WHERE source_id = ${current.id}`;
  }
  await sql`INSERT INTO security_sources ${sql({
    author: source.author ?? null,
    content: source.content,
    content_hash: contentHash,
    effective_from: source.effectiveFrom
      ? new Date(source.effectiveFrom)
      : null,
    effective_until: source.effectiveUntil
      ? new Date(source.effectiveUntil)
      : null,
    external_id: source.externalId,
    id: sourceId,
    metadata_hash: metadataHash,
    reliability: source.reliability,
    scope: source.scope ?? null,
    source_date: source.sourceDate ? new Date(source.sourceDate) : null,
    source_type: source.sourceType,
    title: source.title,
    version,
  })}`;
  await Promise.all(
    chunks.map(async (chunk, index) => {
      const chunkHash = sha256({ content: chunk.content, index });
      const embedding = chunk.embedding
        ? sql.unsafe(`'${toVector(chunk.embedding)}'::vector`)
        : sql`NULL`;
      await sql`INSERT INTO security_chunks (id, source_id, chunk_index, content, chunk_hash, embedding, embedding_model, source_type, title, scope, reliability, source_date)
      VALUES (${nanoid(16)}, ${sourceId}, ${index}, ${chunk.content}, ${chunkHash}, ${embedding}, ${chunk.embedding ? (process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ?? "text-embedding-3-small") : null}, ${source.sourceType}, ${source.title}, ${source.scope ?? null}, ${source.reliability}, ${source.sourceDate ? new Date(source.sourceDate) : null})`;
    })
  );
  return { changed: true, sourceId };
}

export async function searchSecurityKnowledge(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchResult[]> {
  await ensureSecuritySchema();
  const types = filters.sourceTypes ?? null;
  let queryEmbedding: number[] | undefined;
  try {
    [queryEmbedding] = await embedTexts([query]);
  } catch {
    queryEmbedding = undefined;
  }
  const vector = queryEmbedding
    ? sql.unsafe(`'${toVector(queryEmbedding)}'::vector`)
    : null;
  const rows = vector
    ? await sql`
    SELECT c.id AS chunk_id, c.content, c.title AS source_title, c.source_type, c.scope,
      c.reliability, c.source_date, c.source_id,
      (1 - (c.embedding <=> ${vector})) AS score
    FROM security_chunks c
    WHERE c.is_current = true AND c.embedding IS NOT NULL
      AND (${types}::text[] IS NULL OR c.source_type = ANY(${types}::text[]))
      AND (${filters.scope ?? null}::text IS NULL OR c.scope ILIKE ${filters.scope ? `%${filters.scope}%` : null})
    ORDER BY score DESC, c.source_date DESC NULLS LAST
    LIMIT 12`
    : await sql`
    SELECT c.id AS chunk_id, c.content, c.title AS source_title, c.source_type, c.scope,
      c.reliability, c.source_date, c.source_id,
      ts_rank_cd(to_tsvector('english', c.content), plainto_tsquery('english', ${query})) AS score
    FROM security_chunks c
    WHERE c.is_current = true
      AND (${types}::text[] IS NULL OR c.source_type = ANY(${types}::text[]))
      AND (${filters.scope ?? null}::text IS NULL OR c.scope ILIKE ${filters.scope ? `%${filters.scope}%` : null})
      AND to_tsvector('english', c.content) @@ plainto_tsquery('english', ${query})
    ORDER BY score DESC, c.source_date DESC NULLS LAST
    LIMIT 12`;
  return rows.map((row) => ({
    chunkId: row.chunk_id as string,
    content: row.content as string,
    excerpt: row.content as string,
    id: row.chunk_id as string,
    relevance: Number(row.score ?? 0),
    reliability: row.reliability as Evidence["reliability"],
    scope: row.scope as string | undefined,
    score: Number(row.score ?? 0),
    sourceDate: row.source_date
      ? new Date(row.source_date as string).toISOString()
      : undefined,
    sourceId: row.source_id as string,
    sourceTitle: row.source_title as string,
    sourceType: row.source_type as Evidence["sourceType"],
  }));
}

export async function saveClaim(
  input: Omit<SecurityClaim, "id" | "version" | "updatedAt">
) {
  await ensureSecuritySchema();
  const [previous] =
    await sql`SELECT id, version FROM security_claims WHERE question_id = ${input.questionId} AND is_current = true LIMIT 1`;
  if (previous) {
    await sql`UPDATE security_claims SET is_current = false WHERE question_id = ${input.questionId} AND is_current = true`;
  }
  const id = nanoid(16);
  const version = previous ? Number(previous.version) + 1 : 1;
  await sql`INSERT INTO security_claims ${sql({
    answer: sql.json(input.answer as any),
    confidence: input.confidence,
    id,
    missing_details: sql.json(input.missingDetails),
    question_id: input.questionId,
    scope: input.scope ?? null,
    status: input.status,
    supersedes_id: previous?.id ?? null,
    version,
  })}`;
  await Promise.all(
    input.evidence.map(
      (evidence) =>
        sql`INSERT INTO security_claim_evidence ${sql({
          chunk_id: evidence.id,
          claim_id: id,
          excerpt: evidence.excerpt,
          id: nanoid(16),
          location: evidence.location ?? null,
          relevance: evidence.relevance,
          source_id: evidence.sourceId,
        })}`
    )
  );
  return { ...input, id, updatedAt: new Date().toISOString(), version };
}

export async function getProfile() {
  await ensureSecuritySchema();
  const rows =
    await sql`SELECT c.*, COALESCE(json_agg(json_build_object('id', e.id, 'sourceId', e.source_id, 'excerpt', e.excerpt, 'relevance', e.relevance)) FILTER (WHERE e.id IS NOT NULL), '[]'::json) AS evidence FROM security_claims c LEFT JOIN security_claim_evidence e ON e.claim_id = c.id WHERE c.is_current = true GROUP BY c.id ORDER BY c.updated_at DESC`;
  return rows.map((row) => ({
    answer: row.answer,
    confidence: Number(row.confidence),
    evidence: (row.evidence ?? []) as Evidence[],
    id: row.id as string,
    missingDetails: (row.missing_details ?? []) as string[],
    questionId: row.question_id as string,
    scope: row.scope as string | undefined,
    status: row.status as SecurityClaim["status"],
    updatedAt: new Date(row.updated_at as string).toISOString(),
    version: Number(row.version),
  }));
}

export async function saveUserFact(
  questionId: string,
  answer: unknown,
  note?: string
) {
  await ensureSecuritySchema();
  await sql`INSERT INTO security_user_facts ${sql({ answer: sql.json(answer as any), id: nanoid(16), note: note ?? null, question_id: questionId })}`;
}

export async function saveConflict(
  questionId: string,
  description: string,
  claimIds: string[]
) {
  await ensureSecuritySchema();
  await sql`INSERT INTO security_conflicts ${sql({ claim_ids: sql.json(claimIds), description, id: nanoid(16), question_id: questionId })}`;
}

export async function getConflicts() {
  await ensureSecuritySchema();
  return await sql`SELECT * FROM security_conflicts WHERE resolution_status = 'open' ORDER BY created_at DESC`;
}
