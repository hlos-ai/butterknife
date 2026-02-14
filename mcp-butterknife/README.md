# mcp-butterknife

**Don't let your lobster see the butter knife.**

An MCP server that gives AI agents secure, budget-gated API access — without ever exposing a single credential. Every call gets a cryptographic receipt.

## How it works

```
Agent says: "Call OpenAI /chat/completions"
    |
butterknife --> HLOS Backend
    |           |           |
    Budget      Credential  Receipt
    check       injection   minted
    |
Agent gets: { status: 200, data: {...}, receipt_id: "rcpt_..." }
```

Your agent never sees, stores, or has access to any API key. Ever.

## Quick Start

```bash
# Install
npm install -g mcp-butterknife

# Connect to HLOS (one-time setup)
mcp-butterknife --login

# Run the MCP server
mcp-butterknife
```

### MCP Config (Claude Desktop, Cursor, etc.)

```json
{
  "mcpServers": {
    "butterknife": {
      "command": "mcp-butterknife"
    }
  }
}
```

Then in your agent:

```
> Call OpenAI chat completions with "Hello world"
  Response received. receipt_id: rcpt_a1b2c3...

> Check my wallet
  View wallet at https://hlos.ai/wallet
```

## What happens on each call

1. **Auth** — Your `hlos_` token is validated against the HLOS kernel
2. **Budget gate** — Estimated cost checked against your wallet balance
3. **Credential injection** — API key injected server-side (never on your machine)
4. **API call** — Request forwarded to the provider
5. **Metering** — Actual usage charged to your wallet
6. **Receipt** — Cryptographic `SignedReceiptV0` minted and stored
7. **Response** — Agent sees `{ status, data, receipt_id }` only

The agent never sees keys, balances, or costs.

## Tools

| Tool | Description |
|------|-------------|
| `butterknife_call_api` | Make an API call through the secure pipeline |
| `butterknife_store_credential` | Store a credential (redirects to hlos.ai/vault) |
| `butterknife_list_providers` | Show available providers |
| `butterknife_wallet` | Check wallet status |
| `butterknife_receipts` | Query the receipt chain |
| `butterknife_add_provider` | Register a custom provider |

## Supported Operations

v0.3.0 supports OpenAI chat completions:

```json
{
  "provider": "openai",
  "method": "POST",
  "path": "/chat/completions",
  "body": {
    "model": "gpt-5.2-2025-12-11",
    "messages": [{ "role": "user", "content": "Hello" }]
  }
}
```

Other operations return an `UNSUPPORTED_OPERATION` error with guidance:

```json
{
  "code": "UNSUPPORTED_OPERATION",
  "message": "Only OpenAI chat completions supported in v2 demo.",
  "next_step": "Use path /chat/completions."
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HLOS_ACCESS_TOKEN` | — | HLOS access token (or use `--login`) |
| `HLOS_API_URL` | `https://hlos.ai` | HLOS API base URL |
| `HLOS_DASHBOARD_URL` | `https://hlos.ai` | Dashboard URL for redirect links |
| `BUTTERKNIFE_VERBOSE` | `false` | Show cost/debug info in tool responses |

## Credentials

Credentials are stored in `~/.hlos/credentials.json` (mode 600). You can also set `HLOS_ACCESS_TOKEN` as an environment variable.

To get a token:
1. Visit [hlos.ai/vault](https://hlos.ai/vault)
2. Create an API token with `mcp:*` permissions
3. Run `mcp-butterknife --login` and paste the token

## License

Apache 2.0
