import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { Sprite } from '../../entities/Sprite';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { Npc } from '../../entities/ai/Npc';
import { Authority, AuthorityLevel } from '../../entities/spatial/Authority';
import { getNpcDefinition } from '../../config/NpcConfig';
import { EntityStateSystem } from '../../core/domain/EntityStateSystem';

/**
 * Sistema per la gestione degli NPC remoti in multiplayer
 * Gestisce creazione, aggiornamento e rimozione delle entità remote NPC
 * Tutti gli NPC hanno autorità SERVER_AUTHORITATIVE
 */
export class RemoteNpcSystem extends BaseSystem {
  // Mappa npcId -> entity data con tracking tempo per cleanup ghost entities
  private remoteNpcs: Map<string, { entityId: number, type: string, lastSeen: number }> = new Map();

  // Cache degli sprite NPC per tipo (più efficiente)
  private npcSprites: Map<string, Sprite> = new Map();
  private npcAnimatedSprites: Map<string, AnimatedSprite> = new Map();
  private assetManager: any = null; // AssetManager per caricare spritesheet

  // Tracking per logging ridotto
  private lastBulkUpdateLog = 0;
  private lastStatusLog = 0;

  constructor(ecs: ECS, npcSprites: Map<string, HTMLImageElement>, assetManager?: any) {
    super(ecs);
    this.assetManager = assetManager;
    this.initializeNpcSprites(npcSprites);
  }

  /**
   * Inizializza gli sprite NPC dal mapping fornito
   * Supporta sia Sprite normali che AnimatedSprite (spritesheet)
   */
  private initializeNpcSprites(sprites: Map<string, HTMLImageElement>): void {
    // Scouter sprite - usa scala dal config (single source of truth)
    const scouterDef = getNpcDefinition('Scouter');
    const scouterImage = sprites.get('scouter');
    if (scouterImage) {
      const scale = scouterDef?.spriteScale || 0.8;
      this.npcSprites.set('Scouter', new Sprite(scouterImage, scouterImage.width * scale, scouterImage.height * scale));
    }

    // Kronos sprite - usa scala dal config
    const kronosDef = getNpcDefinition('Kronos');
    const kronosImage = sprites.get('kronos');
    if (kronosImage) {
      const scale = kronosDef?.spriteScale || 0.16;
      this.npcSprites.set('Kronos', new Sprite(kronosImage, kronosImage.width * scale, kronosImage.height * scale));
    }

    // Guard sprite - usa scala dal config
    const guardDef = getNpcDefinition('Guard');
    const guardImage = sprites.get('guard');
    if (guardImage) {
      const scale = guardDef?.spriteScale || 0.8;
      this.npcSprites.set('Guard', new Sprite(guardImage, guardImage.width * scale, guardImage.height * scale));
    }

    // Pyramid sprite - usa scala dal config
    const pyramidDef = getNpcDefinition('Pyramid');
    const pyramidImage = sprites.get('pyramid');
    if (pyramidImage) {
      const scale = pyramidDef?.spriteScale || 1.5;
      this.npcSprites.set('Pyramid', new Sprite(pyramidImage, pyramidImage.width * scale, pyramidImage.height * scale));
    }
  }

  /**
   * Registra un AnimatedSprite per un tipo di NPC (spritesheet)
   * @param type Tipo NPC (es. 'Scouter', 'Kronos')
   * @param animatedSprite AnimatedSprite già caricato
   */
  registerNpcAnimatedSprite(type: string, animatedSprite: AnimatedSprite): void {
    this.npcAnimatedSprites.set(type, animatedSprite);
  }

  /**
   * Carica e registra uno spritesheet per un tipo di NPC
   * @param type Tipo NPC (es. 'Scouter', 'Kronos')
   * @param basePath Path base dello spritesheet (es. '/assets/npcs/scouter/scouter')
   * @param scale Scala dello sprite
   */
  async loadNpcSpritesheet(type: string, basePath: string, scale: number = 1): Promise<void> {
    if (!this.assetManager) {
      throw new Error('AssetManager not available. Pass it to constructor.');
    }
    const animatedSprite = await this.assetManager.createAnimatedSprite(basePath, scale);
    this.npcAnimatedSprites.set(type, animatedSprite);
  }

  /**
   * Aggiorna l'immagine di uno sprite NPC (se caricata dinamicamente)
   */
  updateNpcSprite(type: string, image: HTMLImageElement): void {
    // Usa scala dal config (single source of truth)
    const npcDef = getNpcDefinition(type);
    const scale = npcDef?.spriteScale || (type === 'Scouter' ? 0.8 : 0.16);
    this.npcSprites.set(type, new Sprite(image, image.width * scale, image.height * scale));
  }

  /**
   * Crea un nuovo NPC remoto
   */
  addRemoteNpc(npcId: string, type: 'Scouter' | 'Kronos' | 'Guard' | 'Pyramid', x: number, y: number, rotation: number = 0, health: { current: number, max: number }, shield: { current: number, max: number }, behavior: string = 'cruise', timestamp?: number): number {
    // Verifica se l'NPC esiste già
    if (this.remoteNpcs && this.remoteNpcs.has(npcId)) {
      // NPC già esistente - aggiorna invece di creare duplicato
      // Log per debug duplicati
      const existingNpcData = this.remoteNpcs.get(npcId)!;
      console.warn(`[RemoteNpcSystem] Duplicate NPC creation attempt for ${npcId} (${type}) - updating existing entity ${existingNpcData.entityId} instead`);

      // Preserve server rotation when a duplicate create arrives (common during re-sync bursts).
      this.updateRemoteNpc(npcId, { x, y, rotation }, health, shield, behavior, timestamp);

      // Aggiorna anche il lastSeen per prevenire rimozione ghost
      const data = this.remoteNpcs.get(npcId);
      if (data) data.lastSeen = Date.now();

      return existingNpcData.entityId;
    }

    // Normalizza il tipo: assicura che sia maiuscolo (Scouter, Kronos, Guard, Pyramid)
    const normalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    const validType = normalizedType === 'Scouter' || normalizedType === 'Kronos' || normalizedType === 'Guard' || normalizedType === 'Pyramid' ? normalizedType : type;

    // Ottieni lo sprite o animatedSprite per questo tipo di NPC
    const animatedSprite = this.npcAnimatedSprites.get(validType);
    const sprite = this.npcSprites.get(validType);

    if (!animatedSprite && !sprite) {
      console.error(`[RemoteNpcSystem] ❌ No sprite found for NPC type ${validType} (Normalized: ${normalizedType}, Org: ${type})`);
      console.log('Available sprites:', Array.from(this.npcSprites.keys()));
      return -1;
    }

    // Crea la nuova entity NPC
    const entity = this.ecs.createEntity();

    // Componenti spaziali con interpolazione
    // Usa scala dal config (single source of truth)
    const npcDef = getNpcDefinition(validType);
    const transformScale = npcDef?.transformScale || (npcDef?.spriteScale || 1);
    this.ecs.addComponent(entity, Transform, new Transform(x, y, rotation, transformScale, transformScale));
    this.ecs.addComponent(entity, InterpolationTarget, new InterpolationTarget(x, y, rotation));

    // Inizializza interpolazione con timestamp se presente
    const interpolation = this.ecs.getComponent(entity, InterpolationTarget);
    if (interpolation && timestamp) {
      interpolation.updateTarget(x, y, rotation, timestamp);
    }

    // Componenti visivi - priorità ad AnimatedSprite se disponibile
    if (animatedSprite) {
      this.ecs.addComponent(entity, AnimatedSprite, animatedSprite);
    } else if (sprite) {
      this.ecs.addComponent(entity, Sprite, sprite.clone()); // Clone per evitare condivisione
    }

    // Componenti di combattimento
    this.ecs.addComponent(entity, Health, new Health(health.current, health.max));
    this.ecs.addComponent(entity, Shield, new Shield(shield.current, shield.max));

    // Componenti NPC - usa il tipo normalizzato
    if (npcDef) {
      this.ecs.addComponent(entity, Damage, new Damage(npcDef.stats.damage, npcDef.stats.range, npcDef.stats.cooldown));
      this.ecs.addComponent(entity, Npc, new Npc(validType, behavior, npcId)); // Usa validType normalizzato
    }

    // Authority: NPC controllati SOLO dal server
    this.ecs.addComponent(entity, Authority, new Authority('server', AuthorityLevel.SERVER_AUTHORITATIVE));

    // Registra l'NPC con timestamp iniziale
    this.remoteNpcs.set(npcId, { entityId: entity.id, type, lastSeen: Date.now() });

    return entity.id;
  }

  /**
   * Aggiorna un NPC remoto esistente
   */
  updateRemoteNpc(npcId: string, position?: { x: number, y: number, rotation: number }, health?: { current: number, max: number }, shield?: { current: number, max: number }, behavior?: string, timestamp?: number): void {
    const npcData = this.remoteNpcs.get(npcId);
    if (!npcData) {
      // NPC distrutto/respawnato - silenziosamente ignora (normale durante il gameplay)
      return;
    }

    const entity = this.ecs.getEntity(npcData.entityId);
    if (!entity) {
      this.remoteNpcs.delete(npcId); // Cleanup
      return;
    }

    // Crea update object per EntityStateSystem
    const update: any = {};

    if (position) {
      update.position = {
        x: position.x,
        y: position.y,
        rotation: Number.isFinite(position.rotation) ? position.rotation : 0
      };
    }

    if (health) {
      update.health = {
        current: health.current,
        max: health.max
      };
    }

    if (shield) {
      update.shield = {
        current: shield.current,
        max: shield.max
      };
    }

    if (behavior) {
      update.behavior = { behavior };
    }

    // Usa EntityStateSystem per aggiornare lo stato
    EntityStateSystem.updateEntityState(this.ecs, entity, update, 'server', timestamp);
  }

  /**
   * Rimuove un NPC remoto
   */
  removeRemoteNpc(npcId: string): boolean {
    const npcData = this.remoteNpcs.get(npcId);
    if (!npcData) {
      return false;
    }

    const entity = this.ecs.getEntity(npcData.entityId);
    if (entity) {
      this.ecs.removeEntity(entity);
    }

    this.remoteNpcs.delete(npcId);
    return true;
  }

  /**
   * Gestisce aggiornamenti bulk di NPC (ottimizzato per performance)
   */
  bulkUpdateNpcs(updates: any[], timestamp?: number): void {
    if (!updates || updates.length === 0) return;

    for (const update of updates) {
      // FORMATO COMPATTO: [id, type, x, y, rotation, hp, maxHp, sh, maxSh, behavior_char]
      if (Array.isArray(update)) {
        const [id, type, x, y, rotation, hp, maxHp, sh, maxSh, behaviorChar] = update;

        let behavior = 'cruise';
        if (behaviorChar === 'a') behavior = 'aggressive';
        else if (behaviorChar === 'f') behavior = 'flee';
        else if (behaviorChar === 'p') behavior = 'patrol';
        else if (behaviorChar === 'g') behavior = 'guard';

        if (!this.remoteNpcs.has(id)) {
          // AUTO-SPAWN: Se l'NPC entra nel raggio e non lo abbiamo, crealo
          const npcType = type as 'Scouter' | 'Kronos' | 'Guard' | 'Pyramid';
          this.addRemoteNpc(id, npcType, x, y, rotation, { current: hp, max: maxHp }, { current: sh, max: maxSh }, behavior, timestamp);
        } else {
          // UPDATE: Se esiste già, aggiorna posizione e timestamp
          const data = this.remoteNpcs.get(id);
          if (data) data.lastSeen = Date.now();

          this.updateRemoteNpc(
            id,
            { x, y, rotation },
            { current: hp, max: maxHp },
            { current: sh, max: maxSh },
            behavior,
            timestamp
          );
        }
      } else {
        // Fallback per formato vecchio (oggetto)
        if (!this.remoteNpcs.has(update.id)) {
          // Vecchio formato non supporta auto-spawn facilmente (mancano dati)
          continue;
        }
        const data = this.remoteNpcs.get(update.id);
        if (data) data.lastSeen = Date.now();
        this.updateRemoteNpc(update.id, update.position, update.health, update.shield, update.behavior);
      }
    }
  }

  /**
   * Inizializza NPC dal messaggio initial_npcs
   */
  initializeNpcsFromServer(npcs: any[]): void {
    if (!npcs || npcs.length === 0) return;

    for (const npcData of npcs) {
      if (Array.isArray(npcData)) {
        // FORMATO COMPATTO: [id, type, x, y, rotation, hp, maxHp, sh, maxSh, behavior_char]
        const [id, type, x, y, rotation, hp, maxHp, sh, maxSh, behaviorChar] = npcData;

        let behavior = 'cruise';
        if (behaviorChar === 'a') behavior = 'aggressive';
        else if (behaviorChar === 'f') behavior = 'flee';
        else if (behaviorChar === 'p') behavior = 'patrol';
        else if (behaviorChar === 'g') behavior = 'guard';

        this.addRemoteNpc(
          id,
          type,
          x,
          y,
          rotation,
          { current: hp, max: maxHp },
          { current: sh, max: maxSh },
          behavior
        );
      } else {
        // Formato vecchio (fallback)
        this.addRemoteNpc(
          npcData.id,
          npcData.type,
          npcData.position.x,
          npcData.position.y,
          npcData.position.rotation,
          npcData.health,
          npcData.shield,
          npcData.behavior
        );
      }
    }
  }

  /**
   * Verifica se un NPC remoto esiste
   */
  hasRemoteNpc(npcId: string): boolean {
    return this.remoteNpcs.has(npcId);
  }

  /**
   * Ottiene l'entity ID di un NPC remoto
   */
  getRemoteNpcEntity(npcId: string): number | undefined {
    const npcData = this.remoteNpcs.get(npcId);
    return npcData?.entityId;
  }

  /**
   * Ottiene tutti gli NPC remoti attivi
   */
  getActiveRemoteNpcs(): string[] {
    return Array.from(this.remoteNpcs.keys());
  }

  /**
   * Ottiene statistiche sugli NPC remoti
   */
  getStats(): { totalNpcs: number, scouters: number, kronos: number } {
    const allNpcs = Array.from(this.remoteNpcs.values());
    const scouters = allNpcs.filter(npc => npc.type === 'Scouter').length;
    const kronos = allNpcs.filter(npc => npc.type === 'Kronos').length;

    return {
      totalNpcs: allNpcs.length,
      scouters,
      kronos
    };
  }

  /**
   * Rimuove tutti gli NPC remoti (per cleanup o riconnessione)
   */
  removeAllRemoteNpcs(): void {
    const npcIds = Array.from(this.remoteNpcs.keys());
    for (const npcId of npcIds) {
      this.removeRemoteNpc(npcId);
    }
  }

  /**
   * Update periodico - verifica consistenza e cleanup
   */
  update(deltaTime: number): void {
    const now = Date.now();

    // 1. Pulizia "Ghost Entities": rimuovi NPC fuori raggio d'interesse (niente updates per > 3sec)
    // Usiamo un raggio di tolleranza di 3 secondi per evitare rimozioni brusche causate da lag
    for (const [npcId, data] of this.remoteNpcs.entries()) {
      if (now - data.lastSeen > 3000) {
        this.removeRemoteNpc(npcId);
      }
    }

    // 2. Verifica periodica di consistenza (ogni 10 secondi)
    this.lastStatusLog += deltaTime;
    if (this.lastStatusLog > 10000) {
      this.checkConsistency();
      this.lastStatusLog = 0;
    }
  }

  /**
   * Verifica la consistenza tra entità ECS e registro remoto
   * Utile per identificare NPC "orfani" o duplicati
   */
  private checkConsistency(): void {
    const npcsInECS = this.ecs.getEntitiesWithComponents(Npc);
    const registeredNpcIds = new Set(this.remoteNpcs.keys());

    let orphanedCount = 0;
    let validCount = 0;

    for (const entity of npcsInECS) {
      const npcComponent = this.ecs.getComponent(entity, Npc);
      if (npcComponent && npcComponent.serverId) {
        if (registeredNpcIds.has(npcComponent.serverId)) {
          validCount++;
        } else {
          orphanedCount++;
          console.warn(`[RemoteNpcSystem] Orphaned NPC entity ${entity.id} with serverId ${npcComponent.serverId} - not in remote registry`);
          // Rimuovi entità orfana automaticamente
          this.ecs.removeEntity(entity);
        }
      }
    }

    // Log summary se ci sono problemi
    if (orphanedCount > 0) {
      console.warn(`[RemoteNpcSystem] Consistency check: ${validCount} valid NPCs, ${orphanedCount} orphaned NPCs removed, ${this.remoteNpcs.size} registered`);
    }
  }
}
