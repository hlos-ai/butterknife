/**
 * HLOS Kernel Client
 *
 * Minimal HTTP client for calling HLOS kernel endpoints.
 * Maps KernelRequestOptions to X-HLOS-* headers.
 */

// ─── Types ───────────────────────────────────────────────────────

export interface KernelClientConfig {
  base_url?: string;
  auth_token?: string;
  default_timeout_ms?: number;
  max_retries?: number;
}

export interface KernelRequestOptions {
  request_id?: string;
  correlation_id?: string;
  idempotency_key?: string;
  timeout_ms?: number;
}

export interface KernelResponse<T = unknown> {
  data: T;
  meta?: {
    request_id?: string;
    correlation_id?: string;
    processing_time_ms?: number;
  };
}

export interface KernelClient {
  get<T = unknown>(
    path: string,
    options?: KernelRequestOptions
  ): Promise<KernelResponse<T>>;
  post<T = unknown>(
    path: string,
    body: unknown,
    options: KernelRequestOptions
  ): Promise<KernelResponse<T>>;
  put<T = unknown>(
    path: string,
    body: unknown,
    options: KernelRequestOptions
  ): Promise<KernelResponse<T>>;
  patch<T = unknown>(
    path: string,
    body: unknown,
    options: KernelRequestOptions
  ): Promise<KernelResponse<T>>;
  delete<T = unknown>(
    path: string,
    options?: KernelRequestOptions
  ): Promise<KernelResponse<T>>;
}

// ─── Defaults ────────────────────────────────────────────────────

const DEFAULT_BASE_URL =
  process.env.HLOS_API_URL ?? "https://hlos.ai";
const DEFAULT_TIMEOUT_MS = 30_000;

// ─── Implementation ──────────────────────────────────────────────

interface KernelError extends Error {
  httpStatus: number;
  body: unknown;
}

function kernelError(
  message: string,
  status: number,
  body: unknown
): KernelError {
  const err = new Error(message) as KernelError;
  err.httpStatus = status;
  err.body = body;
  return err;
}

function buildHeaders(
  authToken: string | undefined,
  options?: KernelRequestOptions
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-HLOS-Surface": "mcp-butterknife",
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  if (options?.request_id) {
    headers["X-HLOS-Request-Id"] = options.request_id;
  }
  if (options?.correlation_id) {
    headers["X-HLOS-Correlation-Id"] = options.correlation_id;
  }
  if (options?.idempotency_key) {
    headers["X-HLOS-Idempotency-Key"] = options.idempotency_key;
  }

  return headers;
}

async function request<T>(
  baseUrl: string,
  authToken: string | undefined,
  method: string,
  path: string,
  body: unknown | undefined,
  options: KernelRequestOptions | undefined,
  timeoutMs: number
): Promise<KernelResponse<T>> {
  const url = `${baseUrl}${path}`;
  const headers = buildHeaders(authToken, options);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const responseBody = await res.json().catch(() => null);

    if (!res.ok) {
      throw kernelError(
        `HLOS ${method} ${path} returned ${res.status}`,
        res.status,
        responseBody
      );
    }

    return { data: responseBody as T };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Create an HLOS kernel client.
 */
export function createKernelClient(
  config?: KernelClientConfig
): KernelClient {
  const baseUrl = (config?.base_url ?? DEFAULT_BASE_URL).replace(
    /\/+$/,
    ""
  );
  const authToken = config?.auth_token;
  const timeoutMs = config?.default_timeout_ms ?? DEFAULT_TIMEOUT_MS;

  return {
    get: <T>(path: string, options?: KernelRequestOptions) =>
      request<T>(baseUrl, authToken, "GET", path, undefined, options, timeoutMs),

    post: <T>(path: string, body: unknown, options: KernelRequestOptions) =>
      request<T>(baseUrl, authToken, "POST", path, body, options, timeoutMs),

    put: <T>(path: string, body: unknown, options: KernelRequestOptions) =>
      request<T>(baseUrl, authToken, "PUT", path, body, options, timeoutMs),

    patch: <T>(path: string, body: unknown, options: KernelRequestOptions) =>
      request<T>(baseUrl, authToken, "PATCH", path, body, options, timeoutMs),

    delete: <T>(path: string, options?: KernelRequestOptions) =>
      request<T>(baseUrl, authToken, "DELETE", path, undefined, options, timeoutMs),
  };
}
