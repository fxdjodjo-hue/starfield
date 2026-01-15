// ======================================================================
// SECURITY BOUNDARY - CommonJS version for server
// ======================================================================

/**
 * Security Boundary - separa logica client da server
 * Il client NON deve mai avere accesso a metodi server-side
 */
class SecurityBoundary {
  /**
   * Verifica che siamo nel contesto corretto
   * Questa funzione è critica per prevenire code sharing accidentale
   */
  static assertClientContext() {
    // In produzione, verifica che non siamo in Node.js environment
    if (typeof window === 'undefined') {
      throw new Error('SECURITY VIOLATION: Client code running in server context');
    }
  }

  static assertServerContext() {
    // Verifica che siamo in Node.js environment
    if (typeof window !== 'undefined') {
      throw new Error('SECURITY VIOLATION: Server code running in client context');
    }
  }

  /**
   * Server-side validation (sicura)
   * Il server DEVE sempre validare tutto l'input dal client
   * Questa è l'unica validazione che conta per la sicurezza
   */
  static serverValidate(data, type) {
    this.assertServerContext();

    // Qui va la validazione reale - chiama ServerInputValidator
    const errors = [];

    // Implementazione della validazione server-side sicura
    switch (type) {
      case 'position':
        if (typeof data.x !== 'number' || isNaN(data.x)) {
          errors.push('Invalid X position');
        }
        if (typeof data.y !== 'number' || isNaN(data.y)) {
          errors.push('Invalid Y position');
        }
        break;
      case 'chat':
        if (typeof data.content !== 'string') {
          errors.push('Content must be string');
        }
        if (data.content.length > 200) {
          errors.push('Content too long');
        }
        break;
    }

    return { isValid: errors.length === 0, errors };
  }
}

// ======================================================================
// TRUST MODEL - Cosa il server NON deve mai fidarsi
// ======================================================================

const TRUST_MODEL = {
  /**
   * Il client NON può mai modificare direttamente:
   * - Health/shield di altre entity
   * - Inventory di altri giocatori
   * - Posizioni server-authoritative
   * - Stati di combattimento
   */
  NEVER_TRUST_CLIENT_FOR: [
    'entity_health',
    'entity_shield',
    'player_inventory',
    'server_positions',
    'combat_state',
    'upgrade_levels'
  ],

  /**
   * Il client PUÒ fornire input per:
   * - Propria posizione (con validazione)
   * - Input di movimento
   * - Richieste di azione (con validazione)
   * - Messaggi chat (con sanitizzazione)
   */
  CLIENT_CAN_PROVIDE: [
    'own_position_input',
    'movement_input',
    'action_requests',
    'chat_messages'
  ],

  /**
   * Il server DEVE sempre:
   * - Validare tutti gli input
   * - Sanitizzare i dati
   * - Applicare limiti di velocità
   * - Verificare autorità
   */
  SERVER_MUST_ALWAYS: [
    'validate_all_inputs',
    'sanitize_data',
    'enforce_rate_limits',
    'check_authority'
  ]
};

// ======================================================================
// BOUNDARY ENFORCEMENT - Applicazione dei confini
// ======================================================================

class BoundaryEnforcement {
  /**
   * Verifica che il client non stia tentando di modificare dati riservati
   */
  static validateClientIntent(messageType, data) {
    SecurityBoundary.assertServerContext();

    // Il client non può mai modificare direttamente questi dati
    const forbiddenFields = [
      'health', 'maxHealth', 'shield', 'maxShield',
      'inventory', 'upgrades', 'quests'
    ];

    for (const field of forbiddenFields) {
      if (data[field] !== undefined) {
        return {
          allowed: false,
          reason: `Client attempted to modify forbidden field: ${field}`
        };
      }
    }

    // Controlli specifici per tipo di messaggio
    switch (messageType) {
      case 'position_update':
        // Il client può fornire posizione propria, ma il server deve validarla
        return { allowed: true };

      case 'heartbeat':
        // Heartbeat per mantenere connessione viva
        return { allowed: true };

      case 'chat_message':
        // Il client può inviare chat, ma il server deve sanitizzarla
        return { allowed: true };

      case 'join':
        // Il client può richiedere di joinare il game
        return { allowed: true };

      case 'start_combat':
      case 'stop_combat':
        // Il client può richiedere combattimento, ma il server decide
        return { allowed: true };

      case 'request_player_data':
        // Il client può richiedere i propri dati dal server
        return { allowed: true };

      // 🔴 SECURITY: economy_update RIMOSSO - le valute sono gestite SOLO dal server

      case 'save_request':
        // Il client può richiedere un salvataggio immediato
        return { allowed: true };

      case 'save_response':
        // Il server risponde alle richieste di salvataggio
        return { allowed: true };

      case 'skill_upgrade_request':
        // Il client può richiedere upgrade skill, ma il server valida e applica
        return { allowed: true };

      default:
        // Per default, consentire ma loggare per review con più dettagli
        console.warn(`[SECURITY] Unknown message type: ${messageType}. Supported types: position_update, heartbeat, chat_message, join, start_combat, stop_combat, request_player_data, skill_upgrade_request`);
        return { allowed: true };
    }
  }
}

module.exports = {
  SecurityBoundary,
  TRUST_MODEL,
  BoundaryEnforcement
};