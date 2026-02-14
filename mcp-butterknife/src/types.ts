/**
 * mcp-butterknife types
 *
 * HLOS-only. All types here support the kernel-backed tool handlers.
 */

// ─── MCP Tool Result ─────────────────────────────────────────────

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

// ─── Kernel Client Interface ─────────────────────────────────────

/** Minimal interface for kernel HTTP calls */
export interface ProxyKernelClient {
  get<T = unknown>(
    path: string,
    options?: KernelRequestOpts
  ): Promise<KernelResponse<T>>;
  post<T = unknown>(
    path: string,
    body: unknown,
    options: KernelRequestOpts
  ): Promise<KernelResponse<T>>;
}

export interface KernelRequestOpts {
  request_id?: string;
  correlation_id?: string;
  idempotency_key?: string;
}

export interface KernelResponse<T = unknown> {
  data: T;
}

// ─── Tool Handler Params ─────────────────────────────────────────

export interface CallApiParams {
  provider: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  query_params?: Record<string, string>;
}

export interface StoreCredentialParams {
  provider: string;
  credential: string;
}

export interface WalletParams {
  action: "status" | "set_budget" | "reset";
  budget?: number;
}

export interface ReceiptsParams {
  action: "summary" | "recent" | "verify";
  count: number;
}

export interface AddProviderParams {
  id: string;
  name: string;
  base_url: string;
  auth_method: "header" | "query" | "body";
  auth_field: string;
  auth_prefix?: string;
  cost_per_unit: number;
  cost_unit: "per_request" | "per_1k_tokens" | "per_1k_chars";
}

// ─── Tool Handlers Interface ─────────────────────────────────────

export interface ToolHandlers {
  callApi(params: CallApiParams): Promise<ToolResult>;
  storeCredential(params: StoreCredentialParams): Promise<ToolResult>;
  listProviders(): Promise<ToolResult>;
  wallet(params: WalletParams): Promise<ToolResult>;
  receipts(params: ReceiptsParams): Promise<ToolResult>;
  addProvider(params: AddProviderParams): Promise<ToolResult>;
}
