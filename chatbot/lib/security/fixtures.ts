import type { CanonicalSource } from "./types";

export const DEMO_SOURCES: CanonicalSource[] = [
  {
    author: "Security Team",
    content:
      "Multi-factor authentication is mandatory for Google Workspace, GitHub, and privileged production access. Access exceptions require security approval and must be reviewed monthly.",
    effectiveFrom: "2026-08-01",
    externalId: "policy-access-control-v4",
    reliability: "high",
    scope: "workforce and privileged access",
    sourceDate: "2026-08-01",
    sourceType: "policy",
    title: "Access Control Policy",
  },
  {
    author: "Engineering Lead",
    content:
      "The new contractor has not enrolled in MFA yet. Please do not grant repository access until enrollment is complete.",
    externalId: "message-contractor-mfa",
    reliability: "medium",
    scope: "contractor access",
    sourceDate: "2026-08-28",
    sourceType: "internal_message",
    title: "Engineering message: contractor onboarding",
  },
  {
    author: "IT Operations",
    content:
      "The contractor engagement ended and all repository and cloud access was removed on August 30.",
    externalId: "message-contractor-offboarded",
    reliability: "high",
    scope: "contractor access",
    sourceDate: "2026-08-30",
    sourceType: "internal_message",
    title: "IT message: contractor access removed",
  },
  {
    author: "Infrastructure system",
    content:
      "Production PostgreSQL backups run every day at 02:00 UTC. The schedule is managed by the cloud backup service.",
    externalId: "infra-backup-schedule",
    reliability: "high",
    scope: "production PostgreSQL",
    sourceDate: "2026-08-22",
    sourceType: "infrastructure",
    title: "Production infrastructure configuration",
  },
  {
    author: "Security Team",
    content:
      "Authenticated vulnerability scans are performed quarterly against production-facing infrastructure. Findings are assigned to Engineering and tracked to remediation.",
    externalId: "policy-vulnerability-management",
    reliability: "high",
    scope: "production-facing infrastructure",
    sourceDate: "2026-07-15",
    sourceType: "policy",
    title: "Vulnerability Management Standard",
  },
  {
    author: "Infrastructure system",
    content:
      "Customer data is stored in managed PostgreSQL and object storage hosted in the United States region. The inventory does not specify whether backups use a separate region.",
    externalId: "infra-data-region",
    reliability: "medium",
    scope: "customer data",
    sourceDate: "2026-08-20",
    sourceType: "infrastructure",
    title: "Cloud architecture inventory",
  },
  {
    author: "People Operations",
    content:
      "People Operations notifies IT on the employee's final day. IT disables identity-provider access, removes application sessions, and records completion in the offboarding checklist.",
    externalId: "hr-offboarding-runbook",
    reliability: "high",
    scope: "employees",
    sourceDate: "2026-06-10",
    sourceType: "policy",
    title: "Employee Offboarding Runbook",
  },
];
