#!/usr/bin/env node
/**
 * mcp-butterknife
 *
 * Don't let your lobster see the butter knife. 🔪🦞
 *
 * An MCP server that gives AI agents secure, budget-gated API access
 * without ever exposing a single credential.
 *
 * Every call gets a cryptographic receipt. Drop-in, works with any setup.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Vault } from "./services/vault.js";
import { Wallet, formatMicrodollars } from "./services/wallet.js";
import { ReceiptChain } from "./services/receipts.js";
import { ProviderRegistry } from "./services/providers.js";
import { ApiProxy, ProxyError } from "./services/proxy.js";
// ─── Configuration ─────────────────────────────────────────────
const DATA_DIR = process.env.BUTTERKNIFE_DATA_DIR ?? `${process.env.HOME ?? "."}/.butterknife`;
const BUDGET = parseInt(process.env.BUTTERKNIFE_BUDGET ?? "10000000", 10); // Default $10
// ─── Initialize Services ───────────────────────────────────────
const vault = new Vault(`${DATA_DIR}/vault.json`);
const wallet = new Wallet(`${DATA_DIR}/wallet.json`, BUDGET);
const receipts = new ReceiptChain(`${DATA_DIR}/receipts.json`);
const registry = new ProviderRegistry();
const proxy = new ApiProxy(vault, wallet, receipts, registry);
// ─── MCP Server ────────────────────────────────────────────────
const server = new McpServer({
    name: "mcp-butterknife",
    version: "0.1.0",
});
// ═══════════════════════════════════════════════════════════════
// TOOL: butterknife_call_api
// The main event — make an API call through the secure pipeline
// ═══════════════════════════════════════════════════════════════
server.registerTool("butterknife_call_api", {
    title: "Call API (Secure)",
    description: `Make an API call through the secure credential broker.

Your credentials are NEVER exposed — they're injected server-side at call time.
Every call is budget-checked before execution and generates a cryptographic receipt.

Pipeline: budget check → credential injection → API call → receipt → response

Args:
  - provider (string): Provider ID (e.g., "openai", "anthropic", "groq")
  - method (string): HTTP method
  - path (string): API path (appended to provider's base URL)
  - body (object, optional): Request body for POST/PUT/PATCH
  - headers (object, optional): Additional headers (auth is injected automatically)
  - query_params (object, optional): URL query parameters

Returns: { status, data, receipt, cost, remainingBudget }

The receipt contains a hash chain — tamper with any receipt and all subsequent ones break.`,
    inputSchema: {
        provider: z.string().describe('Provider ID, e.g. "openai", "anthropic"'),
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST").describe("HTTP method"),
        path: z.string().describe('API path, e.g. "/chat/completions"'),
        body: z.unknown().optional().describe("Request body (JSON)"),
        headers: z.record(z.string()).optional().describe("Additional headers (auth injected automatically)"),
        query_params: z.record(z.string()).optional().describe("URL query parameters"),
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
    },
}, async (params) => {
    try {
        const result = await proxy.call({
            providerId: params.provider,
            method: params.method,
            path: params.path,
            body: params.body,
            headers: params.headers,
            queryParams: params.query_params,
        });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        status: result.status,
                        data: result.data,
                        cost: formatMicrodollars(result.cost),
                        remainingBudget: formatMicrodollars(result.remainingBudget),
                        receipt: {
                            id: result.receipt.receiptId,
                            hash: result.receipt.receiptHash.slice(0, 16) + "...",
                            chainPosition: receipts.getChain().length,
                        },
                    }, null, 2),
                },
            ],
        };
    }
    catch (err) {
        const message = err instanceof ProxyError
            ? `[${err.code}] ${err.message}`
            : `Error: ${err instanceof Error ? err.message : String(err)}`;
        return { content: [{ type: "text", text: message }], isError: true };
    }
});
// ═══════════════════════════════════════════════════════════════
// TOOL: butterknife_store_credential
// Store a credential in the vault (agent won't see it again)
// ═══════════════════════════════════════════════════════════════
server.registerTool("butterknife_store_credential", {
    title: "Store Credential",
    description: `Store an API credential in the secure vault.

Once stored, the credential is NEVER returned to you. It's injected
server-side when you make API calls. You'll only see a fingerprint
(last 4 characters) to confirm which credential is active.

This is the butter knife going into the drawer. The lobster never sees it again. 🔪

Args:
  - provider (string): Provider ID (e.g., "openai", "anthropic")
  - credential (string): The API key or token

Returns: Confirmation with fingerprint (last 4 chars only)`,
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
}, async (params) => {
    const entry = vault.store(params.provider, params.credential);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    stored: true,
                    provider: entry.providerId,
                    fingerprint: `****${entry.fingerprint}`,
                    message: `Credential stored. You will never see this key again — it's injected automatically when you call ${entry.providerId}.`,
                }, null, 2),
            },
        ],
    };
});
// ═══════════════════════════════════════════════════════════════
// TOOL: butterknife_list_providers
// Show available providers and credential status
// ═══════════════════════════════════════════════════════════════
server.registerTool("butterknife_list_providers", {
    title: "List Providers",
    description: `List all available API providers and their credential status.

Shows which providers have credentials stored (with fingerprint only)
and which are missing credentials.

Returns: Array of providers with { id, name, hasCredential, fingerprint? }`,
    inputSchema: {},
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async () => {
    const providers = registry.list();
    const vaultEntries = vault.list();
    const vaultMap = new Map(vaultEntries.map((v) => [v.providerId, v]));
    const result = providers.map((p) => {
        const entry = vaultMap.get(p.id);
        return {
            id: p.id,
            name: p.name,
            baseUrl: p.baseUrl,
            hasCredential: !!entry?.active,
            fingerprint: entry ? `****${entry.fingerprint}` : null,
            costPerUnit: formatMicrodollars(p.costPerUnit),
            costUnit: p.costUnit,
        };
    });
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
});
// ═══════════════════════════════════════════════════════════════
// TOOL: butterknife_wallet
// Check budget status
// ═══════════════════════════════════════════════════════════════
server.registerTool("butterknife_wallet", {
    title: "Check Wallet",
    description: `Check your current budget status.

Shows total budget, amount spent, remaining balance, and per-provider breakdown.

Args:
  - action (string): "status" to check balance, "set_budget" to change budget, "reset" to clear spend history
  - budget (number, optional): New budget in dollars (for set_budget action)

Returns: Wallet state with totals and per-provider breakdown`,
    inputSchema: {
        action: z.enum(["status", "set_budget", "reset"]).default("status").describe("Wallet action"),
        budget: z.number().positive().optional().describe("New budget in dollars (for set_budget)"),
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    let state;
    switch (params.action) {
        case "set_budget":
            if (!params.budget) {
                return {
                    content: [{ type: "text", text: "Error: budget parameter required for set_budget action" }],
                    isError: true,
                };
            }
            state = wallet.setBudget(Math.round(params.budget * 1_000_000));
            break;
        case "reset":
            state = wallet.resetSpend();
            break;
        default:
            state = wallet.getState();
    }
    const formatted = {
        totalBudget: formatMicrodollars(state.totalBudget),
        spent: formatMicrodollars(state.spent),
        remaining: formatMicrodollars(state.remaining),
        byProvider: Object.fromEntries(Object.entries(state.byProvider).map(([k, v]) => [k, formatMicrodollars(v)])),
    };
    return {
        content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }],
    };
});
// ═══════════════════════════════════════════════════════════════
// TOOL: butterknife_receipts
// Query the cryptographic receipt chain
// ═══════════════════════════════════════════════════════════════
server.registerTool("butterknife_receipts", {
    title: "Receipt Chain",
    description: `Query the cryptographic receipt chain.

Every API call generates a hash-chained receipt. The chain is tamper-evident:
modifying any receipt breaks all subsequent hashes.

Args:
  - action (string): "summary" for overview, "recent" for last N receipts, "verify" to validate chain integrity
  - count (number, optional): Number of recent receipts to show (for "recent" action, default 5)

Returns: Receipt chain data or verification result`,
    inputSchema: {
        action: z.enum(["summary", "recent", "verify"]).default("summary").describe("What to query"),
        count: z.number().int().min(1).max(100).default(5).describe("Number of recent receipts (for 'recent' action)"),
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    let result;
    switch (params.action) {
        case "verify":
            result = receipts.verify();
            break;
        case "recent":
            result = receipts.getRecent(params.count).map(formatReceipt);
            break;
        default:
            const summary = receipts.summary();
            result = {
                ...summary,
                totalCost: formatMicrodollars(summary.totalCost),
                byProvider: Object.fromEntries(Object.entries(summary.byProvider).map(([k, v]) => [
                    k,
                    { count: v.count, cost: formatMicrodollars(v.cost) },
                ])),
            };
    }
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
});
// ═══════════════════════════════════════════════════════════════
// TOOL: butterknife_add_provider
// Register a custom API provider
// ═══════════════════════════════════════════════════════════════
server.registerTool("butterknife_add_provider", {
    title: "Add Custom Provider",
    description: `Register a custom API provider.

Adds a new provider configuration so you can route API calls through
the secure pipeline to any service.

Args:
  - id (string): Unique provider ID (lowercase, no spaces)
  - name (string): Human-readable name
  - base_url (string): Base URL for API calls
  - auth_method (string): How to inject credentials: "header", "query", or "body"
  - auth_field (string): Header name, query param name, or body field for credential
  - auth_prefix (string, optional): Prefix for credential value (e.g., "Bearer ")
  - cost_per_unit (number, optional): Cost per unit in microdollars (default: 1000)
  - cost_unit (string, optional): Unit type (default: "per_request")

Returns: Provider configuration`,
    inputSchema: {
        id: z.string().regex(/^[a-z0-9_-]+$/).describe("Provider ID (lowercase, no spaces)"),
        name: z.string().describe("Human-readable provider name"),
        base_url: z.string().url().describe("Base URL for API calls"),
        auth_method: z.enum(["header", "query", "body"]).describe("How credentials are injected"),
        auth_field: z.string().describe('Field name for credential (e.g., "Authorization")'),
        auth_prefix: z.string().optional().describe('Prefix for value (e.g., "Bearer ")'),
        cost_per_unit: z.number().int().min(0).default(1000).describe("Cost per unit in microdollars"),
        cost_unit: z.enum(["per_request", "per_1k_tokens", "per_1k_chars"]).default("per_request").describe("Cost unit"),
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    const provider = {
        id: params.id,
        name: params.name,
        baseUrl: params.base_url,
        authMethod: params.auth_method,
        authField: params.auth_field,
        authPrefix: params.auth_prefix,
        costPerUnit: params.cost_per_unit,
        costUnit: params.cost_unit,
    };
    registry.add(provider);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    added: true,
                    provider,
                    message: `Provider "${params.name}" registered. Use butterknife_store_credential to add its API key.`,
                }, null, 2),
            },
        ],
    };
});
// ─── Format Helpers ────────────────────────────────────────────
function formatReceipt(r) {
    return {
        receiptId: r.receiptId,
        provider: r.providerId,
        timestamp: r.timestamp,
        cost: formatMicrodollars(r.cost),
        hash: r.receiptHash.slice(0, 16) + "...",
        chainedFrom: r.previousReceiptHash.slice(0, 16) + "...",
    };
}
// ─── Start Server ──────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🔪🦞 mcp-butterknife running — credentials stay hidden");
}
main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map