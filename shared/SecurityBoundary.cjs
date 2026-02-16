// ======================================================================
// SECURITY BOUNDARY - Confini tra Client e Server
// Questo file definisce cosa è PERMESSO e cosa è VIETATO
// ======================================================================

const { CLIENT_TO_SERVER_MESSAGE_TYPES } = require('./NetworkMessageCatalog.cjs');

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
   * Client-side validation (non sicura - solo per UX)
   * Il client PUÒ fare validazione leggera per migliorare l'esperienza utente
   * MA il server DOVRÀ sempre fare validazione completa
   */
  static clientValidate(data, type) {
    this.assertClientContext();

    // Validazione leggera per UX - il server farà validazione reale
    switch (type) {
      case 'position':
        return typeof data.x === 'number' && typeof data.y === 'number';
      case 'chat':
        return typeof data.content === 'string' && data.content.length <= 200;
      default:
        return true;
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

/**
 * Trust Model - regole assolute di fiducia
 * Il server NON deve MAI fidarsi del client per:
 */
const TRUST_MODEL = {
  /**
   * Identity model (authoritative sources)
   * - auth_id: UUID from auth provider, persistent DB key
   * - player_id: numeric DB id used for HUD/display only
   * - clientId: ephemeral WebSocket connection id (never persisted)
   */
  IDENTITY_MODEL: {
    auth_id: 'UUID from auth provider; primary persistence key',
    player_id: 'numeric player_id for display/HUD only',
    clientId: 'ephemeral WebSocket connection id (routing only)'
  },

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
    'upgrade_levels',
    'server_time',
    'server_tick'
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
    'chat_messages',
    'client_timestamp_for_interpolation'
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
    'check_authority',
    'treat_client_timestamp_as_advisory'
  ]
};

// ======================================================================
// SECURITY ZONES - Zone di fiducia nel codice
// ======================================================================

/**
 * Security Zones - livelli di fiducia nel codice
 * Usa const object invece di enum per compatibilità con erasableSyntaxOnly
 */
const SecurityZone = {
  /**
   * CLIENT_ZONE - Codice che gira nel browser
   * Non fidarsi mai dei dati che arrivano da qui
   */
  CLIENT_ZONE: 'client_zone',

  /**
   * SERVER_ZONE - Codice che gira sul server
   * Fidarsi solo dopo validazione completa
   */
  SERVER_ZONE: 'server_zone',

  /**
   * SHARED_ZONE - Codice/Type utilizzabili da entrambi
   * Non deve contenere logica di business privata
   */
  SHARED_ZONE: 'shared_zone'
};

// ======================================================================
// BOUNDARY ENFORCEMENT - Applicazione dei confini
// ======================================================================

/**
 * Boundary Enforcement - funzioni per applicare i confini
 */
class BoundaryEnforcement {
  /**
   * Verifica che una chiamata provenga dalla zona corretta
   */
  static enforceZone(expectedZone) {
    switch (expectedZone) {
      case SecurityZone.CLIENT_ZONE:
        SecurityBoundary.assertClientContext();
        break;
      case SecurityZone.SERVER_ZONE:
        SecurityBoundary.assertServerContext();
        break;
      case SecurityZone.SHARED_ZONE:
        // Shared zone può essere chiamata da entrambi
        break;
    }
  }

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

    // Whitelist dei tipi di messaggio permessi dal client al server.
    const allowedClientMessageTypes = CLIENT_TO_SERVER_MESSAGE_TYPES;

    // Controlli specifici per tipo di messaggio
    switch (messageType) {
      case 'position_update':
        // Il client può fornire posizione propria, ma il server deve validarla
        return { allowed: true };

      case 'chat_message':
        // Il client può inviare chat, ma il server deve sanitizzarla
        return { allowed: true };

      case 'start_combat':
      case 'stop_combat':
        // Il client può richiedere combattimento, ma il server decide
        return { allowed: true };

      case 'request_player_data':
        // Il client può richiedere i propri dati dal server
        return { allowed: true };

      case 'save_request':
        // Il client può richiedere un salvataggio immediato
        return { allowed: true };

      case 'equip_item':
        // Il client può richiedere di equipaggiare item
        return { allowed: true };
      case 'sell_item':
        // Il client può richiedere la vendita di un item
        return { allowed: true };
      case 'ship_skin_action':
        return { allowed: true };
      case 'resource_collect':
        return { allowed: true };

      case 'join':
      case 'heartbeat':
      case 'projectile_fired':
      case 'player_respawn_request':
      case 'global_monitor_request':
      case 'skill_upgrade_request':
      case 'request_leaderboard':
      case 'portal_use':
      case 'quest_progress_update':
      case 'quest_accept':
      case 'quest_abandon':
        // Messaggi di connessione e sistema permessi
        return { allowed: true };

      default:
        // Solo i tipi non nella whitelist vengono rifiutati
        if (!allowedClientMessageTypes.includes(messageType)) {
          return {
            allowed: false,
            reason: `Unknown or disallowed message type: ${messageType}. Allowed types: ${allowedClientMessageTypes.join(', ')}`
          };
        }
        return { allowed: true };
    }
  }
}

// ======================================================================
// SECURITY AUDIT - Per verificare conformità
// ======================================================================

/**
 * Security Audit - funzioni per verificare che il codice sia sicuro
 */
class SecurityAudit {
  /**
   * Verifica che i shared types non contengano logica riservata
   */
  static auditSharedTypes() {
    const violations = [];

    // Questo sarebbe implementato per analizzare i file shared/
    // e verificare che non contengano riferimenti a logica server

    return { violations };
  }

  /**
   * Verifica che il client non importi moduli server
   */
  static auditClientImports() {
    const violations = [];

    // Questo sarebbe implementato per analizzare le dipendenze
    // e verificare che il client non importi server/

    return { violations };
  }
}

// Export delle classi e costanti necessarie
module.exports = {
  SecurityBoundary,
  TRUST_MODEL,
  SecurityZone,
  BoundaryEnforcement,
  SecurityAudit
};
