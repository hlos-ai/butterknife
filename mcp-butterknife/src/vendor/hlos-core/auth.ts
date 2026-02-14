/**
 * HLOS Authentication
 *
 * For v0.3.0, supports token-based login:
 *   1. Reads HLOS_ACCESS_TOKEN env var
 *   2. Prompts user to paste an API token from hlos.ai/vault
 */

import { createInterface } from "node:readline";
import type { McpTokenResult, AuthResult } from "./credentials.js";

export class HLOSAuth {
  async authenticate(
    _options?: { silent?: boolean }
  ): Promise<AuthResult> {
    // 1. Check environment variable
    const envToken = process.env.HLOS_ACCESS_TOKEN;
    if (envToken) {
      return this.tokenResult(envToken);
    }

    // 2. Interactive: prompt for token
    console.log("  Get your API token at: https://hlos.ai/vault");
    console.log("  Create a token with mcp:* permissions.\n");

    const token = await this.prompt("  Paste your hlos_ token: ");
    const trimmed = token.trim();

    if (!trimmed) {
      throw new Error(
        "No token provided. Get one at https://hlos.ai/vault"
      );
    }

    if (!trimmed.startsWith("hlos_")) {
      throw new Error(
        'Token must start with "hlos_". Get one at https://hlos.ai/vault'
      );
    }

    return this.tokenResult(trimmed);
  }

  private tokenResult(token: string): McpTokenResult {
    return {
      kind: "mcp_token",
      accessToken: token,
      tokenType: "Bearer",
      createdAt: new Date().toISOString(),
    };
  }

  private prompt(question: string): Promise<string> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }
}
