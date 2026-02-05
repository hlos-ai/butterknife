/**
 * Vault — Credential Store
 *
 * Credentials are stored here and NEVER returned to agents.
 * At call time, the vault injects credentials into outbound requests
 * so the agent never observes them.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
export class Vault {
    records = new Map();
    vaultPath;
    constructor(vaultPath) {
        this.vaultPath = vaultPath;
        this.load();
    }
    /** Store a credential. Returns a safe entry (no secret). */
    store(providerId, credential) {
        const record = {
            providerId,
            credential,
            storedAt: new Date().toISOString(),
            active: true,
        };
        this.records.set(providerId, record);
        this.persist();
        return this.toSafeEntry(record);
    }
    /** Remove a credential */
    remove(providerId) {
        const deleted = this.records.delete(providerId);
        if (deleted)
            this.persist();
        return deleted;
    }
    /** List all stored credentials — returns SAFE entries only (no secrets) */
    list() {
        return Array.from(this.records.values()).map((r) => this.toSafeEntry(r));
    }
    /** Check if a provider has a stored credential */
    has(providerId) {
        const record = this.records.get(providerId);
        return record !== undefined && record.active;
    }
    /**
     * Inject credentials into an outbound request.
     * This is the ONLY way credentials leave the vault —
     * they go directly into the HTTP request, never to the agent.
     */
    injectAuth(providerId, provider, headers, queryParams) {
        const record = this.records.get(providerId);
        if (!record || !record.active) {
            throw new Error(`No active credential for provider "${providerId}". Use butterknife_store_credential to add one.`);
        }
        const value = (provider.authPrefix ?? "") + record.credential;
        switch (provider.authMethod) {
            case "header":
                headers[provider.authField] = value;
                break;
            case "query":
                queryParams[provider.authField] = value;
                break;
            case "body":
                // Body injection handled separately in proxy
                break;
        }
        return { headers, queryParams };
    }
    /** Get raw credential for body injection (internal use only) */
    getCredentialForBodyInjection(providerId) {
        const record = this.records.get(providerId);
        if (!record || !record.active) {
            throw new Error(`No active credential for provider "${providerId}".`);
        }
        return record.credential;
    }
    // ─── Private ─────────────────────────────────────────────────
    toSafeEntry(record) {
        return {
            providerId: record.providerId,
            storedAt: record.storedAt,
            fingerprint: record.credential.slice(-4),
            active: record.active,
        };
    }
    load() {
        if (!existsSync(this.vaultPath))
            return;
        try {
            const data = JSON.parse(readFileSync(this.vaultPath, "utf-8"));
            if (Array.isArray(data)) {
                for (const record of data) {
                    this.records.set(record.providerId, record);
                }
            }
        }
        catch {
            // Start fresh on corrupt file
        }
    }
    persist() {
        const dir = dirname(this.vaultPath);
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        writeFileSync(this.vaultPath, JSON.stringify(Array.from(this.records.values()), null, 2), "utf-8");
    }
}
//# sourceMappingURL=vault.js.map