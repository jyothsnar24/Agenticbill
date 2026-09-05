import { NextResponse } from "next/server";
import {
  getEmbeddingBackfillStatus,
  startEmbeddingBackfill,
} from "@/lib/security/embedding-jobs";

export function GET() {
  return NextResponse.json(getEmbeddingBackfillStatus());
}

export function POST() {
  return NextResponse.json(startEmbeddingBackfill());
}
