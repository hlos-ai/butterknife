/**
 * API Proxy — The Core Pipeline
 *
 * budget check → credential injection → API call → receipt generation
 *
 * Credentials flow from vault → HTTP request, never through the agent.
 */
import type { ApiCallRequest, ApiCallResponse } from "../types.js";
import type { Vault } from "./vault.js";
import type { Wallet } from "./wallet.js";
import type { ReceiptChain } from "./receipts.js";
import type { ProviderRegistry } from "./providers.js";
export declare class ApiProxy {
    private vault;
    private wallet;
    private receipts;
    private registry;
    constructor(vault: Vault, wallet: Wallet, receipts: ReceiptChain, registry: ProviderRegistry);
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
    call(request: ApiCallRequest): Promise<ApiCallResponse>;
    private calculateActualCost;
}
export declare class ProxyError extends Error {
    code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=proxy.d.ts.map