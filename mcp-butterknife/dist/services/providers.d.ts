/**
 * Provider Registry
 *
 * Manages known API providers and their configurations.
 * Ships with sensible defaults for common AI providers.
 */
import type { ProviderConfig } from "../types.js";
/** Built-in provider configurations */
export declare const DEFAULT_PROVIDERS: ProviderConfig[];
export declare class ProviderRegistry {
    private providers;
    constructor(customProviders?: ProviderConfig[]);
    get(providerId: string): ProviderConfig | undefined;
    list(): ProviderConfig[];
    add(provider: ProviderConfig): void;
    has(providerId: string): boolean;
    /**
     * Estimate cost for a request.
     * Very rough — real cost tracking should use response token counts.
     */
    estimateCost(providerId: string, requestBody?: unknown): number;
}
//# sourceMappingURL=providers.d.ts.map