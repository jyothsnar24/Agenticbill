import { NextResponse } from "next/server";
import { getConflicts, getProfile } from "@/lib/security/db";
import { FOCUSED_SECURITY_QUESTIONS } from "@/lib/security/questions";
import type { Evidence, SecurityClaim } from "@/lib/security/types";

function answerText(answer: unknown) {
  if (typeof answer === "string") {
    return answer;
  }
  if (
    answer &&
    typeof answer === "object" &&
    "summary" in answer &&
    typeof answer.summary === "string"
  ) {
    return answer.summary;
  }
  return JSON.stringify(answer, null, 2);
}

function compactExcerpt(excerpt: string) {
  const normalized = excerpt.replaceAll(/\s+/g, " ").trim();
  return normalized.length > 420
    ? `${normalized.slice(0, 417).trimEnd()}...`
    : normalized;
}

function groupedEvidence(evidence: Evidence[]) {
  const groups = new Map<
    string,
    {
      excerpts: string[];
      reliability: string;
      sourceTitle: string;
      sourceType: string;
    }
  >();
  for (const item of evidence) {
    const key = item.sourceId || item.sourceTitle;
    const group = groups.get(key) ?? {
      excerpts: [],
      reliability: item.reliability,
      sourceTitle: item.sourceTitle,
      sourceType: item.sourceType,
    };
    if (group.excerpts.length < 2) {
      group.excerpts.push(compactExcerpt(item.excerpt));
    }
    groups.set(key, group);
  }
  return [...groups.values()];
}

const statusText = {
  conflict: "Conflict; needs resolution",
  partial: "Partially answered; needs confirmation",
  unknown: "Unknown / needs confirmation",
  user_confirmed: "Confirmed by the user",
  verified: "Verified from company information",
} as const;

type ReportConflict = { description: string; question_id: string };

function followUp(questionText: string, claim?: SecurityClaim) {
  if (claim?.missingDetails.length) {
    return `${questionText} — confirm: ${claim.missingDetails
      .map((detail) => detail.replaceAll("_", " "))
      .join(", ")}.`;
  }
  return questionText;
}

export async function GET() {
  const [claims, rawConflicts] = await Promise.all([
    getProfile(),
    getConflicts(),
  ]);
  const conflicts = rawConflicts as ReportConflict[];
  const byQuestion = new Map(claims.map((claim) => [claim.questionId, claim]));
  const statuses = FOCUSED_SECURITY_QUESTIONS.map(
    (question) => byQuestion.get(question.id)?.status ?? "unknown"
  );
  const counts = {
    conflict: statuses.filter((status) => status === "conflict").length,
    partial: statuses.filter((status) => status === "partial").length,
    ready: statuses.filter((status) =>
      ["verified", "user_confirmed"].includes(status)
    ).length,
    unknown: statuses.filter((status) => status === "unknown").length,
  };
  const lines = [
    "# AI Security Analyst — Security Questionnaire",
    "",
    `Generated: ${new Date().toISOString()}`,
    "Scope: Seven core controls from the Regodit AI Security Analyst brief",
    `Coverage: ${counts.ready} ready · ${counts.partial} needs detail · ${counts.conflict} conflict · ${counts.unknown} unknown`,
    "",
  ];
  for (const question of FOCUSED_SECURITY_QUESTIONS) {
    const claim = byQuestion.get(question.id);
    const questionConflicts = conflicts.filter(
      (conflict) => conflict.question_id === question.id
    );
    lines.push(`## ${question.text}`);
    lines.push(
      `Status: ${statusText[claim?.status ?? "unknown"] ?? "Unknown / needs confirmation"}`
    );
    lines.push(
      `Answer: ${claim ? answerText(claim.answer) : "Unknown / needs confirmation"}`
    );
    if (claim?.scope) {
      lines.push(`Scope: ${claim.scope}`);
    }
    if (claim?.missingDetails?.length) {
      lines.push(
        `Needs confirmation: ${claim.missingDetails
          .map((detail) => detail.replaceAll("_", " "))
          .join(", ")}`
      );
    }
    if (claim?.evidence?.length) {
      lines.push("Evidence:");
      for (const source of groupedEvidence(claim.evidence)) {
        lines.push(
          `- ${source.sourceTitle} (${source.sourceType}, ${source.reliability} reliability): ${source.excerpts.join(" ")}`
        );
      }
    }
    if (questionConflicts.length) {
      lines.push("Conflict:");
      for (const conflict of questionConflicts) {
        lines.push(`- ${conflict.description}`);
      }
    }
    lines.push("");
  }
  const actions = FOCUSED_SECURITY_QUESTIONS.flatMap((question) => {
    const claim = byQuestion.get(question.id);
    const questionConflicts = conflicts.filter(
      (conflict) => conflict.question_id === question.id
    );
    if (
      questionConflicts.length ||
      claim?.status === "partial" ||
      claim?.status === "unknown"
    ) {
      return [followUp(question.text, claim)];
    }
    if (!claim) {
      return [question.text];
    }
    return [];
  });
  if (actions.length) {
    lines.push(
      "## Next actions",
      "",
      "Ask these focused follow-ups in chat:",
      ""
    );
    for (const action of actions) {
      lines.push(`- ${action}`);
    }
  }
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Disposition": "attachment; filename=security-questionnaire.md",
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
