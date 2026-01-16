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

/**
 * Sistema per la gestione degli NPC remoti in multiplayer
 * Gestisce creazione, aggiornamento e rimozione delle entità remote NPC
 * Tutti gli NPC hanno autorità SERVER_AUTHORITATIVE
 */
export class RemoteNpcSystem extends BaseSystem {
  // Mappa npcId -> entity data
  private remoteNpcs: Map<string, {entityId: number, type: string}> = new Map();

  // Cache degli sprite NPC per tipo (più efficiente)
  private npcSprites: Map<string, Sprite> = new Map();
  private npcAnimatedSprites: Map<string, AnimatedSprite> = new Map();
  private assetManager: any = null; // AssetManager per caricare spritesheet

  // Tracking per logging ridotto
  private lastBulkUpdateLog = 0;

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
  addRemoteNpc(npcId: string, type: 'Scouter' | 'Kronos', x: number, y: number, rotation: number = 0, health: { current: number, max: number }, shield: { current: number, max: number }, behavior: string = 'cruise'): number {
    // Verifica se l'NPC esiste già
    if (this.remoteNpcs.has(npcId)) {
      this.updateRemoteNpc(npcId, { x, y, rotation: 0 }, health, behavior);
      return this.remoteNpcs.get(npcId)!.entityId;
    }

    // Normalizza il tipo: assicura che sia maiuscolo (Scouter, Kronos)
    const normalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    const validType = normalizedType === 'Scouter' || normalizedType === 'Kronos' ? normalizedType : type;

    // Ottieni lo sprite o animatedSprite per questo tipo di NPC
    const animatedSprite = this.npcAnimatedSprites.get(validType);
    const sprite = this.npcSprites.get(validType);
    
    if (!animatedSprite && !sprite) {
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

    // Registra l'NPC
    this.remoteNpcs.set(npcId, { entityId: entity.id, type });


    return entity.id;
  }

  /**
   * Aggiorna un NPC remoto esistente
   */
  updateRemoteNpc(npcId: string, position?: { x: number, y: number, rotation: number }, health?: { current: number, max: number }, shield?: { current: number, max: number }, behavior?: string): void {
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

    // Aggiorna posizione con interpolazione
    if (position) {
      const interpolation = this.ecs.getComponent(entity, InterpolationTarget);
      if (interpolation) {
        interpolation.updateTarget(position.x, position.y, position.rotation || 0);
      }
    }

    // Aggiorna salute
    if (health) {
      const healthComponent = this.ecs.getComponent(entity, Health);
      if (healthComponent) {
        healthComponent.current = health.current;
        healthComponent.max = health.max;
      }
    }

    // Aggiorna shield
    if (shield) {
      const shieldComponent = this.ecs.getComponent(entity, Shield);
      if (shieldComponent) {
        shieldComponent.current = shield.current;
        shieldComponent.max = shield.max;
      }
    }

    // Aggiorna comportamento
    if (behavior) {
      const npcComponent = this.ecs.getComponent(entity, Npc);
      if (npcComponent) {
        npcComponent.behavior = behavior;
      }
    }
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
  bulkUpdateNpcs(updates: Array<{ id: string, position: { x: number, y: number, rotation: number }, health: { current: number, max: number }, shield: { current: number, max: number }, behavior: string }>): void {
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    for (const update of updates) {
      const existed = this.remoteNpcs.has(update.id);
      this.updateRemoteNpc(update.id, update.position, update.health, update.shield, update.behavior);
      if (existed) {
        successCount++;
      } else {
        failCount++;
      }
    }

    // Log summary of bulk update
    const duration = Date.now() - startTime;
  }

  /**
   * Inizializza NPC dal messaggio initial_npcs
   */
  initializeNpcsFromServer(npcs: Array<{ id: string, type: 'Scouter' | 'Kronos', position: { x: number, y: number, rotation: number }, health: { current: number, max: number }, shield: { current: number, max: number }, behavior: string }>): void {
    for (const npcData of npcs) {
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
   * Update periodico (principalmente per logging)
   */
  update(deltaTime: number): void {
    // No periodic logging needed
  }

  private lastStatusLog = 0;
}
