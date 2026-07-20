<!-- read_when: Connecting Codex, Claude Code, ChatGPT, or another remote MCP client; deploying the MCP/OAuth endpoints; changing MCP tools or OAuth behavior. -->

# Remote MCP and browser OAuth

Anlok serves one Streamable HTTP MCP endpoint for every role:

```text
https://door.example.com/mcp
```

The server uses the same role and apartment checks as the REST API. A regular
resident sees only their own profile, credentials, and activity. An apartment
administrator is limited to their apartment. A building administrator retains
building-wide access. Inactive accounts cannot authorize or use MCP.

The MCP endpoint does not accept legacy Anlok bearer tokens, API keys, or tokens
in query strings. MCP OAuth access tokens are opaque, short-lived, audience-bound,
and stored only as hashes by the server. API keys remain a separate REST fallback
and are intentionally not part of MCP setup.

## Connect a client

Use the MCP server address shown under **Settings → Connections** in the Anlok web
app. The client opens a browser, Anlok sends the normal email login code, and the
resident reviews the client name and access before approving it.

Codex CLI, the Codex IDE extension, and the ChatGPT desktop app share MCP
configuration on the same Codex host. Add and authenticate Anlok with:

```bash
codex mcp add anlok --url https://door.example.com/mcp
codex mcp login anlok
```

The same server can be added in the desktop app under **Settings → MCP servers →
Add server**, using **Streamable HTTP**. Codex supports Streamable HTTP OAuth and
stores its MCP credentials separately from Anlok's browser session. See the
[current Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp).

For Claude Code:

```bash
claude mcp add --transport http anlok https://door.example.com/mcp
```

Then run `/mcp` in Claude Code and follow the browser sign-in prompt. See
[Anthropic's Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp).

Other MCP 2025-11-25 clients can discover OAuth from the `401` challenge and the
RFC 9728 protected-resource document. The authorization server supports public
client dynamic registration, authorization code with PKCE S256, refresh rotation,
and RFC 8707 resource binding.

## Tool safety and scope

The initial tool set includes:

- current profile and scoped access activity;
- door unlock for active residents;
- scoped users and apartments;
- scoped PIN and RFID credentials;
- scoped guest schedules; and
- reader status and control for building administrators.

Raw application logs, API-key administration, notification credentials, and auth
token administration are excluded. Tool discovery is role-aware, and every call
checks authorization again. Unlocking and every state-changing tool require an
explicit `confirm=true`; clients should explain the concrete effect and ask the
person before setting it. Delete, overwrite, and reader-stop tools carry
destructive MCP annotations.

## Local development

Localhost HTTP is allowed for development:

```dotenv
ENVIRONMENT=development
MCP_PUBLIC_URL=http://localhost:8000/mcp
OAUTH_ISSUER_URL=http://localhost:8000
WEB_APP_URL=http://localhost:3000
NEXT_PUBLIC_MCP_URL=http://localhost:8000/mcp
```

Start the API and web app normally, then use the localhost MCP URL. Local OAuth
redirects must use `http://localhost` or `http://127.0.0.1`; non-local redirects
must use HTTPS and match the registered URI exactly.

## Production deployment

Production must use canonical HTTPS URLs:

```dotenv
ENVIRONMENT=production
MCP_PUBLIC_URL=https://door.example.com/mcp
OAUTH_ISSUER_URL=https://door.example.com
WEB_APP_URL=https://access.example.com
NEXT_PUBLIC_MCP_URL=https://door.example.com/mcp
```

The API refuses startup when a production URL is insecure, when the issuer has a
path, or when the MCP resource URL does not identify `/mcp`. The reverse proxy or
tunnel for the OAuth issuer must send all of these paths to the same API process:

```text
/mcp
/.well-known/oauth-protected-resource/mcp
/.well-known/oauth-authorization-server
/oauth/authorize
/oauth/register
/oauth/token
/oauth/revoke
/oauth/authorization-requests/*
```

The web deployment must serve `/oauth/authorize` and use the same `WEB_APP_URL`
configured on the API. Do not place another login gateway in front of only some
OAuth paths: MCP clients need to read discovery and registration endpoints before
the Anlok browser login begins.

OAuth defaults are intentionally short: consent requests 10 minutes,
authorization codes 5 minutes, access tokens 15 minutes, and refresh families 30
days. Override the corresponding `OAUTH_*_TTL_SECONDS` values only after reviewing
the security impact. Used authorization codes remain unusable, refresh tokens
rotate on every use, and replay revokes the whole refresh family.
