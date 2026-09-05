# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

An internal security or compliance reviewer preparing an enterprise security questionnaire and interviewing employees when company evidence is incomplete.

## Product Purpose

The AI Security Analyst searches company information, builds an auditable security profile, asks focused follow-up questions, resolves contradictions, and generates a completed questionnaire without inventing answers.

## Positioning

Evidence-first investigation: every answer is classified, scoped, versioned, and traceable to company evidence or an identified human confirmation.

## Operating Context

The analyst works over security policies, internal messages, infrastructure facts, employee/process facts, and user-provided corrections. The MVP uses seeded Markdown and JSON fixtures, Azure-hosted models, and Azure PostgreSQL with pgvector.

## Capabilities and Constraints

- Search before asking.
- Ask only for missing details.
- Detect and explain contradictions.
- Persist claims, evidence, corrections, and history.
- Distinguish verified, user-confirmed, partial, conflict, and unknown states.
- Generate Markdown and JSON questionnaire exports.
- Single-person guest workflow for the hackathon; no stakeholder roles in the MVP.
- The system must never fabricate a security answer.

## Evidence on Hand

The project brief defines the security questionnaire workflow. Demo source fixtures will be authored as synthetic company data and labeled accordingly.

## Product Principles

- Evidence before confidence.
- Unknown is a valid result.
- Policy is not proof of implementation.
- Contradictions are first-class work items.
- Human corrections create history, not silent overwrites.

## Accessibility & Inclusion

Use semantic controls, visible keyboard focus, readable contrast, and clear status text that does not depend on color alone.
