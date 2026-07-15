# Microsoft AI Roundup MCP Server

[![npm version](https://img.shields.io/npm/v/microsoft-ai-roundup-mcp)](https://www.npmjs.com/package/microsoft-ai-roundup-mcp)
[![npm downloads](https://img.shields.io/npm/dm/microsoft-ai-roundup-mcp)](https://www.npmjs.com/package/microsoft-ai-roundup-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A Model Context Protocol (MCP) server for searching the archive of **[Merill's Weekly Microsoft AI Roundup](https://msai.ms)** — a curated weekly Substack newsletter by Merill Fernando (with Joshua Fernando) covering Microsoft AI: Copilot, GitHub, Azure AI, M365 AI integrations, and the surrounding ecosystem.

Ask natural-language questions like *"When did Copilot get feature X?"*, *"What did the roundup say about Build?"*, or *"Which GitHub projects has it highlighted?"* and get sourced answers with issue numbers, dates, and links.

Sister project to [entra-news-mcp](https://github.com/darrenjrobinson/EntraNewsMCPServer).

## Quick Start

No installation, no API keys, no configuration required:

```bash
npx microsoft-ai-roundup-mcp
```

On first run the server downloads a pre-built search index (SQLite database) from this repo's GitHub Releases and caches it locally. It checks for an updated index at most once every 7 days.

> **Requires Node.js 22 or later** — the server uses Node's built-in `node:sqlite` module (no native dependencies). Node 20 will not work.

## Client Configuration

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "microsoft-ai-roundup": {
      "command": "npx",
      "args": ["microsoft-ai-roundup-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add microsoft-ai-roundup -- npx microsoft-ai-roundup-mcp
```

### Cursor / VS Code / Copilot Studio

```json
{
  "mcpServers": {
    "microsoft-ai-roundup": {
      "command": "npx",
      "args": ["-y", "microsoft-ai-roundup-mcp"]
    }
  }
}
```

### Optional: semantic search

Keyword search works with zero configuration. For semantic (meaning-based) search, add an OpenAI API key:

```json
{
  "mcpServers": {
    "microsoft-ai-roundup": {
      "command": "npx",
      "args": ["microsoft-ai-roundup-mcp"],
      "env": { "OPENAI_API_KEY": "sk-..." }
    }
  }
}
```

Without a key the server degrades gracefully to keyword-only search.

## Tools

| Tool | Description |
|------|-------------|
| `search_microsoft_ai_roundup` | Search the full archive with natural language or keywords. Hybrid semantic + keyword search; returns sourced excerpts with issue number, date, and URL. Args: `query` (required), `limit` (default 10, max 50), `mode` (`hybrid` \| `semantic` \| `keyword`). |
| `get_issue` | Retrieve the full content of an issue by `issue_number` or `date` (`YYYY-MM-DD` or `YYYY-MM`), with section headings preserved. |
| `list_issues` | Browse the archive with optional `year`/`month` filtering and pagination. |
| `find_tool_mentions` | Find community tools, GitHub projects, and Microsoft AI products/features mentioned across issues, with surrounding context. Optional `query` filter. |

### Example queries

- "Search the Microsoft AI roundup for Copilot Studio agent announcements"
- "Get issue #4 of the Microsoft AI roundup"
- "List all roundup issues from May 2026"
- "What GitHub projects has the Microsoft AI roundup mentioned?"

## How It Works

```
Substack API (https://msai.ms/api/v1/posts)
     │
     ▼
TypeScript ingestion script (scripts/ingest.ts)
     │  weekly GitHub Action — Tuesdays 09:00 UTC
     ▼
OpenAI text-embedding-3-small embeddings (1536 dims)
     │
     ▼
SQLite via node:sqlite (Node 22 built-in — no native deps)
     │
     ▼
GitHub Release asset: microsoft-ai-roundup.db
     │
     ▼
NPX MCP Server (stdio)
  └─ Downloads DB on first run → caches in ~/.microsoft-ai-roundup-mcp/
  └─ Re-checks for updates weekly (7-day staleness + tag diff)
  └─ In-memory cosine similarity + SQL LIKE keyword search
```

**Search implementation (honest version):** semantic search loads all embedding vectors into memory at startup and ranks by cosine similarity in JavaScript; keyword search uses SQL `LIKE` (exact phrase first, then per-word fallback). Hybrid mode merges and de-duplicates both result sets. No sqlite-vec, no FTS5 — deliberately simple, and more than adequate at this archive's scale.

## Automated Weekly Updates

A GitHub Actions workflow runs every **Tuesday at 09:00 UTC** (the morning after the newsletter's usual Monday publish). It incrementally ingests any new issues, verifies the database, and publishes it as a new GitHub Release tagged `db-YYYY.MM.DD-NNNN`. The NPX server picks up the new database automatically within a week (or immediately on a fresh install). A `workflow_dispatch` trigger provides a manual escape hatch for off-schedule publishes or full rebuilds.

## Cache Locations

| OS | Path |
|----|------|
| Windows | `%USERPROFILE%\.microsoft-ai-roundup-mcp\` |
| macOS / Linux | `~/.microsoft-ai-roundup-mcp/` |

Delete the folder to force a fresh download of the latest database.

## Local Development / Ingestion

```bash
git clone https://github.com/darrenjrobinson/microsoft-ai-roundup-mcp
cd microsoft-ai-roundup-mcp
npm install
npm run build

# Build the search index locally (requires an OpenAI API key for embeddings)
export OPENAI_API_KEY=sk-...
node dist/scripts/ingest.js               # full ingest
node dist/scripts/ingest.js --incremental # only new issues

# On Windows there's a PowerShell wrapper:
./scripts/ingest.ps1 -Incremental

# Run the server against your local database
MSAI_ROUNDUP_DB_PATH=./microsoft-ai-roundup.db npx microsoft-ai-roundup-mcp
```

| Environment variable | Used by | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | ingest + server | Embeddings (required for ingest; optional for the server's semantic search) |
| `INGEST_DB_PATH` | ingest | Output database path (default `./microsoft-ai-roundup.db`) |
| `MSAI_ROUNDUP_DB_PATH` | server | Use a local database instead of downloading from GitHub Releases |

## Permissions & Licensing

Newsletter content is © [Merill Fernando](https://merill.net) & Joshua Fernando. This project indexes the freely available public archive via the public Substack API (all posts are free, `audience: "everyone"`) and always links back to the original issues. The code is [MIT licensed](LICENSE).

## Credits

- **Newsletter:** [Merill Fernando](https://merill.net) & Joshua Fernando — [msai.ms](https://msai.ms)
- **MCP server:** [Darren Robinson](https://blog.darrenjrobinson.com)
- Sister project: [entra-news-mcp](https://github.com/darrenjrobinson/EntraNewsMCPServer) for [entra.news](https://entra.news)
