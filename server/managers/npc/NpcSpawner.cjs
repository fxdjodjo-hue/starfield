// NpcSpawner - Creazione e inizializzazione NPC
// Responsabilità: Creazione singolo NPC, inizializzazione bulk, aggiornamento stato
// Dipendenze: logger, NPC_CONFIG, mapServer.npcs, npcIdCounter

const { logger } = require('../../logger.cjs');
const { NPC_CONFIG } = require('../../config/constants.cjs');

class NpcSpawner {
  constructor(mapServer, npcs, npcIdCounter) {
    this.mapServer = mapServer;
    this.npcs = npcs;
    this.npcIdCounter = npcIdCounter;
  }

  /**
   * Calcola le coordinate del mondo dinamicamente
   * @returns {{WORLD_LEFT: number, WORLD_RIGHT: number, WORLD_TOP: number, WORLD_BOTTOM: number}}
   */
  getWorldBounds() {
    // Usa valori dal mapServer con fallback sicuro
    const WORLD_WIDTH = Number(this.mapServer?.WORLD_WIDTH) || 21000;
    const WORLD_HEIGHT = Number(this.mapServer?.WORLD_HEIGHT) || 13100;
    
    return {
      WORLD_LEFT: -WORLD_WIDTH / 2,
      WORLD_RIGHT: WORLD_WIDTH / 2,
      WORLD_TOP: -WORLD_HEIGHT / 2,
      WORLD_BOTTOM: WORLD_HEIGHT / 2
    };
  }

  /**
   * Crea un nuovo NPC nel mondo
   * @param {string} type - Tipo di NPC ('Scouter' o 'Kronos')
   * @param {number} x - Posizione X (opzionale, casuale se non specificata)
   * @param {number} y - Posizione Y (opzionale, casuale se non specificata)
   * @param {boolean} silent - Se true, non logga la creazione (per inizializzazione bulk)
   * @returns {string} npcId
   */
  createNpc(type, x, y, silent = false) {
    const npcId = `npc_${this.npcIdCounter.value++}`;

    // Normalizza il tipo: assicura che sia maiuscolo (Scouter, Kronos)
    const normalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    const validType = normalizedType === 'Scouter' || normalizedType === 'Kronos' ? normalizedType : type;

    // Se non specificate, genera posizioni casuali ENTRO i confini del mondo
    const bounds = this.getWorldBounds();
    const width = bounds.WORLD_RIGHT - bounds.WORLD_LEFT;
    const height = bounds.WORLD_BOTTOM - bounds.WORLD_TOP;
    
    // Validazione: se width o height sono NaN, usa fallback
    const finalX = x ?? (Number.isFinite(width) && Number.isFinite(bounds.WORLD_LEFT) 
      ? (Math.random() * width + bounds.WORLD_LEFT)
      : (Math.random() - 0.5) * 21000);
    const finalY = y ?? (Number.isFinite(height) && Number.isFinite(bounds.WORLD_TOP)
      ? (Math.random() * height + bounds.WORLD_TOP)
      : (Math.random() - 0.5) * 13100);
    
    // Validazione finale: se ancora NaN, non creare NPC
    if (!Number.isFinite(finalX) || !Number.isFinite(finalY)) {
      logger.error('NPC', `Failed to generate valid position for ${npcId}. Bounds:`, bounds);
      return null;
    }

    // Statistiche base per tipo dal config condiviso
    const stats = NPC_CONFIG[validType].stats;

    // Velocità iniziale basata sulla configurazione NPC (direzione casuale, velocità dalla config)
    const initialSpeed = stats.speed; // Usa velocità massima - poi regolata dal sistema di movimento
    const angle = Math.random() * Math.PI * 2;

    const npc = {
      id: npcId,
      type: validType,
      position: { x: finalX, y: finalY, rotation: Math.random() * Math.PI * 2 },
      velocity: {
        x: Math.cos(angle) * initialSpeed,
        y: Math.sin(angle) * initialSpeed
      },
      health: stats.health,
      maxHealth: stats.health,
      shield: stats.shield,
      maxShield: stats.shield,
      damage: stats.damage, // Aggiungi danno per combat
      lastBounce: 0, // Timestamp dell'ultimo rimbalzo ai confini
      behavior: NPC_CONFIG[validType].defaultBehavior || 'cruise',
      lastUpdate: Date.now(),
      lastSignificantMove: 0, // Non è stato ancora trasmesso, impostiamo a 0
      lastDamage: null, // Non danneggiato ancora
      lastAttackerId: null // Ultimo player che lo ha danneggiato
    };

    // Tutti gli NPC ora hanno comportamento normale (cruise)
    // Non ci sono più NPC aggressivi automatici

    // Validazione finale prima di aggiungere
    if (!Number.isFinite(npc.position.x) || !Number.isFinite(npc.position.y)) {
      logger.error('NPC', `NPC ${npcId} has invalid position after creation: (${npc.position.x}, ${npc.position.y})`);
      return null;
    }

    this.npcs.set(npcId, npc);

    // Log solo se non è modalità silenziosa (per evitare spam durante inizializzazione)
    if (!silent) {
      logger.info('NPC', `Created ${npcId} (${validType}) at (${finalX.toFixed(0)}, ${finalY.toFixed(0)}) [${npc.behavior}]`);
    }

    return npcId;
  }

  /**
   * Aggiorna lo stato di un NPC
   * @param {string} npcId - ID dell'NPC
   * @param {Object} updates - Aggiornamenti da applicare
   */
  updateNpc(npcId, updates) {
    const npc = this.npcs.get(npcId);
    if (!npc) {
      console.warn(`[SERVER] Attempted to update non-existent NPC: ${npcId}`);
      return;
    }

    // Controlla se ci sono movimenti significativi
    const hasSignificantMovement = updates.position &&
      (Math.abs(updates.position.x - npc.position.x) > 5 ||
       Math.abs(updates.position.y - npc.position.y) > 5);

    Object.assign(npc, updates);
    npc.lastUpdate = Date.now();

    if (hasSignificantMovement) {
      npc.lastSignificantMove = Date.now();
    }
  }

  /**
   * Inizializza NPC del mondo (chiamato all'avvio del server)
   * @param {number} scouterCount - Numero di Scouters
   * @param {number} frigateCount - Numero di Kronos
   */
  initializeWorldNpcs(scouterCount = 25, frigateCount = 25) {
    // Distribuisci uniformemente gli NPC nel mondo (modalità silenziosa per evitare spam)
    for (let i = 0; i < scouterCount; i++) {
      this.createNpc('Scouter', undefined, undefined, true);
    }

    for (let i = 0; i < frigateCount; i++) {
      this.createNpc('Kronos', undefined, undefined, true);
    }
  }
}

module.exports = NpcSpawner;
