import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { Sprite } from '../../entities/Sprite';
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

  // Tracking per logging ridotto
  private lastBulkUpdateLog = 0;

  constructor(ecs: ECS, npcSprites: Map<string, HTMLImageElement>) {
    super(ecs);
    this.initializeNpcSprites(npcSprites);
  }

  /**
   * Inizializza gli sprite NPC dal mapping fornito
   */
  private initializeNpcSprites(sprites: Map<string, HTMLImageElement>): void {
    // Scouter sprite
    const scouterImage = sprites.get('scouter');
    if (scouterImage) {
      this.npcSprites.set('Scouter', new Sprite(scouterImage, scouterImage.width * 0.15, scouterImage.height * 0.15));
    }

    // Frigate sprite
    const frigateImage = sprites.get('frigate');
    if (frigateImage) {
      this.npcSprites.set('Frigate', new Sprite(frigateImage, frigateImage.width * 0.16, frigateImage.height * 0.16));
    }

  }

  /**
   * Aggiorna l'immagine di uno sprite NPC (se caricata dinamicamente)
   */
  updateNpcSprite(type: string, image: HTMLImageElement): void {
    const scale = type === 'Scouter' ? 0.15 : 0.16;
    this.npcSprites.set(type, new Sprite(image, image.width * scale, image.height * scale));
  }

  /**
   * Crea un nuovo NPC remoto
   */
  addRemoteNpc(npcId: string, type: 'Scouter' | 'Frigate', x: number, y: number, rotation: number = 0, health: { current: number, max: number }, shield: { current: number, max: number }, behavior: string = 'cruise'): number {
    // Verifica se l'NPC esiste già
    if (this.remoteNpcs.has(npcId)) {
      console.warn(`[REMOTE_NPC] NPC ${npcId} already exists, updating instead`);
      this.updateRemoteNpc(npcId, { x, y, rotation: 0 }, health, behavior);
      return this.remoteNpcs.get(npcId)!.entityId;
    }

    // Ottieni lo sprite per questo tipo di NPC
    const sprite = this.npcSprites.get(type);
    if (!sprite) {
      console.error(`[REMOTE_NPC] No sprite available for NPC type: ${type}`);
      return -1;
    }

    // Crea la nuova entity NPC
    const entity = this.ecs.createEntity();

    // Componenti spaziali con interpolazione
    this.ecs.addComponent(entity, Transform, new Transform(x, y, rotation));
    this.ecs.addComponent(entity, InterpolationTarget, new InterpolationTarget(x, y, rotation));

    // Componenti visivi
    this.ecs.addComponent(entity, Sprite, sprite.clone()); // Clone per evitare condivisione

    // Componenti di combattimento
    this.ecs.addComponent(entity, Health, new Health(health.current, health.max));
    this.ecs.addComponent(entity, Shield, new Shield(shield.current, shield.max));

    // Componenti NPC
    const npcDef = getNpcDefinition(type);
    if (npcDef) {
      this.ecs.addComponent(entity, Damage, new Damage(npcDef.stats.damage, npcDef.stats.range, npcDef.stats.cooldown));
      this.ecs.addComponent(entity, Npc, new Npc(type, behavior, npcId)); // npcId è l'ID server
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
  updateRemoteNpc(npcId: string, position?: { x: number, y: number, rotation: number }, health?: { current: number, max: number }, behavior?: string): void {
    const npcData = this.remoteNpcs.get(npcId);
    if (!npcData) {
      // NPC distrutto/respawnato - silenziosamente ignora (normale durante il gameplay)
      return;
    }

    const entity = this.ecs.getEntity(npcData.entityId);
    if (!entity) {
      console.error(`[REMOTE_NPC] Entity ${npcData.entityId} not found for NPC ${npcId}`);
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
      console.warn(`[REMOTE_NPC] Attempted to remove non-existent NPC: ${npcId}`);
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
  bulkUpdateNpcs(updates: Array<{ id: string, position: { x: number, y: number, rotation: number }, health: { current: number, max: number }, behavior: string }>): void {
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    for (const update of updates) {
      const existed = this.remoteNpcs.has(update.id);
      this.updateRemoteNpc(update.id, update.position, update.health, update.behavior);
      if (existed) {
        successCount++;
      } else {
        failCount++;
      }
    }

    // Log summary of bulk update
    const duration = Date.now() - startTime;
    console.log(`[REMOTE_NPC] Bulk update: ${updates.length} total, ${successCount} updated, ${failCount} skipped (${duration}ms)`);
  }

  /**
   * Inizializza NPC dal messaggio initial_npcs
   */
  initializeNpcsFromServer(npcs: Array<{ id: string, type: 'Scouter' | 'Frigate', position: { x: number, y: number, rotation: number }, health: { current: number, max: number }, shield: { current: number, max: number }, behavior: string }>): void {
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
  getStats(): { totalNpcs: number, scouters: number, frigates: number } {
    const allNpcs = Array.from(this.remoteNpcs.values());
    const scouters = allNpcs.filter(npc => npc.type === 'Scouter').length;
    const frigates = allNpcs.filter(npc => npc.type === 'Frigate').length;

    return {
      totalNpcs: allNpcs.length,
      scouters,
      frigates
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
