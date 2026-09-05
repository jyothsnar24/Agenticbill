import { NextResponse } from "next/server";
import { getConflicts, getProfile } from "@/lib/security/db";
import { SECURITY_QUESTIONS } from "@/lib/security/questions";

export async function GET() {
  try {
    const [claims, conflicts] = await Promise.all([
      getProfile(),
      getConflicts(),
    ]);
    const claimMap = new Map(claims.map((claim) => [claim.questionId, claim]));
    const questions = SECURITY_QUESTIONS.map((question) => ({
      ...question,
      claim: claimMap.get(question.id) ?? null,
    }));
    const complete = claims.filter((claim) =>
      ["verified", "user_confirmed"].includes(claim.status)
    ).length;
    return NextResponse.json({
      claims,
      completion: Math.round((complete / SECURITY_QUESTIONS.length) * 100),
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
