import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  getConnectorStatuses,
  isGoogleDriveConnected,
  syncConfiguredConnectors,
} from "@/lib/security/connectors";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    connectors: await getConnectorStatuses(await isGoogleDriveConnected()),
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await syncConfiguredConnectors());
  } catch (error) {
    console.error("Connector sync failed", error);
    return NextResponse.json(
      { error: "Unable to synchronize connectors" },
      { status: 500 }
    );
  }
}
