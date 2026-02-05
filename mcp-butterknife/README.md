# 🔪🦞 mcp-butterknife

**Don't let your lobster see the butter knife.**

An MCP server that gives AI agents secure, budget-gated API access — without ever exposing a single credential. Every call gets a cryptographic receipt.

## What it does

Your agent has perfect memory. So why hand it your API keys?

**mcp-butterknife** sits between your agent and external APIs. When your agent needs to call OpenAI, Anthropic, Groq, or any API:

1. **Budget check** — Is the agent within its spending limit?
2. **Credential injection** — API key flows from vault → HTTP request (never through the agent)
3. **API call** — Request goes out with proper auth
4. **Receipt** — A hash-chained cryptographic receipt proves the call happened
5. **Response** — Agent gets the data back (no credentials anywhere)

The agent never sees, stores, or has access to any API key. Ever.

## Quick Start

```bash
# Install
npm install -g mcp-butterknife

# Add to your MCP config (e.g., claude_desktop_config.json)
{
  "mcpServers": {
    "butterknife": {
      "command": "mcp-butterknife",
      "env": {
        "BUTTERKNIFE_BUDGET": "10000000"
      }
    }
  }
}
```

Then in your agent:

```
> Store my OpenAI key: sk-proj-abc123...
✓ Credential stored. You will never see this key again.

> Call OpenAI chat completions with "Hello world"
✓ Response received. Cost: $0.003. Receipt: a1b2c3d4...

> Check my budget
✓ Remaining: $9.997 of $10.00
```

## Tools

| Tool | What it does |
|------|-------------|
| `butterknife_call_api` | Make an API call through the secure pipeline |
| `butterknife_store_credential` | Store a credential (never returned) |
| `butterknife_list_providers` | Show providers and credential status |
| `butterknife_wallet` | Check budget, set limits, reset spend |
| `butterknife_receipts` | Query the cryptographic receipt chain |
| `butterknife_add_provider` | Register a custom API provider |

## Built-in Providers

OpenAI, Anthropic, Groq, Together AI, Fireworks AI, Perplexity — or add your own.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BUTTERKNIFE_DATA_DIR` | `~/.butterknife` | Where vault, wallet, and receipts are stored |
| `BUTTERKNIFE_BUDGET` | `10000000` | Default budget in microdollars ($10) |

## The Receipt Chain

Every API call generates a receipt containing:
- Request hash (credentials excluded)
- Response hash
- Cost
- Timestamp
- **Previous receipt hash** — creating a tamper-evident chain

Modify any receipt and every subsequent hash breaks. This isn't logging — it's evidence.

## License

Apache 2.0 — See [LICENSE](../LICENSE) for details.
