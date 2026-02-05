/**
 * Vault — Credential Store
 *
 * Credentials are stored here and NEVER returned to agents.
 * At call time, the vault injects credentials into outbound requests
 * so the agent never observes them.
 */
import type { ProviderConfig, VaultEntry } from "../types.js";
export declare class Vault {
    private records;
    private vaultPath;
    constructor(vaultPath: string);
    /** Store a credential. Returns a safe entry (no secret). */
    store(providerId: string, credential: string): VaultEntry;
    /** Remove a credential */
    remove(providerId: string): boolean;
    /** List all stored credentials — returns SAFE entries only (no secrets) */
    list(): VaultEntry[];
    /** Check if a provider has a stored credential */
    has(providerId: string): boolean;
    /**
     * Inject credentials into an outbound request.
     * This is the ONLY way credentials leave the vault —
     * they go directly into the HTTP request, never to the agent.
     */
    injectAuth(providerId: string, provider: ProviderConfig, headers: Record<string, string>, queryParams: Record<string, string>): {
        headers: Record<string, string>;
        queryParams: Record<string, string>;
    };
    /** Get raw credential for body injection (internal use only) */
    getCredentialForBodyInjection(providerId: string): string;
    private toSafeEntry;
    private load;
    private persist;
}
//# sourceMappingURL=vault.d.ts.map