import { NextResponse } from "next/server";
import { getConflicts, getProfile } from "@/lib/security/db";
import { FOCUSED_SECURITY_QUESTIONS } from "@/lib/security/questions";

export async function GET() {
  try {
    const [claims, conflicts] = await Promise.all([
      getProfile(),
      getConflicts(),
    ]);
    const claimMap = new Map(claims.map((claim) => [claim.questionId, claim]));
    const questions = FOCUSED_SECURITY_QUESTIONS.map((question) => ({
      ...question,
      claim: claimMap.get(question.id) ?? null,
    }));
    const focusedClaims = questions.flatMap((question) =>
      question.claim ? [question.claim] : []
    );
    const complete = focusedClaims.filter((claim) =>
      ["verified", "user_confirmed"].includes(claim.status)
    ).length;
    return NextResponse.json({
      claims: focusedClaims,
      completion: Math.round(
        (complete / FOCUSED_SECURITY_QUESTIONS.length) * 100
      ),
      conflicts,
      questions,
    });
  } catch (error) {
    console.error("Security profile read failed", error);
    return NextResponse.json(
      { error: "Unable to read security profile" },
      { status: 500 }
    );
  }
}
