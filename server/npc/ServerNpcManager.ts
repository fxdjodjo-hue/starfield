/**
 * Server-side NPC Manager
 * Gestisce la creazione, aggiornamento e sincronizzazione di tutti gli NPC nel mondo
 * Tutti gli NPC sono controllati esclusivamente dal server per garantire consistenza
 */

export interface ServerNpcState {
  id: string;
  type: 'Scouter' | 'Frigate';
  position: { x: number; y: number; rotation: number };
  velocity: { x: number; y: number };
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  behavior: string;
  lastUpdate: number;
  lastSignificantMove: number; // Per ottimizzare gli aggiornamenti
}

export class ServerNpcManager {
  private npcs = new Map<string, ServerNpcState>();
  private npcIdCounter = 0;

  /**
   * Crea un nuovo NPC nel mondo
   */
  createNpc(type: 'Scouter' | 'Frigate', x?: number, y?: number): string {
    const npcId = `npc_${this.npcIdCounter++}`;

    // Se non specificate, genera posizioni casuali distribuite
    const finalX = x ?? (Math.random() - 0.5) * 20000;
    const finalY = y ?? (Math.random() - 0.5) * 12500;

    // Statistiche base per tipo
    const stats = type === 'Scouter'
      ? { health: 800, shield: 560, damage: 500, speed: 200 }
      : { health: 1200, shield: 840, damage: 750, speed: 150 };

    const npc: ServerNpcState = {
      id: npcId,
      type,
      position: { x: finalX, y: finalY, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: stats.health,
      maxHealth: stats.health,
      shield: stats.shield,
      maxShield: stats.shield,
      behavior: 'cruise',
      lastUpdate: Date.now(),
      lastSignificantMove: Date.now()
    };

    this.npcs.set(npcId, npc);
    console.log(`🆕 [SERVER] Created NPC ${npcId} (${type}) at (${finalX.toFixed(0)}, ${finalY.toFixed(0)})`);

    return npcId;
  }

  /**
   * Aggiorna lo stato di un NPC
   */
  updateNpc(npcId: string, updates: Partial<ServerNpcState>): void {
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
   * Rimuove un NPC dal mondo
   */
  removeNpc(npcId: string): boolean {
    const existed = this.npcs.delete(npcId);
    if (existed) {
      console.log(`💥 [SERVER] Removed NPC ${npcId}`);
    }
    return existed;
  }

  /**
   * Ottiene lo stato di un NPC specifico
   */
  getNpc(npcId: string): ServerNpcState | undefined {
    return this.npcs.get(npcId);
  }

  /**
   * Ottiene tutti gli NPC
   */
  getAllNpcs(): ServerNpcState[] {
    return Array.from(this.npcs.values());
  }

  /**
   * Ottiene NPC che si sono mossi significativamente dall'ultimo controllo
   */
  getNpcsNeedingUpdate(since: number): ServerNpcState[] {
    return Array.from(this.npcs.values())
      .filter(npc => npc.lastSignificantMove > since);
  }

  /**
   * Applica danno a un NPC
   */
  damageNpc(npcId: string, damage: number, attackerId?: string): boolean {
    const npc = this.npcs.get(npcId);
    if (!npc) return false;

    // Prima danneggia lo scudo
    if (npc.shield > 0) {
      const shieldDamage = Math.min(damage, npc.shield);
      npc.shield -= shieldDamage;
      damage -= shieldDamage;
    }

    // Poi danneggia la salute
    if (damage > 0) {
      npc.health = Math.max(0, npc.health - damage);
    }

    npc.lastUpdate = Date.now();

    console.log(`💥 [SERVER] NPC ${npcId} damaged: ${npc.health}/${npc.maxHealth} HP, ${npc.shield}/${npc.maxShield} shield`);

    // Se morto, rimuovi l'NPC
    if (npc.health <= 0) {
      this.removeNpc(npcId);
      return true; // NPC morto
    }

    return false; // NPC sopravvissuto
  }

  /**
   * Aggiorna il comportamento di un NPC
   */
  setNpcBehavior(npcId: string, behavior: string): void {
    const npc = this.npcs.get(npcId);
    if (npc) {
      npc.behavior = behavior;
      npc.lastUpdate = Date.now();
    }
  }

  /**
   * Statistiche del manager
   */
  getStats(): { totalNpcs: number; scouters: number; frigates: number } {
    const allNpcs = this.getAllNpcs();
    const scouters = allNpcs.filter(npc => npc.type === 'Scouter').length;
    const frigates = allNpcs.filter(npc => npc.type === 'Frigate').length;

    return {
      totalNpcs: allNpcs.length,
      scouters,
      frigates
    };
  }

  /**
   * Inizializza NPC del mondo (chiamato all'avvio del server)
   */
  initializeWorldNpcs(scouterCount: number = 25, frigateCount: number = 25): void {
    console.log(`🌍 [SERVER] Initializing world NPCs: ${scouterCount} Scouters, ${frigateCount} Frigates`);

    // Distribuisci uniformemente gli NPC nel mondo
    for (let i = 0; i < scouterCount; i++) {
      this.createNpc('Scouter');
    }

    for (let i = 0; i < frigateCount; i++) {
      this.createNpc('Frigate');
    }

    const stats = this.getStats();
    console.log(`✅ [SERVER] World initialization complete: ${stats.totalNpcs} NPCs (${stats.scouters} Scouters, ${stats.frigates} Frigates)`);
  }
}
