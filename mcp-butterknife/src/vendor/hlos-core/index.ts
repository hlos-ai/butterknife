/**
 * Vendored @hlos/mcp-core for mcp-butterknife v0.3.0
 *
 * Minimal subset: credentials, kernel client, auth.
 */

export {
  getCredentials,
  saveCredentials,
  clearCredentials,
  type HLOSCredentials,
  type McpTokenResult,
  type PlatformLinkResult,
  type AuthResult,
} from "./credentials.js";

export {
  createKernelClient,
  type KernelClient,
  type KernelClientConfig,
  type KernelRequestOptions,
  type KernelResponse,
} from "./client.js";

export { HLOSAuth } from "./auth.js";
