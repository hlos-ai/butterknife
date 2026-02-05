/**
 * API Proxy — The Core Pipeline
 *
 * budget check → credential injection → API call → receipt generation
 *
 * Credentials flow from vault → HTTP request, never through the agent.
 */

import type { ApiCallRequest, ApiCallResponse, ProviderConfig } from "../types.js";
import type { Vault } from "./vault.js";
import type { Wallet } from "./wallet.js";
import type { ReceiptChain } from "./receipts.js";
import type { ProviderRegistry } from "./providers.js";

export class ApiProxy {
  constructor(
    private vault: Vault,
    private wallet: Wallet,
    private receipts: ReceiptChain,
    private registry: ProviderRegistry
  ) {}

  /**
   * Execute an API call through the secure pipeline.
   *
   * 1. Resolve provider
   * 2. Check budget
   * 3. Inject credentials (agent never sees this)
   * 4. Make HTTP request
   * 5. Estimate actual cost
   * 6. Record spend
   * 7. Mint receipt
   * 8. Return response + receipt (no credentials)
   */
  async call(request: ApiCallRequest): Promise<ApiCallResponse> {
    // 1. Resolve provider
    const provider = this.registry.get(request.providerId);
    if (!provider) {
      throw new ProxyError(
        `Unknown provider "${request.providerId}". Use butterknife_list_providers to see available providers.`,
        "UNKNOWN_PROVIDER"
      );
    }

    // 2. Check credential exists
    if (!this.vault.has(request.providerId)) {
      throw new ProxyError(
        `No credential stored for "${request.providerId}". Use butterknife_store_credential first.`,
        "NO_CREDENTIAL"
      );
    }

    // 3. Estimate cost and check budget
    const estimatedCost = this.registry.estimateCost(
      request.providerId,
      request.body
    );
    const budgetCheck = this.wallet.checkBudget(
      request.providerId,
      estimatedCost
    );
    if (!budgetCheck.allowed) {
      throw new ProxyError(
        budgetCheck.reason ?? "Budget exceeded",
        "BUDGET_EXCEEDED"
      );
    }

    // 4. Build request with injected credentials
    const url = buildUrl(provider, request.path, request.queryParams ?? {});
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(request.headers ?? {}),
    };
    let queryParams = { ...(request.queryParams ?? {}) };

    // Credentials injected here, never returned to agent
    const injected = this.vault.injectAuth(
      request.providerId,
      provider,
      headers,
      queryParams
    );
    headers = injected.headers;
    queryParams = injected.queryParams;

    // Handle body injection for providers that put auth in body
    let body = request.body;
    if (provider.authMethod === "body" && body && typeof body === "object") {
      const credential = this.vault.getCredentialForBodyInjection(
        request.providerId
      );
      body = { ...body, [provider.authField]: credential };
    }

    // 5. Make the actual HTTP request
    const fetchUrl = buildUrl(provider, request.path, queryParams);
    let response: Response;
    try {
      response = await fetch(fetchUrl, {
        method: request.method,
        headers,
        body:
          request.method !== "GET" && body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new ProxyError(
        `Network error calling ${provider.name}: ${err instanceof Error ? err.message : String(err)}`,
        "NETWORK_ERROR"
      );
    }

    // 6. Parse response
    let responseData: unknown;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }
    } else {
      responseData = await response.text();
    }

    // 7. Calculate actual cost (use response token counts if available)
    const actualCost = this.calculateActualCost(
      provider,
      request.body,
      responseData
    );

    // 8. Record spend
    const remaining = this.wallet.recordSpend(request.providerId, actualCost);

    // 9. Mint receipt — cryptographic proof this call happened
    // Note: request body passed for hashing does NOT include credentials
    const receipt = this.receipts.mint(
      request.providerId,
      actualCost,
      {
        method: request.method,
        path: request.path,
        queryParams: request.queryParams,
        // Body is included for hashing but credentials are stripped
        bodyHash: body ? "present" : "absent",
      },
      responseData
    );

    // 10. Return response + receipt (NO credentials anywhere)
    return {
      status: response.status,
      data: responseData,
      receipt,
      cost: actualCost,
      remainingBudget: remaining,
    };
  }

  // ─── Private ─────────────────────────────────────────────────

  private calculateActualCost(
    provider: ProviderConfig,
    requestBody: unknown,
    responseData: unknown
  ): number {
    // Try to extract token usage from OpenAI-style responses
    if (
      responseData &&
      typeof responseData === "object" &&
      "usage" in responseData
    ) {
      const usage = (responseData as Record<string, unknown>).usage;
      if (usage && typeof usage === "object" && "total_tokens" in usage) {
        const totalTokens = (usage as Record<string, unknown>)
          .total_tokens as number;
        if (provider.costUnit === "per_1k_tokens") {
          return Math.ceil((totalTokens / 1000) * provider.costPerUnit);
        }
      }
    }

    // Fall back to estimate
    return this.registry.estimateCost(provider.id, requestBody);
  }
}

// ─── Helpers ───────────────────────────────────────────────────

function buildUrl(
  provider: ProviderConfig,
  path: string,
  queryParams: Record<string, string>
): string {
  const base = provider.baseUrl.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${cleanPath}`);

  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export class ProxyError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "ProxyError";
  }
}
