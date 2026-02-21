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
import { LifeState, LifeStateType } from '../../entities/combat/LifeState';
import { Active } from '../../entities/tags/Active';

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
  private readonly supportedNpcTypes: Set<string> = new Set(['Scouter', 'Kronos', 'Guard', 'Pyramid', 'ARX-DRONE']);

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

    // ARX-DRONE sprite - usa scala dal config
    const arxDroneDef = getNpcDefinition('ARX-DRONE');
    const arxDroneImage = sprites.get('arxdrone') || sprites.get('arx-drone');
    if (arxDroneImage) {
      const scale = arxDroneDef?.spriteScale || 1.1;
      this.npcSprites.set('ARX-DRONE', new Sprite(arxDroneImage, arxDroneImage.width * scale, arxDroneImage.height * scale));
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
  addRemoteNpc(npcId: string, type: 'Scouter' | 'Kronos' | 'Guard' | 'Pyramid' | 'ARX-DRONE', x: number, y: number, rotation: number = 0, health: { current: number, max: number }, shield: { current: number, max: number }, behavior: string = 'cruise', timestamp?: number): number {
    // Verifica se l'NPC esiste già
    if (this.remoteNpcs && this.remoteNpcs.has(npcId)) {
      const existingNpcData = this.remoteNpcs.get(npcId)!;
      this.updateRemoteNpc(npcId, { x, y, rotation }, health, shield, behavior, timestamp);
      const data = this.remoteNpcs.get(npcId);
      if (data) data.lastSeen = Date.now();
      return existingNpcData.entityId;
    }

    // Normalizza il tipo
    const normalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    const validType = this.supportedNpcTypes.has(type) ? type : (this.supportedNpcTypes.has(normalizedType) ? normalizedType : type);

    // Ottieni lo sprite
    const animatedSprite = this.npcAnimatedSprites.get(validType);
    const sprite = this.npcSprites.get(validType);

    if (!animatedSprite && !sprite) {
      console.error(`[RemoteNpcSystem] ❌ No sprite found for NPC type ${validType}`);
      return -1;
    }

    // Crea la nuova entity NPC
    const entity = this.ecs.createEntity();

    // Componenti spaziali con interpolazione
    const npcDef = getNpcDefinition(validType);
    const transformScale = npcDef?.transformScale || (npcDef?.spriteScale || 1);
    this.ecs.addComponent(entity, Transform, new Transform(x, y, rotation, transformScale, transformScale));

    // InterpolationTarget: Always present but enabled only for external updates
    const interpolation = new InterpolationTarget(x, y, rotation);
    interpolation.enabled = true;
    this.ecs.addComponent(entity, InterpolationTarget, interpolation);

    // LifeState e Active per stabilità performance
    this.ecs.addComponent(entity, LifeState, new LifeState(LifeStateType.ALIVE));
    this.ecs.addComponent(entity, Active, new Active(true));

    if (timestamp) {
      interpolation.updateTarget(x, y, rotation, timestamp);
    }

    // Componenti visivi
    if (animatedSprite) {
      this.ecs.addComponent(entity, AnimatedSprite, animatedSprite);
    } else if (sprite) {
      this.ecs.addComponent(entity, Sprite, sprite.clone());
    }

    // Componenti di combattimento
    this.ecs.addComponent(entity, Health, new Health(health.current, health.max));
    this.ecs.addComponent(entity, Shield, new Shield(shield.current, shield.max));

    if (npcDef) {
      this.ecs.addComponent(entity, Damage, new Damage(npcDef.stats.damage, npcDef.stats.range, npcDef.stats.cooldown));
      this.ecs.addComponent(entity, Npc, new Npc(validType, behavior, npcId));
    }

    // Authority
    this.ecs.addComponent(entity, Authority, new Authority('server', AuthorityLevel.SERVER_AUTHORITATIVE));

    // Registra l'NPC
    this.remoteNpcs.set(npcId, { entityId: entity.id, type: validType, lastSeen: Date.now() });

    return entity.id;
  }

  /**
   * Aggiorna un NPC remoto esistente
   */
  updateRemoteNpc(npcId: string, position?: { x: number, y: number, rotation: number }, health?: { current: number, max: number }, shield?: { current: number, max: number }, behavior?: string, timestamp?: number): void {
    const npcData = this.remoteNpcs.get(npcId);
    if (!npcData) return;

    const entity = this.ecs.getEntity(npcData.entityId);
    if (!entity) {
      this.remoteNpcs.delete(npcId);
      return;
    }

    const update: any = {};
    if (position) {
      update.position = { x: position.x, y: position.y, rotation: position.rotation || 0 };
    }
    if (health) {
      update.health = { current: health.current, max: health.max };
    }
    if (shield) {
      update.shield = { current: shield.current, max: shield.max };
    }
    if (behavior) {
      update.behavior = behavior;
    }

    EntityStateSystem.updateEntityState(this.ecs, entity, update, 'server', timestamp);
  }

  /**
   * Rimuove un NPC remoto
   */
  removeRemoteNpc(npcId: string): boolean {
    const npcData = this.remoteNpcs.get(npcId);
    if (!npcData) return false;

    const entity = this.ecs.getEntity(npcData.entityId);
    if (entity) {
      this.ecs.removeEntity(entity);
    }

    this.remoteNpcs.delete(npcId);
    return true;
  }

  /**
   * Gestisce aggiornamenti bulk di NPC
   */
  bulkUpdateNpcs(updates: any[], timestamp?: number): void {
    if (!updates || updates.length === 0) return;

    for (const update of updates) {
      if (Array.isArray(update)) {
        const [id, type, x, y, rotation, hp, maxHp, sh, maxSh, behaviorChar] = update;

        let behavior = 'cruise';
        if (behaviorChar === 'a') behavior = 'attack';
        else if (behaviorChar === 'f') behavior = 'flee';
        else if (behaviorChar === 'p') behavior = 'patrol';
        else if (behaviorChar === 'g') behavior = 'guard';

        if (!this.remoteNpcs.has(id)) {
          const npcType = type as 'Scouter' | 'Kronos' | 'Guard' | 'Pyramid' | 'ARX-DRONE';
          this.addRemoteNpc(id, npcType, x, y, rotation, { current: hp, max: maxHp }, { current: sh, max: maxSh }, behavior, timestamp);
        } else {
          const data = this.remoteNpcs.get(id);
          if (data) data.lastSeen = Date.now();
          this.updateRemoteNpc(id, { x, y, rotation }, { current: hp, max: maxHp }, { current: sh, max: maxSh }, behavior, timestamp);
        }
      } else {
        if (!this.remoteNpcs.has(update.id)) continue;
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
        const [id, type, x, y, rotation, hp, maxHp, sh, maxSh, behaviorChar] = npcData;
        let behavior = 'cruise';
        if (behaviorChar === 'a') behavior = 'attack';
        else if (behaviorChar === 'f') behavior = 'flee';
        else if (behaviorChar === 'p') behavior = 'patrol';
        else if (behaviorChar === 'g') behavior = 'guard';

        this.addRemoteNpc(id, type, x, y, rotation, { current: hp, max: maxHp }, { current: sh, max: maxSh }, behavior);
      } else {
        this.addRemoteNpc(npcData.id, npcData.type, npcData.position.x, npcData.position.y, npcData.position.rotation, npcData.health, npcData.shield, npcData.behavior);
      }
    }
  }

  hasRemoteNpc(npcId: string): boolean {
    return this.remoteNpcs.has(npcId);
  }

  getRemoteNpcEntity(npcId: string): number | undefined {
    return this.remoteNpcs.get(npcId)?.entityId;
  }

  getActiveRemoteNpcs(): string[] {
    return Array.from(this.remoteNpcs.keys());
  }

  getStats(): { totalNpcs: number, scouters: number, kronos: number } {
    const allNpcs = Array.from(this.remoteNpcs.values());
    const scouters = allNpcs.filter(npc => npc.type === 'Scouter').length;
    const kronos = allNpcs.filter(npc => npc.type === 'Kronos').length;

    return { totalNpcs: allNpcs.length, scouters, kronos };
  }

  removeAllRemoteNpcs(): void {
    for (const npcId of Array.from(this.remoteNpcs.keys())) {
      this.removeRemoteNpc(npcId);
    }
  }

  update(deltaTime: number): void {
    const now = Date.now();
    for (const [npcId, data] of this.remoteNpcs.entries()) {
      if (now - data.lastSeen > 3000) {
        this.removeRemoteNpc(npcId);
      }
    }

    this.lastStatusLog += deltaTime;
    if (this.lastStatusLog > 10000) {
      this.checkConsistency();
      this.lastStatusLog = 0;
    }
  }

  private checkConsistency(): void {
    const npcsInECS = this.ecs.getEntitiesWithComponentsReadOnly(Npc);
    const registeredNpcIds = new Set(this.remoteNpcs.keys());

    for (const entity of npcsInECS) {
      const npcComponent = this.ecs.getComponent(entity, Npc);
      if (npcComponent && npcComponent.serverId) {
        if (!registeredNpcIds.has(npcComponent.serverId)) {
          this.ecs.removeEntity(entity);
        }
      }
    }
  }
}
