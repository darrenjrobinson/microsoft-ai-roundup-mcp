# SETUP — one-time launch runbook

Steps only the repo owner can do. Work top to bottom; everything here is one-time — after this the Tuesday cron and `v*` tag autopublish handle the rest. (This file is git-tracked but excluded from the npm package.)

## 1. Create the GitHub repo and push

```powershell
gh auth login   # if needed
gh repo create darrenjrobinson/MicrosoftAIRoundupMCPServer --public --source . --push
```

The repo name is load-bearing: it's hardcoded in `src/db/client.ts` (`GITHUB_REPO`) as the DB download URL.

## 2. Add the OpenAI secret

```powershell
gh secret set OPENAI_API_KEY --repo darrenjrobinson/MicrosoftAIRoundupMCPServer
```

## 3. First database release

Run the **Weekly Database Update** workflow manually: Actions → Weekly Database Update → Run workflow → mode = `full`.

Verify: a release tagged `db-YYYY.MM.DD-NNNN` marked **Latest** exists with `microsoft-ai-roundup.db` attached, and the run summary shows ~5 issues / non-zero chunks.

## 4. First npm publish (manual — required)

npm Trusted Publishing cannot create a new package, so v0.1.0 is published by hand:

```powershell
npm login
npm run clean; npm run build
npm publish
```

## 5. First MCP Registry publish (manual)

```powershell
# Download mcp-publisher from https://github.com/modelcontextprotocol/registry/releases
mcp-publisher login github      # interactive GitHub auth
mcp-publisher publish
```

⚠️ `mcp-publisher` writes `.mcpregistry_github_token` / `.mcpregistry_registry_token` into the working directory. They are gitignored, but delete them after publishing anyway.

## 6. Configure npm Trusted Publisher (enables autopublish)

npmjs.com → package `microsoft-ai-roundup-mcp` → Settings → Trusted Publisher → GitHub Actions:

| Field | Value |
|---|---|
| Organization or user | `darrenjrobinson` |
| Repository | `MicrosoftAIRoundupMCPServer` |
| Workflow filename | `publish-mcp.yml` |
| Environment | (leave blank) |

## 7. Releasing from now on (fully automated)

```powershell
# Bump the version in package.json AND server.json (both "version" fields) — one commit
git commit -am "release: v0.1.1"
git tag v0.1.1
git push && git push --tags
```

The `publish-mcp.yml` workflow verifies the tag matches all three version fields, then publishes to npm (OIDC, with provenance) and the MCP Registry (OIDC). No tokens, no secrets.

## 8. Verify end-to-end on a clean machine

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.microsoft-ai-roundup-mcp" -ErrorAction SilentlyContinue
npx microsoft-ai-roundup-mcp@latest   # should download the DB and report "Ready — N chunks indexed"
```

## 9. Watch the first two Tuesday crons

Actions → Weekly Database Update. A week with no new issue should be a cheap no-op (incremental, 0 new posts); a publish week should add one issue and cut a new `db-*` release.

## 10. Before promoting publicly

Contact Merill for his blessing (same conversation as the Entra project — ideally one blessing covering both newsletters).
