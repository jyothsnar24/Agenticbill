import { NextResponse } from "next/server";
import { getConflicts, getProfile } from "@/lib/security/db";
import { FOCUSED_SECURITY_QUESTIONS } from "@/lib/security/questions";

function answerText(answer: unknown) {
  return typeof answer === "string" ? answer : JSON.stringify(answer);
}

const statusText = {
  conflict: "Conflict; needs resolution",
  partial: "Partially answered; needs confirmation",
  unknown: "Unknown / needs confirmation",
  user_confirmed: "Confirmed by the user",
  verified: "Verified from company information",
} as const;

export async function GET() {
  const [claims, rawConflicts] = await Promise.all([
    getProfile(),
    getConflicts(),
  ]);
  const conflicts = rawConflicts as Array<{
    question_id: string;
    description: string;
  }>;
  const byQuestion = new Map(claims.map((claim) => [claim.questionId, claim]));
  const focusedClaims = FOCUSED_SECURITY_QUESTIONS.map((question) =>
    byQuestion.get(question.id)
  ).filter((claim): claim is (typeof claims)[number] => Boolean(claim));
  const counts = {
    conflict: focusedClaims.filter((claim) => claim.status === "conflict")
      .length,
    partial: focusedClaims.filter((claim) => claim.status === "partial").length,
    ready: focusedClaims.filter((claim) =>
      ["verified", "user_confirmed"].includes(claim.status)
    ).length,
    unknown: FOCUSED_SECURITY_QUESTIONS.length - focusedClaims.length,
  };
  const lines = [
    "# AI Security Analyst — Focused Security Questionnaire",
    "",
    `Generated: ${new Date().toISOString()}`,
    "Scope: Core controls from the Regodit AI Security Analyst brief",
    `Coverage: ${counts.ready} ready · ${counts.partial} needs detail · ${counts.conflict} conflict · ${counts.unknown} unknown`,
    "",
  ];
  for (const question of FOCUSED_SECURITY_QUESTIONS) {
    const claim = byQuestion.get(question.id);
    lines.push(`## ${question.text}`);
    lines.push(
      `Status: ${statusText[claim?.status ?? "unknown"] ?? "Unknown / needs confirmation"}`
    );
    lines.push(
      `Answer: ${claim ? answerText(claim.answer) : "Unknown / needs confirmation"}`
    );
    if (claim?.missingDetails?.length) {
      lines.push(`Missing details: ${claim.missingDetails.join(", ")}`);
    }
    if (claim?.evidence?.length) {
      lines.push("Evidence:");
      for (const evidence of claim.evidence) {
        lines.push(
          `- ${evidence.sourceTitle} (${evidence.sourceType}, ${evidence.reliability} reliability): ${evidence.excerpt}`
        );
      }
    }
    const questionConflicts = conflicts.filter(
      (conflict) => conflict.question_id === question.id
    );
    if (questionConflicts.length) {
      lines.push("Conflicts:");
      for (const conflict of questionConflicts) {
        lines.push(`- ${conflict.description}`);
      }
    }
    lines.push("");
  }
  if (conflicts.length) {
    lines.push(
      "## Next actions",
      "",
      "Resolve these evidence conflicts or answer the focused follow-up in chat before treating the affected control as verified.",
      ""
    );
    for (const conflict of conflicts) {
      lines.push(`- ${conflict.description}`);
    }
  }
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Disposition": "attachment; filename=security-questionnaire.md",
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
