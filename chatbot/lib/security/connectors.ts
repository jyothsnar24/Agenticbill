import "server-only";

import { syncDemoSources } from "./ingestion";
import {
  isGitHubConfigured,
  isGoogleDriveConfigured,
  isSlackConfigured,
  syncGitHub,
  syncGoogleDrive,
  syncSlack,
} from "./live-connectors";

export type ConnectorId =
  | "company-files"
  | "azure"
  | "slack"
  | "google-drive"
  | "github";

export type ConnectorStatus = {
  id: ConnectorId;
  name: string;
  description: string;
  mode: "connected" | "ready" | "demo" | "needs_setup";
  readOnly: true;
  detail: string;
};

export const CONNECTORS: ConnectorStatus[] = [
  {
    description:
      "Upload policies, questionnaires, CSVs, and infrastructure exports.",
    detail: "Ready for upload",
    id: "company-files",
    mode: "ready",
    name: "Company files",
    readOnly: true,
  },
  {
    description:
      "Collect resource, identity, backup, and vulnerability evidence.",
    detail: "Demo inventory enabled",
    id: "azure",
    mode: "demo",
    name: "Azure infrastructure",
    readOnly: true,
  },
  {
    description:
      "Find operational messages, access exceptions, and offboarding evidence.",
    detail: isSlackConfigured() ? "Connected" : "OAuth connection required",
    id: "slack",
    mode: isSlackConfigured() ? "connected" : "needs_setup",
    name: "Slack",
    readOnly: true,
  },
  {
    description: "Sync policies and security documents from a selected folder.",
    detail: isGoogleDriveConfigured()
      ? "Connected"
      : "OAuth connection required",
    id: "google-drive",
    mode: isGoogleDriveConfigured() ? "connected" : "needs_setup",
    name: "Google Drive",
    readOnly: true,
  },
  {
    description:
      "Verify repository access, branch protection, and security settings.",
    detail: isGitHubConfigured() ? "Connected" : "App connection required",
    id: "github",
    mode: isGitHubConfigured() ? "connected" : "needs_setup",
    name: "GitHub",
    readOnly: true,
  },
];

export function getConnectorStatuses() {
  return CONNECTORS;
}

export async function syncConfiguredConnectors() {
  // Azure inventory is represented by the seeded read-only inventory until an Azure
  // service principal is configured. The connector contract stays identical when
  // live resource-manager reads are enabled.
  const demo = await syncDemoSources();
  const connectors = await Promise.all([
    syncSlack(),
    syncGoogleDrive(),
    syncGitHub(),
  ]);
  return { ...demo, connectors };
}
