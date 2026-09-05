"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ClaimStatus,
  Evidence,
  QuestionnaireQuestion,
  SecurityClaim,
} from "@/lib/security/types";
import { ConnectorPanel } from "./connector-panel";

type ProfilePayload = {
  questions: (QuestionnaireQuestion & { claim: SecurityClaim | null })[];
  claims: SecurityClaim[];
  conflicts: { id: string; question_id: string; description: string }[];
  completion: number;
};

const statusCopy: Record<ClaimStatus | "empty", string> = {
  conflict: "Conflict",
  empty: "Not investigated",
  partial: "Needs detail",
  unknown: "Unknown",
  user_confirmed: "User confirmed",
  verified: "Verified",
};

function StatusIcon({ status }: { status: ClaimStatus | "empty" }) {
  if (status === "verified" || status === "user_confirmed") {
    return <CheckCircle2 className="size-4" />;
  }
  if (status === "conflict") {
    return <AlertTriangle className="size-4" />;
  }
  return <CircleHelp className="size-4" />;
}

function statusClass(status: ClaimStatus | "empty") {
  if (status === "verified") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "user_confirmed") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
  if (status === "conflict") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-border bg-muted/40 text-muted-foreground";
}

export function SecurityDashboard() {
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/security/profile");
      if (!response.ok) {
        throw new Error("The security profile could not be loaded.");
      }
      setProfile((await response.json()) as ProfilePayload);
      setError(null);
    } catch {
      setError("Security profile unavailable. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/security/sync", { method: "POST" });
      if (!response.ok) {
        throw new Error("Source sync failed");
      }
      await refresh();
    } catch {
      setError("Source sync failed. Try again.");
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  useEffect(() => {
    sync().catch(() => undefined);
  }, [sync]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const downloadReport = useCallback(() => {
    window.open("/api/security/report", "_blank", "noopener,noreferrer");
  }, []);

  const handleSync = useCallback(() => {
    sync().catch(() => undefined);
  }, [sync]);

  const handleRetry = useCallback(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const handleQuestionSelect = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const { questionId } = event.currentTarget.dataset;
      if (questionId) {
        setSelectedQuestion((current) =>
          current === questionId ? null : questionId
        );
      }
    },
    []
  );

  const active = useMemo(
    () =>
      profile?.questions.find((question) => question.id === selectedQuestion),
    [profile, selectedQuestion]
  );

  if (loading) {
    return (
      <aside className="hidden w-[320px] shrink-0 border-l bg-card/60 p-5 lg:block">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-24 rounded-xl bg-muted" />
          <div className="h-48 rounded-xl bg-muted" />
        </div>
      </aside>
    );
  }

  if (!profile) {
    return (
      <aside className="hidden w-[340px] shrink-0 border-l bg-card/70 p-5 lg:block">
        <p className="text-sm font-semibold">Security profile unavailable</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {error ?? "The evidence profile could not be loaded."}
        </p>
        <button
          className="mt-4 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
          onClick={handleRetry}
          type="button"
        >
          Try again
        </button>
      </aside>
    );
  }

  return (
    <aside className="hidden w-[340px] shrink-0 border-l bg-card/70 lg:flex lg:flex-col">
      <div className="border-b px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Security workspace
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              Core control profile
            </h2>
          </div>
          <button
            aria-label="Sync company sources"
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            disabled={syncing}
            onClick={handleSync}
            type="button"
          >
            <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
          </button>
        </div>
        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-3xl font-semibold tracking-tight">
              {profile?.completion ?? 0}%
            </p>
            <p className="text-xs text-muted-foreground">
              of 8 core controls ready
            </p>
          </div>
          <ShieldCheck className="size-8 text-primary/70" />
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${profile?.completion ?? 0}%` }}
          />
        </div>
        <button
          className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted"
          onClick={downloadReport}
          type="button"
        >
          Download questionnaire
        </button>
      </div>
      <ConnectorPanel />
      {error ? (
        <div className="border-b px-5 py-3 text-xs text-amber-700 dark:text-amber-300">
          {error}
        </div>
      ) : null}
      {profile?.conflicts.length ? (
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4" /> {profile.conflicts.length} open
            conflict{profile.conflicts.length > 1 ? "s" : ""}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            The analyst will ask for clarification before marking these
            verified.
          </p>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {profile?.questions.map((question) => {
            const status = question.claim?.status ?? "empty";
            const isSelected = active?.id === question.id;
            return (
              <button
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${isSelected ? "border-primary/40 bg-primary/5" : "border-transparent hover:border-border hover:bg-muted/50"}`}
                data-question-id={question.id}
                key={question.id}
                onClick={handleQuestionSelect}
                type="button"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 ${status === "conflict" ? "text-amber-600" : status === "verified" ? "text-emerald-600" : "text-muted-foreground"}`}
                  >
                    <StatusIcon status={status} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium leading-5">
                      {question.text}
                    </span>
                    <span
                      className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass(status)}`}
                    >
                      {statusCopy[status]}
                    </span>
                  </span>
                </div>
                {isSelected && question.claim ? (
                  <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">
                      Analyst finding
                    </p>
                    <p className="mt-1 leading-5">
                      {typeof question.claim.answer === "string"
                        ? question.claim.answer
                        : JSON.stringify(question.claim.answer)}
                    </p>
                    {question.claim.evidence?.length ? (
                      <div className="mt-3 space-y-2">
                        {question.claim.evidence
                          .slice(0, 3)
                          .map((evidence: Evidence) => (
                            <div
                              className="rounded-lg bg-muted/50 p-2.5"
                              key={evidence.id}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-foreground">
                                  Evidence ·{" "}
                                  {evidence.sourceTitle || "Company source"}
                                </p>
                                <span className="shrink-0 text-[10px] uppercase tracking-wide">
                                  {evidence.sourceType?.replaceAll("_", " ")}
                                </span>
                              </div>
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {evidence.reliability} reliability
                                {evidence.location
                                  ? ` · ${evidence.location}`
                                  : ""}
                              </p>
                              <p className="mt-1 line-clamp-3 leading-4">
                                {evidence.excerpt}
                              </p>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-lg bg-sky-500/10 p-2.5 text-sky-700 dark:text-sky-300">
                        {question.claim.status === "user_confirmed"
                          ? "Confirmed by the employee; no document citation attached."
                          : "No direct company citation attached. This answer needs confirmation."}
                      </p>
                    )}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
