import { NextResponse } from "next/server";
import { syncDemoSources } from "@/lib/security/ingestion";

export async function POST() {
  try {
    return NextResponse.json(await syncDemoSources());
  } catch (error) {
    console.error("Security source sync failed", error);
    return NextResponse.json(
      { error: "Unable to sync security sources" },
      { status: 500 }
    );
  }
}
