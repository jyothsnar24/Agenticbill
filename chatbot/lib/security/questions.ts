import type { QuestionnaireQuestion } from "./types";

export const SECURITY_QUESTIONS: QuestionnaireQuestion[] = [
  {
    category: "Identity & access",
    id: "mfa-enabled",
    order: 1,
    priority: "high",
    requiredDetails: ["systems", "scope", "exceptions", "current_state"],
    text: "Is multi-factor authentication enabled for workforce and privileged access?",
  },
  {
    category: "Data protection",
    id: "customer-data-location",
    order: 2,
    priority: "high",
    requiredDetails: ["provider", "regions", "data_types"],
    text: "Where is customer data stored?",
  },
  {
    category: "Data protection",
    id: "encryption-at-rest",
    order: 3,
    priority: "high",
    requiredDetails: ["systems", "algorithm_or_provider", "scope"],
    text: "Is customer data encrypted at rest?",
  },
  {
    category: "Resilience",
    id: "backups",
    order: 4,
    priority: "high",
    requiredDetails: [
      "performed",
      "frequency",
      "automated",
      "retention",
      "restore_testing",
    ],
    text: "Are backups performed?",
  },
  {
    category: "Vulnerability management",
    id: "vulnerability-scans",
    order: 5,
    priority: "high",
    requiredDetails: ["performed", "frequency", "scope", "owner"],
    text: "Do you conduct vulnerability scans?",
  },
  {
    category: "Identity & access",
    id: "production-access",
    order: 6,
    priority: "high",
    requiredDetails: ["roles", "approval", "review_frequency", "mfa"],
    text: "Who has access to production systems?",
  },
  {
    category: "People & process",
    id: "offboarding",
    order: 7,
    priority: "medium",
    requiredDetails: ["process", "timing", "access_revocation", "owner"],
    text: "Do you have an employee offboarding process?",
  },
  {
    category: "People & process",
    id: "background-checks",
    order: 8,
    priority: "medium",
    requiredDetails: ["performed", "scope", "timing", "exceptions"],
    text: "Do you conduct employee background checks?",
  },
];

export function getQuestion(id: string) {
  return SECURITY_QUESTIONS.find((question) => question.id === id);
}
