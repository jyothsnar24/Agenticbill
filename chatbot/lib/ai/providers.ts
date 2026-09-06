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

const configuredChatEndpoint =
  process.env.AZURE_OPENAI_CHAT_DEPLOYMENT?.startsWith("http")
    ? process.env.AZURE_OPENAI_CHAT_DEPLOYMENT
    : undefined;

const azureChatDeployment =
  process.env.AZURE_OPENAI_CHAT_DEPLOYMENT?.startsWith("http")
    ? "model-router"
    : (process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ?? "model-router");

const azureEndpoint = (
  configuredChatEndpoint ?? process.env.AZURE_OPENAI_ENDPOINT
)
  ?.replace(/\/$/, "")
  .replace(/\/openai\/v1$/, "")
  .replace(/\/openai$/, "");

const azure = azureEndpoint
  ? createAzure({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2025-04-01-preview",
      baseURL: `${azureEndpoint}/openai`,
      useDeploymentBasedUrls: true,
    })
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  if (azure) {
    return azure.chat(azureChatDeployment);
  }

  return gateway.languageModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  if (azure) {
    return azure.chat(azureChatDeployment);
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
