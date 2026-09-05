# Security evidence connectors

All connectors are read-only. They fetch source snapshots and pass them through the same pipeline:

`fetch → normalize → hash/version → chunk → Azure embedding → PostgreSQL/pgvector`

## Demo-ready connectors

- **Company files**: upload `.txt`, `.md`, `.csv`, `.json`, or `.log` from the Evidence profile panel.
- **Azure infrastructure**: the seeded inventory represents the read-only Azure resource evidence required for the hackathon demo.

## Optional live connectors

Set the following environment variables in `.env.local`:

- Slack: `SLACK_BOT_TOKEN` and comma-separated `SLACK_CHANNEL_IDS`.
- Google Drive: `GOOGLE_DRIVE_ACCESS_TOKEN` and `GOOGLE_DRIVE_FOLDER_ID`.
- GitHub: `GITHUB_TOKEN` plus either `GITHUB_ORG` or comma-separated `GITHUB_REPOS`.

The UI never displays token values. It reports only whether the required configuration is present. The Sync all connectors action skips unconfigured sources and records their status without failing the demo sync.
