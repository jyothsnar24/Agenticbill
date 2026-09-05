import "server-only";

import { ingestSource } from "./ingestion";
import type { CanonicalSource, SourceType } from "./types";

const acceptedExtensions = new Set(["csv", "json", "log", "md", "txt"]);

export async function ingestUploadedFile(
  file: File,
  sourceType: SourceType = "policy",
  scope?: string
) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!acceptedExtensions.has(extension)) {
    throw new Error(
      "Supported uploads are CSV, JSON, Markdown, log, and text files"
    );
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Files must be 10MB or smaller");
  }
  const content = (await file.text()).trim();
  if (!content) {
    throw new Error("The uploaded file is empty");
  }
  const source: CanonicalSource = {
    content,
    externalId: `upload:${file.name}:${file.lastModified}:${file.size}`,
    metadata: {
      connector: "company-files",
      filename: file.name,
      mimeType: file.type,
    },
    reliability: "medium",
    scope: scope || "uploaded company evidence",
    sourceDate: new Date().toISOString(),
    sourceType,
    title: file.name,
  };
  return ingestSource(source);
}
