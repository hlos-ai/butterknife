/**
 * Provider Registry
 *
 * Manages known API providers and their configurations.
 * Ships with sensible defaults for common AI providers.
 */

import type { ProviderConfig } from "../types.js";

/** Built-in provider configurations */
export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    authMethod: "header",
    authField: "Authorization",
    authPrefix: "Bearer ",
    costPerUnit: 3000, // $0.003 per 1K tokens (gpt-4o-mini input)
    costUnit: "per_1k_tokens",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    authMethod: "header",
    authField: "x-api-key",
    costPerUnit: 3000,
    costUnit: "per_1k_tokens",
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    authMethod: "header",
    authField: "Authorization",
    authPrefix: "Bearer ",
    costPerUnit: 500, // $0.0005 per 1K tokens
    costUnit: "per_1k_tokens",
  },
  {
    id: "together",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    authMethod: "header",
    authField: "Authorization",
    authPrefix: "Bearer ",
    costPerUnit: 2000,
    costUnit: "per_1k_tokens",
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    authMethod: "header",
    authField: "Authorization",
    authPrefix: "Bearer ",
    costPerUnit: 2000,
    costUnit: "per_1k_tokens",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    baseUrl: "https://api.perplexity.ai",
    authMethod: "header",
    authField: "Authorization",
    authPrefix: "Bearer ",
    costPerUnit: 1000,
    costUnit: "per_request",
  },
];

export class ProviderRegistry {
  private providers: Map<string, ProviderConfig> = new Map();

  constructor(customProviders?: ProviderConfig[]) {
    // Load defaults
    for (const p of DEFAULT_PROVIDERS) {
      this.providers.set(p.id, p);
    }
    // Override/add custom
    if (customProviders) {
      for (const p of customProviders) {
        this.providers.set(p.id, p);
      }
    }
  }

  get(providerId: string): ProviderConfig | undefined {
    return this.providers.get(providerId);
  }

  list(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  add(provider: ProviderConfig): void {
    this.providers.set(provider.id, provider);
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /**
   * Estimate cost for a request.
   * Very rough — real cost tracking should use response token counts.
   */
  estimateCost(providerId: string, requestBody?: unknown): number {
    const provider = this.providers.get(providerId);
    if (!provider) return 0;

    switch (provider.costUnit) {
      case "per_request":
        return provider.costPerUnit;
      case "per_1k_tokens": {
        // Rough estimate: ~4 chars per token, estimate from body size
        const bodyStr =
          typeof requestBody === "string"
            ? requestBody
            : JSON.stringify(requestBody ?? "");
        const estimatedTokens = Math.ceil(bodyStr.length / 4);
        return Math.ceil((estimatedTokens / 1000) * provider.costPerUnit);
      }
      case "per_1k_chars": {
        const charStr =
          typeof requestBody === "string"
            ? requestBody
            : JSON.stringify(requestBody ?? "");
        return Math.ceil((charStr.length / 1000) * provider.costPerUnit);
      }
      default:
        return provider.costPerUnit;
    }
  }
}
