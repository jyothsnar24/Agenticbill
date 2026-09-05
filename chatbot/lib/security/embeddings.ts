import "server-only";

export async function embedTexts(input: string[]): Promise<number[][]> {
  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
    return [];
  }
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "");
  const deployment =
    process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ?? "security-embeddings";
  const version = process.env.AZURE_OPENAI_API_VERSION ?? "2025-04-01-preview";
  const response = await fetch(
    `${endpoint}/openai/deployments/${deployment}/embeddings?api-version=${version}`,
    {
      body: JSON.stringify({ input }),
      headers: {
        "api-key": process.env.AZURE_OPENAI_API_KEY,
        "content-type": "application/json",
      },
      method: "POST",
    }
  );
  if (!response.ok) {
    throw new Error(`Embedding request failed: ${response.status}`);
  }
  const payload = (await response.json()) as {
    data?: { embedding: number[]; index: number }[];
  };
  return (payload.data ?? [])
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}
