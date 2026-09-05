export type SourceType =
  | "policy"
  | "internal_message"
  | "infrastructure"
  | "employee_record"
  | "public_reference"
  | "user_confirmation";

export type Reliability = "high" | "medium" | "low";

export type ClaimStatus =
  | "verified"
  | "user_confirmed"
  | "partial"
  | "conflict"
  | "unknown";

export type CanonicalSource = {
  externalId: string;
  title: string;
  sourceType: SourceType;
  content: string;
  author?: string;
  scope?: string;
  sourceDate?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  reliability: Reliability;
  metadata?: Record<string, unknown>;
};

export type Evidence = {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: SourceType;
  excerpt: string;
  location?: string;
  sourceDate?: string;
  reliability: Reliability;
  relevance: number;
};

export type SecurityClaim = {
  id: string;
  questionId: string;
  answer: unknown;
  status: ClaimStatus;
  scope?: string;
  confidence: number;
  missingDetails: string[];
  version: number;
  updatedAt: string;
  evidence: Evidence[];
};

export type QuestionnaireQuestion = {
  id: string;
  category: string;
  text: string;
  priority: "high" | "medium" | "low";
  requiredDetails: string[];
  order: number;
};

export type SearchFilters = {
  sourceTypes?: SourceType[];
  scope?: string;
  currentOnly?: boolean;
};

export type SearchResult = Evidence & {
  chunkId: string;
  content: string;
  score: number;
};
