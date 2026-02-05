/**
 * Wallet — Budget Gating
 *
 * Enforces economic limits on agent API usage.
 * No call proceeds without a passing budget check.
 */
import type { WalletState, BudgetCheckResult } from "../types.js";
export declare class Wallet {
    private data;
    private walletPath;
    constructor(walletPath: string, budgetMicrodollars: number);
    /** Get current wallet state (safe for agent consumption) */
    getState(): WalletState;
    /**
     * Check if a call is within budget.
     * Returns allowed/denied with reason.
     */
    checkBudget(providerId: string, estimatedCost: number): BudgetCheckResult;
    /**
     * Record a spend. Called AFTER successful API call.
     * Returns updated remaining balance.
     */
    recordSpend(providerId: string, cost: number): number;
    /** Set a new total budget */
    setBudget(microdollars: number): WalletState;
    /** Reset spend tracking (keeps budget) */
    resetSpend(): WalletState;
    private load;
    private persist;
}
/** Format microdollars as human-readable string */
export declare function formatMicrodollars(micro: number): string;
//# sourceMappingURL=wallet.d.ts.map