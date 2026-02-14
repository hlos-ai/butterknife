/**
 * HLOS-backed Tool Handlers
 *
 * All credential storage, budget enforcement, and receipt minting
 * happens server-side through the HLOS Kernel. The agent's machine
 * holds nothing but a session token.
 *
 * Agent responses are opaque by default — no cost breakdowns, no balances.
 * Set BUTTERKNIFE_VERBOSE=true for human-facing debug output.
 */

import { createHash, randomUUID } from "node:crypto";
import { isAuthError } from "../mode.js";
import type {
  ToolHandlers,
  ToolResult,
  ProxyKernelClient,
  CallApiParams,
  StoreCredentialParams,
  WalletParams,
  ReceiptsParams,
  AddProviderParams,
} from "../types.js";

const VERBOSE = process.env.BUTTERKNIFE_VERBOSE === "true";

// ─── Response Helpers ─────────────────────────────────────────────

function json(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function redirect(message: string, url: string): ToolResult {
  return json({
    message,
    url,
    action_required: "Visit the URL above to manage this on HLOS.",
  });
}

function error(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Map kernel errors to user-actionable messages. Prints stderr on auth failure. */
function handleKernelError(err: unknown, context: string): ToolResult {
  if (isAuthError(err)) {
    console.error(
      "⚠️  HLOS auth invalid. Run: npx mcp-butterknife --login"
    );
    return error(
      "HLOS authentication failed. Please run: npx mcp-butterknife --login"
    );
  }
  return error(
    `${context}: ${err instanceof Error ? err.message : String(err)}`
  );
}

// ─── Request Identity ─────────────────────────────────────────────

function correlationId(): string {
  return `cor_${randomUUID().replace(/-/g, "")}`;
}

function idempotencyKey(input: unknown): string {
  const requestId =
    input &&
    typeof input === "object" &&
    "request_id" in input &&
    typeof (input as Record<string, unknown>).request_id === "string"
      ? ((input as Record<string, unknown>).request_id as string)
      : undefined;
  const nonce = requestId ?? randomUUID();
  const hash = createHash("sha256")
    .update(`butterknife:call:${nonce}`)
    .digest("hex");
  return `idem_bk_${hash.slice(0, 32)}`;
}

// ─── v2 Operation Mapping ─────────────────────────────────────────

interface V2Operation {
  name: string;
  request: unknown;
}

/**
 * Map v1 callApi params to v2 operation shape.
 * Returns null if the operation is unsupported in v2 demo scope.
 */
function mapToV2Operation(params: CallApiParams): V2Operation | null {
  const path = params.path.replace(/^\/+/, ""); // strip leading slash

  if (
    params.provider === "openai" &&
    params.method === "POST" &&
    (path === "chat/completions" || path === "v1/chat/completions")
  ) {
    // Claude Desktop may send body as a JSON string — parse if needed
    let request = params.body ?? {};
    if (typeof request === "string") {
      try {
        request = JSON.parse(request);
      } catch {
        // leave as-is; server will reject with validation error
      }
    }
    return { name: "chat.completions", request };
  }

  return null;
}

// ─── Factory ──────────────────────────────────────────────────────

export function createHlosHandlers(
  kernel: ProxyKernelClient,
  dashboardUrl: string
): ToolHandlers {
  return {
    // ─── Core: Brokered API Call (v2 Proxy) ──────────────────────
    async callApi(params: CallApiParams): Promise<ToolResult> {
      const corId = correlationId();

      // v2 demo scope: only OpenAI chat completions
      const operation = mapToV2Operation(params);
      if (!operation) {
        return json({
          code: "UNSUPPORTED_OPERATION",
          message:
            "Only OpenAI chat completions supported in v2 demo.",
          next_step: "Use path /chat/completions.",
        });
      }

      try {
        const response = await kernel.post(
          "/api/v2/proxy/call",
          {
            provider: params.provider,
            operation: operation.name,
            request: operation.request,
          },
          {
            correlation_id: corId,
            idempotency_key: idempotencyKey(params),
          }
        );

        // Kernel returns the full response; we control what the agent sees
        const kernelData = response.data as Record<string, unknown>;
        const agentView: Record<string, unknown> = {
          status: kernelData.status,
          data: kernelData.data,
          receipt_id: kernelData.receipt_id,
        };

        if (VERBOSE) {
          agentView.cost = kernelData.cost;
          agentView.remaining_budget = kernelData.remaining_budget;
          agentView.correlation_id = corId;
          agentView.mode = "hlos";
        }

        return json(agentView);
      } catch (err) {
        return handleKernelError(err, "API call failed");
      }
    },

    // ─── Redirect: Credentials managed on platform ───────────────
    async storeCredential(params: StoreCredentialParams): Promise<ToolResult> {
      return redirect(
        `Credentials are managed securely on HLOS. Add your ${params.provider} credential there — it never touches this machine.`,
        `${dashboardUrl}/vault`
      );
    },

    // ─── Fetch: Provider list from kernel ─────────────────────────
    async listProviders(): Promise<ToolResult> {
      try {
        const response = await kernel.get("/proxy/providers", {
          correlation_id: correlationId(),
        });
        return json(response.data);
      } catch (err) {
        if (isAuthError(err)) return handleKernelError(err, "List providers");
        return redirect(
          "View available providers on HLOS.",
          `${dashboardUrl}/providers`
        );
      }
    },

    // ─── Fetch/Redirect: Wallet status from kernel ────────────────
    async wallet(params: WalletParams): Promise<ToolResult> {
      if (params.action === "status") {
        try {
          const response = await kernel.get("/wallet", {
            correlation_id: correlationId(),
          });
          return json(response.data);
        } catch (err) {
          if (isAuthError(err)) return handleKernelError(err, "Wallet status");
          return redirect(
            "View wallet status on HLOS.",
            `${dashboardUrl}/wallet`
          );
        }
      }
      return redirect(
        `Wallet management (${params.action}) is handled on HLOS.`,
        `${dashboardUrl}/wallet`
      );
    },

    // ─── Fetch/Redirect: Receipts from kernel ─────────────────────
    async receipts(params: ReceiptsParams): Promise<ToolResult> {
      if (params.action === "recent" || params.action === "summary") {
        try {
          const response = await kernel.get(
            `/proxy/receipts?action=${params.action}&count=${params.count}`,
            { correlation_id: correlationId() }
          );
          return json(response.data);
        } catch (err) {
          if (isAuthError(err)) return handleKernelError(err, "Receipts");
          return redirect(
            "View receipts on HLOS.",
            `${dashboardUrl}/receipts`
          );
        }
      }
      return redirect(
        "Verify receipt chain integrity on HLOS.",
        `${dashboardUrl}/receipts`
      );
    },

    // ─── Redirect: Custom providers managed on platform ───────────
    async addProvider(params: AddProviderParams): Promise<ToolResult> {
      return redirect(
        `Custom provider registration for "${params.name}" is managed on HLOS.`,
        `${dashboardUrl}/providers`
      );
    },
  };
}
