/**
 * Receipt Chain — Cryptographic Evidence
 *
 * Every API call generates a hash-chained receipt.
 * The chain is tamper-evident: modifying any receipt
 * breaks all subsequent hashes.
 *
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
const GENESIS_HASH = "0".repeat(64);
export class ReceiptChain {
    receipts = [];
    receiptsPath;
    contextId;
    constructor(receiptsPath, contextId) {
        this.receiptsPath = receiptsPath;
        this.contextId = contextId ?? randomUUID();
        this.load();
    }
    getContextId() {
        return this.contextId;
    }
    /**
     * Generate a receipt for a completed API call.
     * The receipt is hash-chained to the previous one.
     */
    mint(providerId, cost, requestBody, responseBody) {
        const receiptId = randomUUID();
        const timestamp = new Date().toISOString();
        const requestHash = sha256(stableStringify(requestBody));
        const responseHash = sha256(stableStringify(responseBody));
        const previousReceiptHash = this.receipts.length > 0
            ? this.receipts[this.receipts.length - 1].receiptHash
            : GENESIS_HASH;
        // Receipt hash: H(receiptId || contextId || requestHash || responseHash || previousHash)
        const receiptHash = sha256(`${receiptId}||${this.contextId}||${requestHash}||${responseHash}||${previousReceiptHash}`);
        const receipt = {
            receiptId,
            contextId: this.contextId,
            providerId,
            timestamp,
            cost,
            requestHash,
            responseHash,
            previousReceiptHash,
            receiptHash,
        };
        this.receipts.push(receipt);
        this.persist();
        return receipt;
    }
    /** Get the full receipt chain */
    getChain() {
        return [...this.receipts];
    }
    /** Get the last N receipts */
    getRecent(n) {
        return this.receipts.slice(-n);
    }
    /** Verify chain integrity. Returns first broken link or null if valid. */
    verify() {
        for (let i = 0; i < this.receipts.length; i++) {
            const receipt = this.receipts[i];
            const expectedPrev = i === 0 ? GENESIS_HASH : this.receipts[i - 1].receiptHash;
            if (receipt.previousReceiptHash !== expectedPrev) {
                return {
                    valid: false,
                    brokenAt: i,
                    reason: `Receipt ${i} has wrong previousReceiptHash. Expected ${expectedPrev.slice(0, 16)}..., got ${receipt.previousReceiptHash.slice(0, 16)}...`,
                };
            }
            // Verify the receipt's own hash
            const expectedHash = sha256(`${receipt.receiptId}||${receipt.contextId}||${receipt.requestHash}||${receipt.responseHash}||${receipt.previousReceiptHash}`);
            if (receipt.receiptHash !== expectedHash) {
                return {
                    valid: false,
                    brokenAt: i,
                    reason: `Receipt ${i} hash mismatch. Receipt has been tampered with.`,
                };
            }
        }
        return { valid: true };
    }
    /** Get chain summary stats */
    summary() {
        const byProvider = {};
        let totalCost = 0;
        for (const r of this.receipts) {
            totalCost += r.cost;
            if (!byProvider[r.providerId]) {
                byProvider[r.providerId] = { count: 0, cost: 0 };
            }
            byProvider[r.providerId].count++;
            byProvider[r.providerId].cost += r.cost;
        }
        return {
            totalReceipts: this.receipts.length,
            totalCost,
            byProvider,
            chainValid: this.verify().valid,
            contextId: this.contextId,
        };
    }
    // ─── Private ─────────────────────────────────────────────────
    load() {
        if (!existsSync(this.receiptsPath))
            return;
        try {
            const data = JSON.parse(readFileSync(this.receiptsPath, "utf-8"));
            if (data.contextId)
                this.contextId = data.contextId;
            if (Array.isArray(data.receipts))
                this.receipts = data.receipts;
        }
        catch {
            // Start fresh
        }
    }
    persist() {
        const dir = dirname(this.receiptsPath);
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        writeFileSync(this.receiptsPath, JSON.stringify({ contextId: this.contextId, receipts: this.receipts }, null, 2), "utf-8");
    }
}
// ─── Utilities ─────────────────────────────────────────────────
function sha256(input) {
    return createHash("sha256").update(input, "utf-8").digest("hex");
}
/** Stable JSON stringification for deterministic hashing */
function stableStringify(obj) {
    if (obj === null || obj === undefined)
        return "null";
    if (typeof obj !== "object")
        return JSON.stringify(obj);
    if (Array.isArray(obj)) {
        return "[" + obj.map(stableStringify).join(",") + "]";
    }
    const sorted = Object.keys(obj).sort();
    return ("{" +
        sorted
            .map((k) => JSON.stringify(k) +
            ":" +
            stableStringify(obj[k]))
            .join(",") +
        "}");
}
//# sourceMappingURL=receipts.js.map