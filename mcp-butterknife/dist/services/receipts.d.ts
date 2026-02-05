/**
 * Receipt Chain — Cryptographic Evidence
 *
 * Every API call generates a hash-chained receipt.
 * The chain is tamper-evident: modifying any receipt
 * breaks all subsequent hashes.
 *
 */
import type { CallReceipt } from "../types.js";
export declare class ReceiptChain {
    private receipts;
    private receiptsPath;
    private contextId;
    constructor(receiptsPath: string, contextId?: string);
    getContextId(): string;
    /**
     * Generate a receipt for a completed API call.
     * The receipt is hash-chained to the previous one.
     */
    mint(providerId: string, cost: number, requestBody: unknown, responseBody: unknown): CallReceipt;
    /** Get the full receipt chain */
    getChain(): CallReceipt[];
    /** Get the last N receipts */
    getRecent(n: number): CallReceipt[];
    /** Verify chain integrity. Returns first broken link or null if valid. */
    verify(): {
        valid: boolean;
        brokenAt?: number;
        reason?: string;
    };
    /** Get chain summary stats */
    summary(): {
        totalReceipts: number;
        totalCost: number;
        byProvider: Record<string, {
            count: number;
            cost: number;
        }>;
        chainValid: boolean;
        contextId: string;
    };
    private load;
    private persist;
}
//# sourceMappingURL=receipts.d.ts.map