/**
 * mcp-butterknife types
 */

// ─── Provider Registry ───────────────────────────────────────────

export interface ProviderConfig {
  /** Unique provider identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Base URL for API calls */
  baseUrl: string;
  /** How credentials are injected: header, query, or body */
  authMethod: "header" | "query" | "body";
  /** Header name or query param name for the credential */
  authField: string;
  /** Optional: prefix for the auth value (e.g., "Bearer ") */
  authPrefix?: string;
  /** Cost per 1K tokens or per request (in microdollars) */
  costPerUnit: number;
  /** Unit type for cost calculation */
  costUnit: "per_request" | "per_1k_tokens" | "per_1k_chars";
}

// ─── Vault ───────────────────────────────────────────────────────

export interface VaultEntry {
  /** Provider this credential belongs to */
  providerId: string;
  /** When the credential was stored (never exposed to agents) */
  storedAt: string;
  /** Credential fingerprint (last 4 chars, for display only) */
  fingerprint: string;
  /** Whether the credential is currently valid */
  active: boolean;
}

// Credentials are NEVER in this type — they live only in the vault's
// internal store and are injected at call time without agent visibility.

// ─── Wallet (Budget Gating) ──────────────────────────────────────

export interface WalletState {
  /** Total budget in microdollars */
  totalBudget: number;
  /** Amount spent so far */
  spent: number;
  /** Amount remaining */
  remaining: number;
  /** Per-provider spend breakdown */
  byProvider: Record<string, number>;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  estimatedCost: number;
  remainingAfter: number;
}

// ─── Receipts (Cryptographic Evidence) ───────────────────────────

export interface CallReceipt {
  /** Unique receipt identifier */
  receiptId: string;
  /** Execution context identifier */
  contextId: string;
  /** Provider that was called */
  providerId: string;
  /** Timestamp of the call */
  timestamp: string;
  /** Cost of the call in microdollars */
  cost: number;
  /** SHA-256 hash of the request (excluding credentials) */
  requestHash: string;
  /** SHA-256 hash of the response */
  responseHash: string;
  /** Chained hash linking to previous receipt */
  previousReceiptHash: string;
  /** Receipt hash: H(receiptId || contextId || requestHash || responseHash || previousReceiptHash) */
  receiptHash: string;
}

// ─── API Call Types ──────────────────────────────────────────────

export interface ApiCallRequest {
  /** Which provider to call */
  providerId: string;
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path (appended to provider's baseUrl) */
  path: string;
  /** Request headers (credentials are NEVER included — injected by vault) */
  headers?: Record<string, string>;
  /** Request body (for POST/PUT/PATCH) */
  body?: unknown;
  /** Query parameters */
  queryParams?: Record<string, string>;
}

export interface ApiCallResponse {
  /** HTTP status code */
  status: number;
  /** Response body */
  data: unknown;
  /** Receipt proving this call happened */
  receipt: CallReceipt;
  /** Cost of this call in microdollars */
  cost: number;
  /** Remaining budget after this call */
  remainingBudget: number;
}

// ─── Configuration ───────────────────────────────────────────────

export interface ButterKnifeConfig {
  /** Path to provider registry file, or inline config */
  providers: ProviderConfig[];
  /** Total budget in microdollars (default: 10_000_000 = $10) */
  budgetMicrodollars: number;
  /** Path to credential store (default: ~/.butterknife/vault.json) */
  vaultPath: string;
  /** Path to receipt chain (default: ~/.butterknife/receipts.json) */
  receiptsPath: string;
  /** Execution context ID (auto-generated if not provided) */
  contextId?: string;
}
