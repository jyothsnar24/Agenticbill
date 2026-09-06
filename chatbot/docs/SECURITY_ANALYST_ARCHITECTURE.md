# AI Security Analyst: Architecture and Operations

This document describes the hackathon implementation of the Regodit AI Security
Analyst. The application is intentionally evidence-first: it searches company
information before asking a person, preserves uncertainty, and never turns an
unsupported answer into a verified control.

## Product scope

The focused questionnaire contains the seven controls in the Regodit brief:

1. MFA for workforce and privileged access
2. Customer-data storage location
3. Encryption at rest
4. Backup frequency and automation
5. Vulnerability scans
6. Production-system access
7. Employee offboarding

Background checks remain available as a supplemental question when explicitly
asked, but are not included in the core progress counter or export.

## System architecture

```text
Next.js chat UI
       |
       v
AI SDK streamText orchestration (bounded tool loop, max 5 steps)
       |
       +--> getSecurityProfile       -> current claims and conflicts
       +--> searchCompanyKnowledge    -> hybrid PostgreSQL search
       +--> saveVerifiedSecurityClaim -> evidence-backed claim
       +--> saveSecurityConfirmation  -> human fact/correction
       +--> recordSecurityConflict    -> unresolved contradiction
       |
       v
Azure-hosted chat model (deployment: model-router)

Read-only sources -> normalize -> hash/version -> chunk -> embed -> PostgreSQL
                                                   |              |
                                                   +--> pgvector  +--> full text
                                                                  search fallback
```

The current implementation uses the Vercel AI SDK tool loop, not LangGraph or
`langchain-deepagents`. This is deliberate for the six-hour MVP: the workflow
is bounded and explicit, while claims, evidence, and conflicts are persisted in
PostgreSQL. A future production version could move the workflow into LangGraph
if it needs durable multi-agent plans, human approval checkpoints, or long-lived
background investigations.

Azure provisioning and teardown commands are maintained in
[AZURE_SETUP_TEARDOWN.md](AZURE_SETUP_TEARDOWN.md). The documented demo
resources are the dedicated `hackathon-ai-rg` resource group, its Azure OpenAI
account, and its PostgreSQL Flexible Server.

## Evidence and RAG pipeline

All source types use the same ingestion contract:

1. Fetch a read-only source snapshot.
2. Normalize it into `CanonicalSource` with title, type, scope, date,
   reliability, external ID, and connector metadata.
3. Compute `content_hash` and `metadata_hash`.
4. If both hashes are unchanged, keep the current version and only fill missing
   embeddings.
5. If content or metadata changed, mark the old source/chunks non-current,
   increment the source version, and insert a new current version.
6. Split text into 700-character chunks with 100-character overlap.
7. Store a chunk hash and the chunk metadata alongside the embedding.
8. Search current chunks using vector similarity plus PostgreSQL full-text
   search. The full-text path remains available when embeddings are unavailable.

Chunk metadata includes the source ID, connector, source type, title, scope,
reliability, source date, MIME type/file ID where applicable, and the embedding
model name. Hashes are for identity/versioning and deduplication; they are not
used as embeddings and do not replace evidence citations.

## Connectors

- **Company files:** local uploads of `.txt`, `.md`, `.csv`, `.json`, and `.log`.
- **Azure infrastructure:** seeded, read-only demo inventory for the hackathon.
- **Google Drive:** read-only OAuth access to the configured folder, including
  supported Google Docs, Sheets, Markdown, text, JSON, CSV, and DOCX files.
- **Slack and GitHub:** optional read-only integrations when configured.

`POST /api/security/connectors` runs the seeded sources and configured live
connectors. Each source is idempotent through its external ID and hashes. The
embedding backfill is queued in batches of 16 to avoid rate-limit bursts. Its
state is available at `/api/security/embeddings/status` and must be `completed`
before semantic indexing is considered complete.

The Google Drive `Disconnect` action revokes the current OAuth refresh token
with Google and clears the app's local refresh-token and OAuth-state cookies.

## Claim model and safety rules

Claims are versioned and can be:

- `verified`: directly supported by current company evidence
- `user_confirmed`: supplied or corrected by the employee
- `partial`: only part of the question is supported
- `conflict`: sources disagree and need clarification
- `unknown`: no directly relevant evidence is available

Every verified answer carries source title, source type, reliability, excerpt,
scope, and relevance. A policy requirement is not treated as proof that a
control is implemented. An unresolved conflict prevents a claim from being
saved as verified. User corrections create a new claim version and preserve the
previous history.

The prompt workflow is:

1. Read the persistent profile.
2. Search the company knowledge base.
3. Compare source scope, dates, and reliability.
4. Answer with citations only when evidence is direct.
5. Ask exactly one focused follow-up for a missing detail.
6. Name contradictions and ask for clarification.
7. Save only verified claims, user confirmations, or conflicts.

## Export

`GET /api/security/report` produces a Markdown questionnaire with:

- exactly the seven core controls;
- human-readable answers instead of raw JSON;
- compact, grouped evidence excerpts;
- explicit status and scope;
- a single `Next actions` section containing only unresolved follow-ups.

The export intentionally does not hide unknowns or convert conflicts into a
positive answer.

## Last verified demo state

The latest database audit before teardown contained 37 current sources,
including 19 Google Drive sources, and 919 current chunks. All current chunks
had embeddings. The profile contained evidence for backups, MFA, and background
checks, and no unresolved test conflict remained after cleanup. The current
Azure deployment names and cleanup procedure are intentionally kept in the
[Azure runbook](AZURE_SETUP_TEARDOWN.md), rather than in this historical demo
summary.

## Local setup

Copy `.env.example` to `.env.local` and fill values locally. Never commit
`.env.local`, API keys, OAuth tokens, or database URLs. The chat deployment is
configured through `AZURE_OPENAI_CHAT_DEPLOYMENT`; embeddings use
`AZURE_OPENAI_EMBEDDING_DEPLOYMENT` and the configured Azure OpenAI endpoint.
Restart the development server after changing environment variables.

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

Useful checks:

```bash
pnpm exec tsc --noEmit
pnpm exec ultracite check
pnpm test
```

## Teardown checklist

After the hackathon:

1. Push the source and documentation to GitHub.
2. Disconnect Google Drive from the app and remove the app from the connected
   Google account's third-party access list if it remains there.
3. Delete only `hackathon-ai-rg` after checking its resource list.
4. Remove local secrets and, if desired, the local project folder.

Follow the detailed [Azure setup and teardown runbook](AZURE_SETUP_TEARDOWN.md).
