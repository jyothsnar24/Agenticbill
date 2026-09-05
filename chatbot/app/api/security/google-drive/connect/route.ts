import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  googleDriveAuthUrl,
  isGoogleDriveOAuthConfigured,
  setGoogleDriveOAuthState,
} from "@/lib/security/live-connectors";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isGoogleDriveOAuthConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth client credentials are not configured" },
      { status: 503 }
    );
  }
  const state = randomBytes(24).toString("hex");
  await setGoogleDriveOAuthState(state);
  return NextResponse.redirect(googleDriveAuthUrl(state));
}
