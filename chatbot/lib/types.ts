import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type {
  getSecurityProfile,
  recordSecurityConflict,
  saveSecurityConfirmation,
  saveVerifiedSecurityClaim,
  searchCompanyKnowledge,
  syncCompanySources,
} from "./ai/tools/security";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;
type securitySearchTool = InferUITool<typeof searchCompanyKnowledge>;
type securityProfileTool = InferUITool<typeof getSecurityProfile>;
type securitySyncTool = InferUITool<typeof syncCompanySources>;
type securityConfirmationTool = InferUITool<typeof saveSecurityConfirmation>;
type securityVerifiedTool = InferUITool<typeof saveVerifiedSecurityClaim>;
type securityConflictTool = InferUITool<typeof recordSecurityConflict>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
  searchCompanyKnowledge: securitySearchTool;
  getSecurityProfile: securityProfileTool;
  syncCompanySources: securitySyncTool;
  saveSecurityConfirmation: securityConfirmationTool;
  saveVerifiedSecurityClaim: securityVerifiedTool;
  recordSecurityConflict: securityConflictTool;
};

export type WaitingStatusData = {
  phase: "waiting" | "still-waiting" | "health" | "thinking";
  message: string;
  modelId: string;
  modelName: string;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
  "waiting-status": WaitingStatusData;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
