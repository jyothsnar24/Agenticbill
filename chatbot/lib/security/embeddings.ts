import "server-only";

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
    if (response.status === 429 && attempt < 5) {
      const retryAfter = Number(response.headers.get("retry-after-ms"));
      const delay =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter
          : 1500 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return embedBatch(batch, attempt + 1);
    }
    return response;
  };
  return batches.reduce(
    async (promise, batch) => {
      const results = await promise;
      const response = await embedBatch(batch);
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
