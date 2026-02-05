/**
 * Wallet — Budget Gating
 *
 * Enforces economic limits on agent API usage.
 * No call proceeds without a passing budget check.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { WalletState, BudgetCheckResult } from "../types.js";

interface WalletData {
  totalBudget: number;
  spent: number;
  byProvider: Record<string, number>;
  createdAt: string;
}

export class Wallet {
  private data: WalletData;
  private walletPath: string;

  constructor(walletPath: string, budgetMicrodollars: number) {
    this.walletPath = walletPath;
    this.data = this.load(budgetMicrodollars);
  }

  /** Get current wallet state (safe for agent consumption) */
  getState(): WalletState {
    return {
      totalBudget: this.data.totalBudget,
      spent: this.data.spent,
      remaining: this.data.totalBudget - this.data.spent,
      byProvider: { ...this.data.byProvider },
    };
  }

  /**
   * Check if a call is within budget.
   * Returns allowed/denied with reason.
   */
  checkBudget(providerId: string, estimatedCost: number): BudgetCheckResult {
    const remaining = this.data.totalBudget - this.data.spent;

    if (estimatedCost > remaining) {
      return {
        allowed: false,
        reason: `Insufficient budget. Need ${formatMicrodollars(estimatedCost)}, have ${formatMicrodollars(remaining)} remaining.`,
        estimatedCost,
        remainingAfter: remaining - estimatedCost,
      };
    }

    return {
      allowed: true,
      estimatedCost,
      remainingAfter: remaining - estimatedCost,
    };
  }

  /**
   * Record a spend. Called AFTER successful API call.
   * Returns updated remaining balance.
   */
  recordSpend(providerId: string, cost: number): number {
    this.data.spent += cost;
    this.data.byProvider[providerId] =
      (this.data.byProvider[providerId] ?? 0) + cost;
    this.persist();
    return this.data.totalBudget - this.data.spent;
  }

  /** Set a new total budget */
  setBudget(microdollars: number): WalletState {
    this.data.totalBudget = microdollars;
    this.persist();
    return this.getState();
  }

  /** Reset spend tracking (keeps budget) */
  resetSpend(): WalletState {
    this.data.spent = 0;
    this.data.byProvider = {};
    this.persist();
    return this.getState();
  }

  // ─── Private ─────────────────────────────────────────────────

  private load(defaultBudget: number): WalletData {
    if (existsSync(this.walletPath)) {
      try {
        return JSON.parse(readFileSync(this.walletPath, "utf-8"));
      } catch {
        // Fall through to default
      }
    }
    return {
      totalBudget: defaultBudget,
      spent: 0,
      byProvider: {},
      createdAt: new Date().toISOString(),
    };
  }

  private persist(): void {
    const dir = dirname(this.walletPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.walletPath, JSON.stringify(this.data, null, 2), "utf-8");
  }
}

/** Format microdollars as human-readable string */
export function formatMicrodollars(micro: number): string {
  const dollars = micro / 1_000_000;
  if (dollars >= 0.01) return `$${dollars.toFixed(2)}`;
  if (dollars >= 0.001) return `$${dollars.toFixed(3)}`;
  return `$${dollars.toFixed(6)}`;
}
