# Azure setup and teardown runbook

This runbook provisions the minimum Azure services used by the Agenticbill AI
Security Analyst and explains how to remove them safely after a demo.

## What the MVP uses

| Service | Resource/name used by the demo | Purpose |
|---|---|---|
| Azure resource group | `hackathon-ai-rg` | Billing and lifecycle boundary |
| Azure OpenAI | `hackathonaiopenai` in `eastus` | Chat and embedding models |
| Azure PostgreSQL Flexible Server | `hackathonpg9e184` in `westus` | App data, claims, evidence, and pgvector |

The app uses PostgreSQL with the `vector` extension; Azure AI Search is not
required for this MVP. The chat workflow is implemented with the Vercel AI SDK
bounded tool loop, not LangGraph or langchain-deepagents.

## Prerequisites

Install Azure CLI, Node.js, pnpm, and PostgreSQL client tools. Sign in with an
Azure identity that can create resources and assign database configuration:

```bash
az login
az account set --subscription "<SUBSCRIPTION_ID_OR_NAME>"
az account show --query "{subscription:id,tenant:tenantId}" -o table
```

Do not commit `.env.local`, API keys, OAuth refresh tokens, or database
passwords. Use placeholders in documentation and store real values locally.

## Provisioning

### 1. Resource group

```bash
az group create \
  --name hackathon-ai-rg \
  --location eastus \
  --tags app=agenticbill purpose=hackathon owner=security-analyst
```

### 2. Azure OpenAI account and deployments

```bash
az cognitiveservices account create \
  --name hackathonaiopenai \
  --resource-group hackathon-ai-rg \
  --location eastus \
  --kind OpenAI \
  --sku S0 \
  --custom-domain hackathonaiopenai
```

Create one chat and one embedding deployment. Model versions can change;
choose a currently available version in the Azure region if the exact version
is unavailable.

```bash
az cognitiveservices account deployment create \
  --name hackathonaiopenai \
  --resource-group hackathon-ai-rg \
  --deployment-name security-chat \
  --model-name gpt-4.1-mini \
  --model-version 2025-04-14 \
  --model-format OpenAI \
  --sku-capacity 10 \
  --sku-name GlobalStandard

az cognitiveservices account deployment create \
  --name hackathonaiopenai \
  --resource-group hackathon-ai-rg \
  --deployment-name security-embeddings \
  --model-name text-embedding-3-small \
  --model-version 1 \
  --model-format OpenAI \
  --sku-capacity 10 \
  --sku-name GlobalStandard
```

Retrieve the endpoint and key only into local environment configuration:

```bash
az cognitiveservices account show \
  --name hackathonaiopenai --resource-group hackathon-ai-rg \
  --query properties.endpoint -o tsv
az cognitiveservices account keys list \
  --name hackathonaiopenai --resource-group hackathon-ai-rg \
  --query key1 -o tsv
```

### 3. PostgreSQL and pgvector

```bash
az postgres flexible-server create \
  --resource-group hackathon-ai-rg \
  --name hackathonpg9e184 \
  --location westus \
  --admin-user appadmin \
  --admin-password '<GENERATE_A_LONG_UNIQUE_PASSWORD>' \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 16 \
  --storage-size 32 \
  --public-access 0.0.0.0

az postgres flexible-server parameter set \
  --resource-group hackathon-ai-rg \
  --server-name hackathonpg9e184 \
  --name azure.extensions --value vector

az postgres flexible-server db create \
  --resource-group hackathon-ai-rg \
  --server-name hackathonpg9e184 \
  --database-name chatbot
```

Restrict access to the developer's current public IP rather than leaving the
database open:

```bash
az postgres flexible-server firewall-rule create \
  --resource-group hackathon-ai-rg \
  --name hackathonpg9e184 \
  --rule-name developer-ip \
  --start-ip-address '<YOUR_PUBLIC_IP>' \
  --end-ip-address '<YOUR_PUBLIC_IP>'
```

Apply the app migrations from `chatbot/`, then set local values in
`chatbot/.env.local`:

```dotenv
AZURE_OPENAI_ENDPOINT=https://<account>.openai.azure.com/
AZURE_OPENAI_API_KEY=<local-only-key>
AZURE_OPENAI_API_VERSION=2025-01-01-preview
AZURE_OPENAI_CHAT_DEPLOYMENT=security-chat
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=security-embeddings
POSTGRES_URL=postgresql://<user>:<password>@<server>.postgres.database.azure.com:5432/chatbot?sslmode=require
```

Run `pnpm db:migrate` and start the app with `pnpm dev`.

## Verification

```bash
az resource list -g hackathon-ai-rg \
  --query '[].{name:name,type:type,location:location}' -o table
az cognitiveservices account deployment list \
  --name hackathonaiopenai --resource-group hackathon-ai-rg -o table
```

In the app, run a connector sync and check the embedding status endpoint. A
source is current only when its normalized content and metadata hashes match;
unchanged chunks are reused, changed chunks are re-embedded, and old versions
remain available for audit history. Every answer should expose evidence or ask
one focused follow-up. An unsupported claim must remain unknown.

Recommended demo checks:

1. Ask about a documented control such as backups and inspect its evidence.
2. Ask a vague question such as whether backups exist, then provide frequency
   and automation in separate messages; the profile should retain both facts.
3. Ask about a missing control such as background checks; the analyst should
   ask instead of guessing and save the employee's response.
4. Ask about a control with contradictory sources; the analyst should show the
   conflict and request clarification rather than mark it verified.
5. Download the report and confirm it contains the seven core controls, grouped
   evidence, explicit statuses, and only unresolved next actions.

## Teardown

Complete these steps in order:

1. Commit and push the runbook and any final source changes to GitHub.
2. In the app, choose Google Drive **Disconnect**. This revokes the current
   OAuth grant and clears the app's local connector cookies; it does not delete
   files from Google Drive. If Google still lists the app under third-party
   access, remove it from the connected Google account's security settings.
3. Remove local `.env.local` values and temporary OAuth state.
4. Confirm the exact Azure resource list, then delete only the dedicated group:

```bash
az resource list -g hackathon-ai-rg \
  --query '[].{name:name,type:type,location:location}' -o table
az group delete --name hackathon-ai-rg --yes --no-wait false
az group exists --name hackathon-ai-rg
```

The last command must return `false`. Never use this command against unrelated
resources such as `NeonPing-Foundry-Core` or another production resource group.
Group deletion removes the OpenAI account, model deployments, PostgreSQL
server, database, and its stored data. It is not recoverable unless backups or
exports were made first.

5. After the cloud and connector cleanup is verified, remove the local project
folder if it is no longer needed. The GitHub repository is the remaining source
of truth.

## Recovery and safety

If only one component must be stopped, delete that component rather than the
resource group. Before any destructive command, inspect the resource list and
check the resource-group name exactly. Rotate any key that was accidentally
shared, and invalidate OAuth tokens from the provider's security page.
