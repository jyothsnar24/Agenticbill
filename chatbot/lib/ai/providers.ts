import { createAzure } from "@ai-sdk/azure";
import { customProvider, gateway } from "ai";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        chatModel,
        titleModel: mockTitleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": mockTitleModel,
        },
      });
    })()
  : null;

const azure = process.env.AZURE_OPENAI_ENDPOINT
  ? createAzure({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2025-04-01-preview",
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "")}/openai`,
      useDeploymentBasedUrls: true,
    })
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  if (azure) {
    return azure.chat(
      modelId === "security-chat-advanced"
        ? (process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ?? "security-chat-advanced")
        : (process.env.AZURE_OPENAI_FALLBACK_CHAT_DEPLOYMENT ?? "security-chat")
    );
  }

  return gateway.languageModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  if (azure) {
    return azure.chat(
      process.env.AZURE_OPENAI_FALLBACK_CHAT_DEPLOYMENT ?? "security-chat"
    );
  }
  return gateway.languageModel(titleModel.id);
}

export function getEmbeddingModel() {
  if (!azure) {
    return null;
  }
  return azure.embedding(
    process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ?? "security-embeddings"
  );
}
