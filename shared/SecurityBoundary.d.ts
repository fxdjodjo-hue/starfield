/**
 * Security Boundary - separa logica client da server
 * Il client NON deve mai avere accesso a metodi server-side
 */
export declare class SecurityBoundary {
    /**
     * Verifica che siamo nel contesto corretto
     * Questa funzione è critica per prevenire code sharing accidentale
     */
    static assertClientContext(): void;
    static assertServerContext(): void;
    /**
     * Client-side validation (non sicura - solo per UX)
     * Il client PUÒ fare validazione leggera per migliorare l'esperienza utente
     * MA il server DOVRÀ sempre fare validazione completa
     */
    static clientValidate(data: any, type: string): boolean;
    /**
     * Server-side validation (sicura)
     * Il server DEVE sempre validare tutto l'input dal client
     * Questa è l'unica validazione che conta per la sicurezza
     */
    static serverValidate(data: any, type: string): {
        isValid: boolean;
        errors: string[];
    };
}
/**
 * Trust Model - regole assolute di fiducia
 * Il server NON deve MAI fidarsi del client per:
 */
export declare const TRUST_MODEL: {
    /**
     * Il client NON può mai modificare direttamente:
     * - Health/shield di altre entity
     * - Inventory di altri giocatori
     * - Posizioni server-authoritative
     * - Stati di combattimento
     */
    readonly NEVER_TRUST_CLIENT_FOR: readonly ["entity_health", "entity_shield", "player_inventory", "server_positions", "combat_state", "upgrade_levels"];
    /**
     * Il client PUÒ fornire input per:
     * - Propria posizione (con validazione)
     * - Input di movimento
     * - Richieste di azione (con validazione)
     * - Messaggi chat (con sanitizzazione)
     */
    readonly CLIENT_CAN_PROVIDE: readonly ["own_position_input", "movement_input", "action_requests", "chat_messages"];
    /**
     * Il server DEVE sempre:
     * - Validare tutti gli input
     * - Sanitizzare i dati
     * - Applicare limiti di velocità
     * - Verificare autorità
     */
    readonly SERVER_MUST_ALWAYS: readonly ["validate_all_inputs", "sanitize_data", "enforce_rate_limits", "check_authority"];
};
/**
 * Security Zones - livelli di fiducia nel codice
 */
export declare enum SecurityZone {
    /**
     * CLIENT_ZONE - Codice che gira nel browser
     * Non fidarsi mai dei dati che arrivano da qui
     */
    CLIENT_ZONE = "client_zone",
    /**
     * SERVER_ZONE - Codice che gira sul server
     * Fidarsi solo dopo validazione completa
     */
    SERVER_ZONE = "server_zone",
    /**
     * SHARED_ZONE - Codice/Type utilizzabili da entrambi
     * Non deve contenere logica di business privata
     */
    SHARED_ZONE = "shared_zone"
}
/**
 * Boundary Enforcement - funzioni per applicare i confini
 */
export declare class BoundaryEnforcement {
    /**
     * Verifica che una chiamata provenga dalla zona corretta
     */
    static enforceZone(expectedZone: SecurityZone): void;
    /**
     * Verifica che il client non stia tentando di modificare dati riservati
     */
    static validateClientIntent(messageType: string, data: any): {
        allowed: boolean;
        reason?: string;
    };
}
/**
 * Security Audit - funzioni per verificare che il codice sia sicuro
 */
export declare class SecurityAudit {
    /**
     * Verifica che i shared types non contengano logica riservata
     */
    static auditSharedTypes(): {
        violations: string[];
    };
    /**
     * Verifica che il client non importi moduli server
     */
    static auditClientImports(): {
        violations: string[];
    };
}
//# sourceMappingURL=SecurityBoundary.d.ts.map