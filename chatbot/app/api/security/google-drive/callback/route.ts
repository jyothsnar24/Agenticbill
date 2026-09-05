import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  exchangeGoogleDriveCode,
  saveGoogleDriveRefreshToken,
} from "@/lib/security/live-connectors";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = (await (await import("next/headers")).cookies()).get(
    "security_google_drive_oauth_state"
  )?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json(
      { error: "Invalid OAuth callback" },
      { status: 400 }
    );
  }
  try {
    const tokens = await exchangeGoogleDriveCode(code);
    if (!tokens.refresh_token) {
      return NextResponse.json(
        {
          error:
            "Google did not return a refresh token; reconnect and approve access",
        },
        { status: 400 }
      );
    }
    await saveGoogleDriveRefreshToken(tokens.refresh_token);
    return NextResponse.redirect(new URL("/?drive=connected", request.url));
  } catch (error) {
    console.error("Google Drive OAuth failed", error);
    return NextResponse.json(
      { error: "Unable to connect Google Drive" },
      { status: 502 }
    );
  }
}
