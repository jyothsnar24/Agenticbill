import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { ingestUploadedFile } from "@/lib/security/upload";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose a file to upload" },
        { status: 400 }
      );
    }
    const result = await ingestUploadedFile(
      file,
      "policy",
      String(formData.get("scope") ?? "")
    );
    return NextResponse.json({ ...result, title: file.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
