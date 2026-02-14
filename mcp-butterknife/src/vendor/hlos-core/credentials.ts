/**
 * HLOS Credential Management
 *
 * Reads/writes credentials from:
 *   1. HLOS_ACCESS_TOKEN environment variable (takes priority)
 *   2. ~/.hlos/credentials.json file
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ─── Types ───────────────────────────────────────────────────────

export interface HLOSCredentials {
  version: number;
  accessToken: string;
  keyId?: string;
  keyPrefix?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface McpTokenResult {
  kind: "mcp_token";
  accessToken: string;
  tokenType: "Bearer";
  keyId?: string;
  keyPrefix?: string;
  createdAt?: string;
  expiresAt?: string;
}

export interface PlatformLinkResult {
  kind: "platform_linked";
  platform: string;
  platformTeamId: string;
  platformUserId: string;
  userId: string;
  scopes?: string[];
}

export type AuthResult = McpTokenResult | PlatformLinkResult;

// ─── Paths ───────────────────────────────────────────────────────

function defaultCredentialsPath(): string {
  return join(homedir(), ".hlos", "credentials.json");
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Get stored HLOS credentials.
 *
 * Checks HLOS_ACCESS_TOKEN env var first, then ~/.hlos/credentials.json.
 * Returns null if no credentials found.
 */
export function getCredentials(
  credentialsPath?: string
): HLOSCredentials | null {
  // 1. Environment variable takes priority
  const envToken = process.env.HLOS_ACCESS_TOKEN;
  if (envToken) {
    return {
      version: 1,
      accessToken: envToken,
      createdAt: new Date().toISOString(),
    };
  }

  // 2. Read from credentials file
  const filePath = credentialsPath ?? defaultCredentialsPath();
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as HLOSCredentials;
    if (parsed.accessToken) {
      return parsed;
    }
  } catch {
    // File doesn't exist or is invalid
  }

  return null;
}

/**
 * Save credentials to ~/.hlos/credentials.json.
 */
export function saveCredentials(
  result: McpTokenResult,
  credentialsPath?: string
): void {
  const filePath = credentialsPath ?? defaultCredentialsPath();
  const dir = join(filePath, "..");

  mkdirSync(dir, { recursive: true });

  const creds: HLOSCredentials = {
    version: 1,
    accessToken: result.accessToken,
    keyId: result.keyId,
    keyPrefix: result.keyPrefix,
    createdAt: result.createdAt ?? new Date().toISOString(),
    expiresAt: result.expiresAt,
  };

  writeFileSync(filePath, JSON.stringify(creds, null, 2) + "\n", {
    mode: 0o600,
  });
}

/**
 * Clear stored credentials.
 */
export function clearCredentials(credentialsPath?: string): void {
  const filePath = credentialsPath ?? defaultCredentialsPath();
  try {
    writeFileSync(filePath, "{}\n", { mode: 0o600 });
  } catch {
    // File doesn't exist — nothing to clear
  }
}
