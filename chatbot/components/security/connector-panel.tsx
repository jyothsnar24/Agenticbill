"use client";

import {
  Check,
  CircleDashed,
  CloudUpload,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ConnectorStatus } from "@/lib/security/connectors";

const modeCopy = {
  demo: "Demo data",
  needs_setup: "Not connected",
  ready: "Ready",
} as const;

export function ConnectorPanel() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/security/connectors");
    if (response.ok) {
      setConnectors(
        ((await response.json()) as { connectors: ConnectorStatus[] })
          .connectors
      );
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const sync = useCallback(async () => {
    setSyncing(true);
    await fetch("/api/security/connectors", { method: "POST" });
    await load();
    setSyncing(false);
  }, [load]);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      const formData = new FormData();
      formData.set("file", file);
      await fetch("/api/security/upload", { body: formData, method: "POST" });
      setUploading(false);
      await load();
    },
    [load]
  );

  const handleSync = useCallback(() => {
    sync().catch(() => undefined);
  }, [sync]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        upload(file).catch(() => undefined);
      }
      event.target.value = "";
    },
    [upload]
  );

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <section className="border-b px-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold">Evidence sources</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Read-only connections
          </p>
        </div>
        <button
          aria-label="Sync all connectors"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          disabled={syncing}
          onClick={handleSync}
          type="button"
        >
          <RefreshCw
            className={syncing ? "size-3.5 animate-spin" : "size-3.5"}
          />
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {connectors.map((connector) => (
          <div
            className="flex items-start gap-2 rounded-lg bg-muted/35 px-2.5 py-2"
            key={connector.id}
          >
            <span className="mt-0.5 text-muted-foreground">
              {connector.mode === "ready" ? (
                <Check className="size-3.5 text-emerald-600" />
              ) : connector.mode === "demo" ? (
                <CloudUpload className="size-3.5 text-sky-600" />
              ) : (
                <CircleDashed className="size-3.5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium">
                {connector.name}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                {modeCopy[connector.mode]} ·{" "}
                {connector.readOnly ? "read-only" : ""}
              </span>
            </span>
          </div>
        ))}
      </div>
      <input
        accept=".csv,.json,.log,.md,.txt"
        className="hidden"
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
      <button
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted"
        disabled={uploading}
        onClick={openFilePicker}
        type="button"
      >
        <Upload className="size-3.5" />
        {uploading ? "Indexing evidence…" : "Upload evidence file"}
      </button>
    </section>
  );
}
