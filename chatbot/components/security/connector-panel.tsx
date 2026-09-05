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
  connected: "Connected",
  demo: "Demo data",
  needs_setup: "Not connected",
  ready: "Ready",
} as const;

export function ConnectorPanel() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/security/connectors");
    if (response.ok) {
      setConnectors(
        ((await response.json()) as { connectors: ConnectorStatus[] })
          .connectors
      );
      setError(null);
    } else {
      setError("Sources unavailable. Try again.");
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/security/connectors", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Connector sync failed");
      }
      await load();
    } catch {
      setError("Sync failed. Try again.");
    } finally {
      setSyncing(false);
    }
  }, [load]);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      const formData = new FormData();
      formData.set("file", file);
      try {
        const response = await fetch("/api/security/upload", {
          body: formData,
          method: "POST",
        });
        if (!response.ok) {
          throw new Error("Evidence upload failed");
        }
        setError(null);
        await load();
      } catch {
        setError("Evidence upload failed. Check the file and try again.");
      } finally {
        setUploading(false);
      }
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
            Company evidence · read-only
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
      {error ? (
        <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
          {error}
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        {connectors
          .filter((connector) => connector.mode !== "needs_setup")
          .map((connector) => (
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
                {connector.connectUrl && connector.mode !== "connected" ? (
                  <a
                    className="mt-1 inline-block text-[10px] font-medium text-foreground underline underline-offset-2"
                    href={connector.connectUrl}
                  >
                    Connect
                  </a>
                ) : null}
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
