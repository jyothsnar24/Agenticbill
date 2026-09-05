import { NextResponse } from "next/server";
import { getConflicts, getProfile } from "@/lib/security/db";
import { SECURITY_QUESTIONS } from "@/lib/security/questions";

function answerText(answer: unknown) {
  return typeof answer === "string" ? answer : JSON.stringify(answer);
}

export async function GET() {
  const [claims, conflicts] = await Promise.all([getProfile(), getConflicts()]);
  const byQuestion = new Map(claims.map((claim) => [claim.questionId, claim]));
  const lines = [
    "# Security Questionnaire",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
  ];
  for (const question of SECURITY_QUESTIONS) {
    const claim = byQuestion.get(question.id);
    lines.push(`## ${question.text}`);
    lines.push(`Status: ${claim?.status ?? "unknown"}`);
    lines.push(
      `Answer: ${claim ? answerText(claim.answer) : "Unknown / needs confirmation"}`
    );
    if (claim?.missingDetails?.length) {
      lines.push(`Missing details: ${claim.missingDetails.join(", ")}`);
    }
    if (claim?.evidence?.length) {
      lines.push("Evidence:");
      for (const evidence of claim.evidence) {
        lines.push(`- ${evidence.sourceTitle}: ${evidence.excerpt}`);
      }
    }
    lines.push("");
  }
  if (conflicts.length) {
    lines.push("## Open conflicts", "");
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
