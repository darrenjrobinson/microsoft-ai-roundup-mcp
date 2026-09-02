# Security

## Reporting a vulnerability

Open a [security advisory](https://github.com/darrenjrobinson/microsoft-ai-roundup-mcp/security/advisories/new)
on this repository. Please do not open a public issue for a suspected vulnerability.

## Dependency audit — September 2026

Audited against the three `@modelcontextprotocol/sdk` advisories current at the time.
**None are applicable to this server.** The reasoning is recorded here so the next audit
does not have to repeat it.

| Advisory | Affected | Patched | Component | Applies here? |
|---|---|---|---|---|
| CVE-2025-66414 · GHSA-w48q-cv73-mx4w — DNS rebinding not on by default | `< 1.24.0` | 1.24.0 | `StreamableHTTPServerTransport`, `SSEServerTransport` | **No** — stdio-only server; the advisory states stdio is unaffected |
| CVE-2026-0621 · GHSA-8r9q-7v3j-jr4g — ReDoS | `>=1.3.0 <1.25.2` | 1.25.2 | `UriTemplate.partToRegExp()` | **No** — this server registers no resources or resource templates, so the code path is unreachable |
| CVE-2026-25536 · GHSA-345p-7cg4-v4c7 — cross-client data leak | `>=1.10.0 <=1.25.3` | 1.26.0 | `StreamableHTTPServerTransport`, shared `Server`/`McpServer` | **No** — one `Server` instance, one `connect()`, one client per process |

### Why this server is structurally out of scope

- **Transport is stdio only.** [src/server.ts](src/server.ts) imports `StdioServerTransport`
  and nothing else. There is no listening socket, no `Origin` header, no session
  multiplexing and no second concurrent client — which rules out the DNS-rebinding and
  cross-client-leak classes outright.
- **No instance sharing.** A single `new Server(...)` is created in `createServer()` and
  `connect()` is called once at startup in [src/index.ts](src/index.ts). The vulnerable
  pattern requires one instance serving many concurrent clients.
- **No resources registered.** Only `ListToolsRequestSchema` and `CallToolRequestSchema`
  handlers exist, so the `UriTemplate` ReDoS path is never reached.
- **Low-level tool registration.** Tools are registered via `setRequestHandler` returning
  `Tool[]` with plain JSON Schema `inputSchema`, which is exactly what the wire protocol
  requires. The stricter `inputSchema` handling introduced in SDK 1.28.0 applies to the
  high-level `registerTool()`/`tool()` API and does not affect this server.

### What was fixed anyway

The advisories were not applicable, but the audit surfaced real hygiene issues:

1. **Transitive vulnerabilities** — `npm audit` reported 5 vulnerable packages before this
   change (2 moderate, 3 high). They fall into two groups, with different reasons for being
   out of reach:

   - **Four are SDK runtime transitives**, all of them HTTP-transport machinery: `hono`
     (moderate) and `@hono/node-server` (moderate) are direct dependencies of the SDK,
     `fast-uri` (high) arrives via `ajv`, and `ip-address` (high) via `express-rate-limit`.
     A stdio-only server never loads the HTTP transports, so none of this code runs here.
   - **One is development-only**: `brace-expansion` (high), reached through
     `rimraf` → `glob` → `minimatch`. `rimraf` is a devDependency used by `npm run clean`,
     so it is absent from a consumer install entirely — it is not an SDK dependency and the
     stdio argument above does not apply to it.

   All five were cleared by `npm audit fix`; `npm audit` now reports 0 vulnerabilities.

2. **Declared floor raised.** `@modelcontextprotocol/sdk` was declared `^1.10.1`, a range
   spanning all three vulnerable ranges. `package-lock.json` is not published to npm, so
   `npx microsoft-ai-roundup-mcp` resolves the declared range, not the lockfile — the floor
   was the only guarantee consumers had. Raised to `^1.30.0`.
3. **Peer requirement satisfied.** `zod` was declared `^3.22.4`, below the SDK's
   `^3.25 || ^4.0` requirement. Raised to `^3.25.76`.
4. **Lockfile root metadata** was stale (`0.1.0` against an actual `0.1.1`); corrected by
   reinstalling.
5. **Dependabot config added** ([.github/dependabot.yml](.github/dependabot.yml)) for weekly
   npm and GitHub Actions updates. Note that this file schedules *version-update* PRs only —
   Dependabot **alerts** are a separate repository setting under Settings → Code security.
   Alerts were disabled when this audit began and have since been enabled; all 10 alerts they
   raised were transitive dependencies of the HTTP transports, unreachable from this stdio
   server, and are cleared by the dependency refresh above.

No source changes were required.
