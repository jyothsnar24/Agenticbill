import { createHash } from "node:crypto";

export function canonicalize(value: unknown): string {
  if (typeof value === "string") {
    return value
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function sha256(value: unknown) {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}
