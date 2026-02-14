/**
 * HLOS Bootstrap
 *
 * Butterknife requires an active HLOS connection.
 * If auth is missing or invalid, the server refuses to start.
 */

import type { ProxyKernelClient } from "./types.js";
import {
  getCredentials,
  saveCredentials,
  HLOSAuth,
  createKernelClient,
} from "./vendor/hlos-core/index.js";

export interface BootstrapResult {
  kernel: ProxyKernelClient;
  dashboardUrl: string;
}

const DASHBOARD_URL =
  process.env.HLOS_DASHBOARD_URL ?? "https://hlos.ai";

/** Check if an error is a 401/403 auth failure from the kernel */
function isAuthError(err: unknown): boolean {
  if (err && typeof err === "object") {
    if ("httpStatus" in err) {
      const status = (err as { httpStatus: number }).httpStatus;
      return status === 401 || status === 403;
    }
    if ("status" in err) {
      const status = (err as { status: number }).status;
      return status === 401 || status === 403;
    }
  }
  return false;
}

/**
 * Bootstrap HLOS connection. Fail-fast if anything is wrong.
 *
 * Checks:
 *   1. Credentials exist (~/.hlos/credentials.json or HLOS_ACCESS_TOKEN)
 *   2. Auth is valid (GET /api/v2/proxy/ping returns non-401/403)
 *
 * If any check fails, prints actionable guidance to stderr and exits.
 */
export async function bootstrap(): Promise<BootstrapResult> {
  // 1. Check for credentials
  const credentials = getCredentials();
  if (!credentials) {
    console.error(
      "❌ No HLOS credentials found.\n" +
        "   Run: npx mcp-butterknife --login"
    );
    process.exit(1);
  }

  // 2. Create kernel client and validate auth
  const kernel = createKernelClient({
    auth_token: credentials.accessToken,
  });

  try {
    await kernel.get("/api/v2/proxy/ping");
  } catch (pingErr) {
    if (isAuthError(pingErr)) {
      console.error(
        "❌ HLOS auth invalid or expired.\n" +
          "   Run: npx mcp-butterknife --login"
      );
      process.exit(1);
    }
    // Non-auth errors (network, 404 for not-yet-deployed endpoint)
    // — proceed; individual tool calls will surface errors
  }

  console.error("🔪🦞 butterknife connected to HLOS");
  return { kernel, dashboardUrl: DASHBOARD_URL };
}

/**
 * Interactive login — connects to HLOS.
 * Called via: npx mcp-butterknife --login
 */
export async function login(): Promise<void> {
  try {
    const auth = new HLOSAuth();

    console.log("🔪🦞 Connecting to HLOS...\n");
    const result = await auth.authenticate();

    if (result.kind === "mcp_token") {
      saveCredentials(result);
      console.log("\n✅ Connected to HLOS! Credentials saved.");
      console.log("   Manage credentials: https://hlos.ai/vault");
      console.log("   Manage wallet:      https://hlos.ai/wallet");
    } else {
      console.log("\n✅ Platform linked:", result.platform);
    }
  } catch (err) {
    console.error(
      "\n❌ Authentication failed:",
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  }
}

/** Exported for use by handler modules */
export { isAuthError };
