import { NextResponse } from "next/server";
import { SECURITY_QUESTIONS } from "@/lib/security/questions";

export function GET() {
  return NextResponse.json(SECURITY_QUESTIONS);
}
