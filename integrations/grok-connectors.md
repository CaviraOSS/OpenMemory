<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : integrations/grok-connectors.md
 usage : documents connecting Grok's Bring Your Own MCP to LongMemory
-->

# Connect Grok to LongMemory over Bring Your Own MCP

xAI's [Connectors](https://docs.x.ai/grok/connectors) let Grok call external
MCP servers directly from a conversation, through a feature called **Bring
Your Own MCP**. LongMemory's Streamable HTTP MCP endpoint (`docs/mcp.md`)
works as a custom connector as-is — this guide covers exposing it to Grok
and securing it once it is reachable from xAI's infrastructure.

Unlike the local-stdio integrations in [`README.md`](README.md) (Claude Code,
Codex, Gemini CLI, agent frameworks), Grok's servers call your MCP endpoint
over the public internet. Grok will reject `localhost` and private network
addresses outright, so this is the one integration in this repository that
requires a public URL.

## 1. Start LongMemory with the MCP HTTP transport

```powershell
longmemory serve --db ./longmemory.db --mcp-http
```

This exposes `http://127.0.0.1:7331/mcp` alongside the REST API. Set
`LONGMEMORY_API_KEY` before starting the server — Grok's connector will reach
this endpoint from the public internet, and MCP enforces the same bearer
token or `X-API-Key` header as `/v1/*` once a key is configured (`docs/mcp.md`,
`src/server/middleware/auth.ts`). Do not run an internet-reachable MCP server
without an API key.

## 2. Make the endpoint reachable from Grok

Pick one of the following depending on whether this is a quick test or a
persistent connector.

### Quick test: a tunnel

For local testing, use a tunneling service to get a temporary public URL
pointed at your local server (xAI's own guidance:
[Custom MCP Server Tunneling](https://docs.x.ai/grok/connectors/custom-mcp-tunneling)).

```powershell
# ngrok
ngrok http 7331

# or Cloudflare Tunnel (quick tunnels support Streamable HTTP, which is what
# LongMemory uses; they do not support SSE, so this is a safe pairing)
cloudflared tunnel --url http://localhost:7331
```

Copy the forwarding URL (for example `https://a1b2c3d4.ngrok-free.app`) and
append `/mcp` to it when you add the connector in Grok. Tunnel URLs are
temporary: if you restart the tunnel, remove and re-add the connector in Grok
with the new URL.

### Persistent connector: a real deployment

For anything beyond a one-off test, deploy LongMemory behind a domain with
TLS termination — see `README.md`'s "Deployment Options" section (Docker
Compose, Heroku, Railway, Render, or DigitalOcean) — and point Grok at
`https://your-domain/mcp`. Keep `LONGMEMORY_API_KEY` set and review
`README.md`'s "Security" section (restrict allowed origins, terminate TLS at
the edge) before leaving the endpoint reachable from the public internet.

## 3. Add the custom connector in Grok

1. Go to [grok.com/connectors](https://grok.com/connectors).
2. Click **New Connector**, then select **Custom**.
3. Enter your MCP URL (`https://<host>/mcp`).
4. When prompted for authentication, use a bearer token set to your
   `LONGMEMORY_API_KEY` value.

Grok discovers LongMemory's tools automatically; no manual tool registration
is required. The full, deny-by-default tool list (`longmemory_recall`,
`longmemory_ingest`, `longmemory_explain`, and ten more) is documented in
`docs/mcp.md`.

## Keep identity fixed, not model-supplied

As with every other LongMemory MCP integration, tenant, user, project, agent,
and framework identity are fixed in server configuration
(`LONGMEMORY_TENANT_ID`, `LONGMEMORY_USER_ID`, `--project`); tool arguments
from a model can never impersonate another configured identity. Configure
scope once per deployment rather than trusting values an agent supplies at
call time.

## Troubleshooting

- **Grok rejects the URL.** It must be a public `https://` URL; `localhost`,
  `127.0.0.1`, and private ranges (`10.x`, `172.16.x`, `192.168.x`) are
  rejected outright.
- **Tool calls fail after working once.** Free-tier tunnel URLs usually
  change on restart, and the tunnel or local server must stay running for
  Grok to reach it — remove and re-add the connector with the current URL.
- **401/403 from LongMemory.** Confirm the bearer token matches
  `LONGMEMORY_API_KEY` exactly; MCP uses the same auth check as the REST API.
