import "server-only";

let embeddingQueue = Promise.resolve();

function enqueue<T>(task: () => Promise<T>) {
  const next = embeddingQueue.then(task, task);
  embeddingQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function retryDelay(response: Response, attempt: number) {
  const retryAfterMs = Number(response.headers.get("retry-after-ms"));
  const retryAfterSeconds = Number(response.headers.get("retry-after"));
  const resetSeconds = Number(response.headers.get("x-ratelimit-reset-tokens"));
  const headerDelay =
    Number.isFinite(retryAfterMs) && retryAfterMs > 0
      ? retryAfterMs
      : Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : Number.isFinite(resetSeconds) && resetSeconds > 0
          ? resetSeconds * 1000
          : 1500 * (attempt + 1);
  return Math.min(Math.max(headerDelay, 1000) + Math.random() * 250, 120_000);
}

export function embedTexts(input: string[]): Promise<number[][]> {
  if (!input.length) {
    return Promise.resolve([]);
  }
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const configuredEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  if (!apiKey || !configuredEndpoint) {
    return Promise.resolve([]);
  }
  const endpoint = configuredEndpoint.replace(/\/$/, "");
  const deployment =
    process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ?? "security-embeddings";
  const version = process.env.AZURE_OPENAI_API_VERSION ?? "2025-04-01-preview";
  const batches: string[][] = [];
  for (let index = 0; index < input.length; index += 16) {
    batches.push(input.slice(index, index + 16));
  }
  const embedBatch = async (
    batch: string[],
    attempt = 0
  ): Promise<Response> => {
    const response = await fetch(
      `${endpoint}/openai/deployments/${deployment}/embeddings?api-version=${version}`,
      {
        body: JSON.stringify({ input: batch }),
        headers: {
          "api-key": apiKey,
          "content-type": "application/json",
        },
        method: "POST",
      }
    );
    const retryable = [429, 502, 503, 504].includes(response.status);
    // A missing deployment should fall back to full-text retrieval quickly;
    // repeatedly waiting on a 404 can consume the entire chat request window.
    const deploymentNotReady = response.status === 404 && attempt < 1;
    if ((retryable || deploymentNotReady) && attempt < 12) {
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay(response, attempt))
      );
      return embedBatch(batch, attempt + 1);
    }
    return response;
  };
  return batches.reduce(
    async (promise, batch) => {
      const results = await promise;
      const response = await enqueue(() => embedBatch(batch));
      if (!response.ok) {
        throw new Error(`Embedding request failed: ${response.status}`);
      }
      const payload = (await response.json()) as {
        data?: { embedding: number[]; index: number }[];
      };
      results.push(
        ...(payload.data ?? [])
          .sort((a, b) => a.index - b.index)
          .map((item) => item.embedding)
      );
      return results;
    },
    Promise.resolve([] as number[][])
  );
}
