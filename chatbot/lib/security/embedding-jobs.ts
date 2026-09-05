import "server-only";

import { backfillMissingEmbeddings } from "./db";

type EmbeddingJobStatus = {
  completed: number;
  error?: string;
  finishedAt?: string;
  startedAt?: string;
  state: "idle" | "running" | "completed" | "failed";
  total: number;
};

let status: EmbeddingJobStatus = {
  completed: 0,
  state: "idle",
  total: 0,
};
let activeJob: Promise<void> | undefined;

export function startEmbeddingBackfill() {
  if (activeJob) {
    return status;
  }

  status = {
    completed: 0,
    startedAt: new Date().toISOString(),
    state: "running",
    total: 0,
  };
  activeJob = backfillMissingEmbeddings((progress) => {
    status = { ...status, ...progress };
  })
    .then((result) => {
      status = {
        ...status,
        completed: result.completed,
        finishedAt: new Date().toISOString(),
        state: "completed",
        total: result.total,
      };
    })
    .catch((error: unknown) => {
      status = {
        ...status,
        error: error instanceof Error ? error.message : "Embedding job failed",
        finishedAt: new Date().toISOString(),
        state: "failed",
      };
    })
    .finally(() => {
      activeJob = undefined;
    });

  return status;
}

export function getEmbeddingBackfillStatus() {
  return status;
}
