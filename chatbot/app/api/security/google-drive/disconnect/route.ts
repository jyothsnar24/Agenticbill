import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { disconnectGoogleDrive } from "@/lib/security/live-connectors";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await disconnectGoogleDrive());
  } catch (error) {
    console.error("Google Drive disconnect failed", error);
    return NextResponse.json(
      { error: "Unable to revoke Google Drive access" },
      { status: 502 }
    );
  }
}
