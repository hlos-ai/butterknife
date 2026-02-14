#!/usr/bin/env node
/**
 * mcp-butterknife
 *
 * Don't let your lobster see the butter knife. 🔪🦞
 *
 * An MCP server that gives AI agents secure, budget-gated API access
 * without ever exposing a single credential.
 *
 * All credentials, wallet, and receipts live on HLOS.
 * Nothing on disk except a session token.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { bootstrap, login } from "./mode.js";
import { createHlosHandlers } from "./hlos/handlers.js";

// ─── CLI Commands ─────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--login") || args.includes("login")) {
  await login();
  process.exit(0);
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`🔪🦞 mcp-butterknife — Credential-brokered API access for AI agents

Usage:
  mcp-butterknife              Start MCP server (stdio transport)
  mcp-butterknife --login      Connect to HLOS (device auth flow)
  mcp-butterknife --help       Show this help

Environment:
  HLOS_ACCESS_TOKEN            HLOS access token (or use --login)
  HLOS_API_URL                 HLOS API base URL (default: https://hlos.ai)
  HLOS_DASHBOARD_URL           Dashboard URL (default: https://hlos.ai)
  BUTTERKNIFE_VERBOSE          Set "true" for cost/debug in tool responses

Requires:
  HLOS account                 Sign up at https://hlos.ai`);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log("0.3.2");
  process.exit(0);
}

// ─── Bootstrap (fail-fast if HLOS is not configured) ─────────────

const ctx = await bootstrap();
const handlers = createHlosHandlers(ctx.kernel, ctx.dashboardUrl);

// ─── MCP Server ───────────────────────────────────────────────────

const server = new McpServer({
  name: "mcp-butterknife",
  version: "0.3.2",
});

// ═══════════════════════════════════════════════════════════════════
// TOOL: butterknife_call_api
// The main event — make an API call through the secure pipeline
// ═══════════════════════════════════════════════════════════════════

server.registerTool(
  "butterknife_call_api",
  {
    title: "Call API (Secure)",
    description: `Make an API call through the secure credential broker.

Your credentials are NEVER exposed — they're injected server-side at call time.
Every call is budget-checked and generates a cryptographic receipt.

Pipeline: budget check → credential injection → API call → receipt → response`,
    inputSchema: {
      provider: z.string().describe('Provider ID, e.g. "openai", "anthropic"'),
      method: z
        .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
        .default("POST")
        .describe("HTTP method"),
      path: z.string().describe('API path, e.g. "/chat/completions"'),
      body: z.unknown().optional().describe("Request body (JSON)"),
      headers: z
        .record(z.string())
        .optional()
        .describe("Additional headers"),
      query_params: z
        .record(z.string())
        .optional()
        .describe("URL query parameters"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (params) => handlers.callApi(params)
);

// ═══════════════════════════════════════════════════════════════════
// TOOL: butterknife_store_credential
// Store a credential (redirects to HLOS platform)
// ═══════════════════════════════════════════════════════════════════

server.registerTool(
  "butterknife_store_credential",
  {
    title: "Store Credential",
    description: `Store an API credential securely. Once stored, it's never returned — only injected at call time.`,
    inputSchema: {
      provider: z.string().describe('Provider ID, e.g. "openai"'),
      credential: z.string().min(1).describe("API key or token"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => handlers.storeCredential(params)
);

// ═══════════════════════════════════════════════════════════════════
// TOOL: butterknife_list_providers
// Show available providers and credential status
// ═══════════════════════════════════════════════════════════════════

server.registerTool(
  "butterknife_list_providers",
  {
    title: "List Providers",
    description: `List available API providers and their credential status.`,
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => handlers.listProviders()
);

// ═══════════════════════════════════════════════════════════════════
// TOOL: butterknife_wallet
// Check budget status
// ═══════════════════════════════════════════════════════════════════

server.registerTool(
  "butterknife_wallet",
  {
    title: "Check Wallet",
    description: `Check budget status, set limits, or reset spend history.`,
    inputSchema: {
      action: z
        .enum(["status", "set_budget", "reset"])
        .default("status")
        .describe("Wallet action"),
      budget: z
        .number()
        .positive()
        .optional()
        .describe("New budget in dollars (for set_budget)"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => handlers.wallet(params)
);

// ═══════════════════════════════════════════════════════════════════
// TOOL: butterknife_receipts
// Query the cryptographic receipt chain
// ═══════════════════════════════════════════════════════════════════

server.registerTool(
  "butterknife_receipts",
  {
    title: "Receipt Chain",
    description: `Query the cryptographic receipt chain for audit and reconciliation.`,
    inputSchema: {
      action: z
        .enum(["summary", "recent", "verify"])
        .default("summary")
        .describe("What to query"),
      count: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(5)
        .describe("Number of recent receipts"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => handlers.receipts(params)
);

// ═══════════════════════════════════════════════════════════════════
// TOOL: butterknife_add_provider
// Register a custom API provider
// ═══════════════════════════════════════════════════════════════════

server.registerTool(
  "butterknife_add_provider",
  {
    title: "Add Custom Provider",
    description: `Register a custom API provider for routing calls through the broker.`,
    inputSchema: {
      id: z
        .string()
        .regex(/^[a-z0-9_-]+$/)
        .describe("Provider ID (lowercase, no spaces)"),
      name: z.string().describe("Human-readable provider name"),
      base_url: z.string().url().describe("Base URL for API calls"),
      auth_method: z
        .enum(["header", "query", "body"])
        .describe("How credentials are injected"),
      auth_field: z
        .string()
        .describe('Field name for credential (e.g., "Authorization")'),
      auth_prefix: z
        .string()
        .optional()
        .describe('Prefix for value (e.g., "Bearer ")'),
      cost_per_unit: z
        .number()
        .int()
        .min(0)
        .default(1000)
        .describe("Cost per unit in microdollars"),
      cost_unit: z
        .enum(["per_request", "per_1k_tokens", "per_1k_chars"])
        .default("per_request")
        .describe("Cost unit"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params) => handlers.addProvider(params)
);

// ─── Start Server ─────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
