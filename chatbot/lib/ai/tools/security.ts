import { tool } from "ai";
import { z } from "zod";
import {
  getConflicts,
  getProfile,
  resolveConflicts,
  saveClaim,
  saveConflict,
  saveUserFact,
  searchSecurityKnowledge,
} from "@/lib/security/db";
import { syncDemoSources } from "@/lib/security/ingestion";
import {
  normalizeQuestionId as canonicalizeQuestionId,
  getQuestion,
} from "@/lib/security/questions";
import type { ClaimStatus, Evidence } from "@/lib/security/types";

const evidenceSchema = z.object({
  excerpt: z.string(),
  id: z.string(),
  relevance: z.number().min(0).max(1).optional(),
  sourceId: z.string(),
  sourceTitle: z.string(),
  sourceType: z.string(),
});

function normalizeQuestionId(questionId: string) {
  return canonicalizeQuestionId(questionId);
}

export const searchCompanyKnowledge = tool({
  description:
    "Search the private company security knowledge base before answering a questionnaire question. Return evidence excerpts and metadata.",
  execute: async ({ query, sourceTypes }) => {
    const results = await searchSecurityKnowledge(query, { sourceTypes });
    return { found: results.length > 0, results: results.slice(0, 8) };
  },
  inputSchema: z.object({
    query: z
      .string()
      .min(2)
      .describe("The security question or missing detail to investigate"),
    sourceTypes: z
      .array(
        z.enum([
          "policy",
          "internal_message",
          "infrastructure",
          "employee_record",
          "public_reference",
        ])
      )
      .optional(),
  }),
});

export const getSecurityProfile = tool({
  description:
    "Read the current persistent security profile and open conflicts. Use this to avoid asking the same question twice. After reading it, continue the investigation by searching company knowledge for the user's question; do not stop after this tool.",
  execute: async () => ({
    claims: await getProfile(),
    conflicts: await getConflicts(),
    nextStep:
      "Continue now: searchCompanyKnowledge for the user's question before answering.",
  }),
  inputSchema: z.object({}),
});

export const syncCompanySources = tool({
  description:
    "Synchronize the seeded company policies, messages, infrastructure, and process facts into the private knowledge base.",
  execute: async () => syncDemoSources(),
  inputSchema: z.object({}),
});

export const saveSecurityConfirmation = tool({
  description:
    "Save a user's direct confirmation or correction for a security questionnaire question. Preserve existing evidence, classify this as user confirmed, and resolve an open conflict when the confirmation has no missing details.",
  execute: async ({ questionId, answer, note, missingDetails }) => {
    const canonicalQuestionId = normalizeQuestionId(questionId);
    const details = missingDetails ?? [];
    const question = getQuestion(canonicalQuestionId);
    if (!question) {
      return { error: "Unknown questionnaire question", saved: false };
    }
    await saveUserFact(canonicalQuestionId, answer, note);
    if (details.length === 0) {
      await resolveConflicts(
        canonicalQuestionId,
        note ?? "Resolved by the user's current confirmation."
      );
    }
    const claim = await saveClaim({
      answer,
      confidence: details.length > 0 ? 0.65 : 0.82,
      evidence: [],
      missingDetails: details,
      questionId: canonicalQuestionId,
      status: details.length > 0 ? "partial" : "user_confirmed",
    });
    return { claim, saved: true };
  },
  inputSchema: z.object({
    answer: z.unknown(),
    missingDetails: z.array(z.string()).default([]),
    note: z.string().optional(),
    questionId: z.string(),
  }),
});

export const saveVerifiedSecurityClaim = tool({
  description:
    "Save a security answer supported by retrieved company evidence. Only use this when evidence directly supports the claim and there is no unresolved conflict.",
  execute: async ({
    questionId,
    answer,
    scope,
    confidence,
    missingDetails,
    evidence,
  }) => {
    const canonicalQuestionId = normalizeQuestionId(questionId);
    const details = missingDetails ?? [];
    const normalizedEvidence = evidence.map((item) => ({
      ...item,
      relevance: item.relevance ?? 0.5,
    }));
    const openConflicts = await getConflicts();
    if (
      openConflicts.some(
        (conflict) => conflict.question_id === canonicalQuestionId
      )
    ) {
      return {
        error:
          "An unresolved company evidence conflict exists for this question. Ask the user for clarification before verifying it.",
        saved: false,
        status: "conflict",
      };
    }
    const claim = await saveClaim({
      answer,
      confidence,
      evidence: normalizedEvidence as Evidence[],
      missingDetails: details,
      questionId: canonicalQuestionId,
      scope,
      status: details.length > 0 ? "partial" : "verified",
    });
    return { claim, saved: true };
  },
  inputSchema: z.object({
    answer: z.unknown(),
    confidence: z.number().min(0).max(1),
    evidence: z.array(evidenceSchema).min(1),
    missingDetails: z.array(z.string()).default([]),
    questionId: z.string(),
    scope: z.string().optional(),
  }),
});

export const recordSecurityConflict = tool({
  description:
    "Record contradictory company claims and keep the questionnaire answer in conflict status until the user resolves it.",
  execute: async ({ questionId, description, claimIds, answer }) => {
    const canonicalQuestionId = normalizeQuestionId(questionId);
    await saveConflict(canonicalQuestionId, description, claimIds);
    if (answer !== undefined) {
      await saveClaim({
        answer,
        confidence: 0.25,
        evidence: [],
        missingDetails: ["conflict_resolution"],
        questionId: canonicalQuestionId,
        status: "conflict" as ClaimStatus,
      });
    }
    return { description, saved: true, status: "conflict" };
  },
  inputSchema: z.object({
    answer: z.unknown().optional(),
    claimIds: z.array(z.string()),
    description: z.string(),
    questionId: z.string(),
  }),
});
