import "server-only";

import { cookies } from "next/headers";
import { ingestSource } from "./ingestion";
import type { CanonicalSource } from "./types";

const GOOGLE_DRIVE_REFRESH_COOKIE = "security_google_drive_refresh_token";
const GOOGLE_DRIVE_STATE_COOKIE = "security_google_drive_oauth_state";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

async function readJson<T>(url: string, headers: HeadersInit) {
  const response = await fetch(url, { cache: "no-store", headers });
  if (!response.ok) {
    throw new Error(`Connector request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

export function isSlackConfigured() {
  return configured("SLACK_BOT_TOKEN") && configured("SLACK_CHANNEL_IDS");
}

export function isGoogleDriveConfigured() {
  return (
    (configured("GOOGLE_DRIVE_ACCESS_TOKEN") ||
      (configured("GOOGLE_CLIENT_ID") && configured("GOOGLE_CLIENT_SECRET"))) &&
    configured("GOOGLE_DRIVE_FOLDER_ID")
  );
}

export function isGoogleDriveOAuthConfigured() {
  return (
    configured("GOOGLE_CLIENT_ID") &&
    configured("GOOGLE_CLIENT_SECRET") &&
    configured("GOOGLE_DRIVE_FOLDER_ID")
  );
}

export async function isGoogleDriveConnected() {
  if (configured("GOOGLE_DRIVE_ACCESS_TOKEN")) {
    return true;
  }
  return Boolean((await cookies()).get(GOOGLE_DRIVE_REFRESH_COOKIE)?.value);
}

export function googleDriveAuthUrl(state: string) {
  const params = new URLSearchParams({
    access_type: "offline",
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    include_granted_scopes: "true",
    prompt: "consent",
    redirect_uri: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/security/google-drive/callback`,
    response_type: "code",
    scope: GOOGLE_DRIVE_SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function setGoogleDriveOAuthState(state: string) {
  (await cookies()).set(GOOGLE_DRIVE_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 600,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function exchangeGoogleDriveCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/security/google-drive/callback`,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Google OAuth token exchange failed");
  }
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
  };
}

export async function saveGoogleDriveRefreshToken(token: string) {
  (await cookies()).set(GOOGLE_DRIVE_REFRESH_COOKIE, token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

async function getGoogleDriveAccessToken() {
  const directToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN?.trim();
  if (directToken) {
    return directToken;
  }
  const refreshToken = (await cookies()).get(
    GOOGLE_DRIVE_REFRESH_COOKIE
  )?.value;
  if (!refreshToken) {
    return;
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  if (!response.ok) {
    return;
  }
  const payload = (await response.json()) as { access_token?: string };
  return payload.access_token;
}

export function isGitHubConfigured() {
  return (
    configured("GITHUB_TOKEN") &&
    (configured("GITHUB_REPOS") || configured("GITHUB_ORG"))
  );
}

export async function syncSlack() {
  if (!isSlackConfigured()) {
    return {
      changed: 0,
      connectorId: "slack",
      detail: "OAuth connection required",
      synced: 0,
    };
  }
  const token = process.env.SLACK_BOT_TOKEN as string;
  const channels =
    process.env.SLACK_CHANNEL_IDS?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? [];
  const channelPayloads = await Promise.all(
    channels.map((channel) =>
      readJson<{
        messages?: { ts: string; text?: string; user?: string }[];
      }>(
        `https://slack.com/api/conversations.history?channel=${encodeURIComponent(channel)}&limit=100`,
        { Authorization: `Bearer ${token}` }
      ).then((payload) => ({ channel, messages: payload.messages ?? [] }))
    )
  );
  const sources = channelPayloads.flatMap(({ channel, messages }) =>
    messages.flatMap((message) => {
      if (!message.text?.trim()) {
        return [];
      }
      return [
        {
          author: message.user,
          content: message.text,
          externalId: `slack:${channel}:${message.ts}`,
          metadata: {
            channelId: channel,
            connector: "slack",
            messageTs: message.ts,
          },
          reliability: "medium" as const,
          scope: `Slack channel ${channel}`,
          sourceDate: new Date(
            Number(message.ts.split(".")[0]) * 1000
          ).toISOString(),
          sourceType: "internal_message" as const,
          title: `Slack message in ${channel}`,
        },
      ];
    })
  );
  const results = await Promise.all(sources.map(ingestSource));
  return {
    changed: results.filter((result) => result.changed).length,
    connectorId: "slack",
    detail: `Synced ${sources.length} messages`,
    synced: sources.length,
  };
}

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
};

async function listDriveTree(
  folderIds: string[],
  headers: HeadersInit
): Promise<(DriveFile & { parentFolder?: string })[]> {
  const branches = await Promise.all(
    folderIds.map(async (currentFolder) => {
      const query = encodeURIComponent(
        `'${currentFolder}' in parents and trashed = false`
      );
      const listing = await readJson<{ files?: DriveFile[] }>(
        `https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=100&fields=files(id,name,mimeType,modifiedTime)`,
        headers
      );
      const files = listing.files ?? [];
      const childFolders = files
        .filter(
          (file) => file.mimeType === "application/vnd.google-apps.folder"
        )
        .map((file) => file.id);
      const nested = childFolders.length
        ? await listDriveTree(childFolders, headers)
        : [];
      return [
        ...files
          .filter(
            (file) => file.mimeType !== "application/vnd.google-apps.folder"
          )
          .map((file) => ({ ...file, parentFolder: currentFolder })),
        ...nested,
      ];
    })
  );
  return branches.flat();
}

export async function syncGoogleDrive() {
  const token = await getGoogleDriveAccessToken();
  if (!isGoogleDriveConfigured() || !token) {
    return {
      changed: 0,
      connectorId: "google-drive",
      detail: "OAuth connection required",
      synced: 0,
    };
  }
  const folder = process.env.GOOGLE_DRIVE_FOLDER_ID as string;
  const headers = { Authorization: `Bearer ${token}` };
  const allFiles = await listDriveTree([folder], headers);
  const allowedTypes = [
    "text/plain",
    "text/markdown",
    "application/json",
    "text/csv",
    "application/vnd.google-apps.document",
  ];
  const downloaded: (CanonicalSource | null)[] = await Promise.all(
    allFiles
      .filter((item) => allowedTypes.includes(item.mimeType))
      .map(async (file) => {
        const path =
          file.mimeType === "application/vnd.google-apps.document"
            ? "/export?mimeType=text/plain"
            : "?alt=media";
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}${path}`,
          { cache: "no-store", headers }
        );
        if (!response.ok) {
          return null;
        }
        const content = (await response.text()).trim();
        return content
          ? {
              content,
              externalId: `google-drive:${file.id}`,
              metadata: {
                connector: "google-drive",
                fileId: file.id,
                mimeType: file.mimeType,
              },
              reliability: "high" as const,
              scope: `Google Drive security folder (${file.parentFolder})`,
              sourceDate: file.modifiedTime,
              sourceType: "policy" as const,
              title: file.name,
            }
          : null;
      })
  );
  const sources = downloaded.filter(
    (source): source is CanonicalSource => source !== null
  );
  const results = await Promise.all(sources.map(ingestSource));
  return {
    changed: results.filter((result) => result.changed).length,
    connectorId: "google-drive",
    detail: `Synced ${sources.length} documents`,
    synced: sources.length,
  };
}

type GitHubRepo = {
  full_name: string;
  default_branch: string;
  private: boolean;
  archived: boolean;
  html_url: string;
};

export async function syncGitHub() {
  if (!isGitHubConfigured()) {
    return {
      changed: 0,
      connectorId: "github",
      detail: "App connection required",
      synced: 0,
    };
  }
  const token = process.env.GITHUB_TOKEN as string;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const repos =
    process.env.GITHUB_REPOS?.split(",")
      .map((repo) => repo.trim())
      .filter(Boolean) ?? [];
  const repoList = repos.length
    ? await Promise.all(
        repos.map((repo) =>
          readJson<GitHubRepo>(`https://api.github.com/repos/${repo}`, headers)
        )
      )
    : await readJson<GitHubRepo[]>(
        `https://api.github.com/orgs/${encodeURIComponent(process.env.GITHUB_ORG as string)}/repos?per_page=100`,
        headers
      );
  const sources = repoList.map((repo) => ({
    content: `Repository ${repo.full_name} is ${repo.private ? "private" : "public"}, uses ${repo.default_branch} as its default branch, and is ${repo.archived ? "archived" : "active"}. Repository URL: ${repo.html_url}.`,
    externalId: `github:repo:${repo.full_name}`,
    metadata: {
      connector: "github",
      defaultBranch: repo.default_branch,
      repository: repo.full_name,
    },
    reliability: "high" as const,
    scope: "GitHub repository security",
    sourceDate: new Date().toISOString(),
    sourceType: "infrastructure" as const,
    title: `GitHub repository: ${repo.full_name}`,
  }));
  const results = await Promise.all(sources.map(ingestSource));
  return {
    changed: results.filter((result) => result.changed).length,
    connectorId: "github",
    detail: `Synced ${sources.length} repositories`,
    synced: sources.length,
  };
}
