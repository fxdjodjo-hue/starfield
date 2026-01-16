import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { Entity } from '../../../infrastructure/ecs/Entity';
import type { ClientNetworkSystem } from '../../../multiplayer/client/ClientNetworkSystem';
import { Explosion } from '../../../entities/combat/Explosion';
import { Transform } from '../../../entities/spatial/Transform';
import { Health } from '../../../entities/combat/Health';
import { Shield } from '../../../entities/combat/Shield';
import { Damage } from '../../../entities/combat/Damage';
import { DamageTaken } from '../../../entities/combat/DamageTaken';
import { SelectedNpc } from '../../../entities/combat/SelectedNpc';
import { Npc } from '../../../entities/ai/Npc';
import { Velocity } from '../../../entities/spatial/Velocity';
import { AtlasParser } from '../../../utils/AtlasParser';

/**
 * Manages explosion creation and dead entity removal
 */
export class CombatExplosionManager {
  private explosionFrames: HTMLImageElement[] | null = null;
  private explodingEntities: Set<number> = new Set();

  constructor(
    private readonly ecs: ECS,
    private readonly getClientNetworkSystem: () => ClientNetworkSystem | null,
    private readonly getPreloadedFrames: () => HTMLImageElement[] | null,
    private readonly setPreloadedFrames: (frames: HTMLImageElement[]) => void
  ) {}

  /**
   * Sets preloaded explosion frames
   */
  setPreloadedExplosionFrames(frames: HTMLImageElement[]): void {
    this.setPreloadedFrames(frames);
  }

  /**
   * Creates an explosion effect for a dead entity
   */
  async createExplosion(entity: Entity): Promise<void> {
    try {
      const npc = this.ecs.getComponent(entity, Npc);
      const entityType = npc ? `NPC-${npc.npcType}` : 'Player';

      if (!this.ecs.entityExists(entity.id)) {
        console.warn(`💥 [EXPLOSION] Cannot create explosion for ${entityType} entity ${entity.id}: entity no longer exists`);
        this.explodingEntities.delete(entity.id);
        return;
      }

      let frames = this.getPreloadedFrames();
      if (!frames) {
        frames = await this.loadExplosionFrames();
        if (frames) {
          this.setPreloadedFrames(frames);
        }
      }

      if (!this.ecs.entityExists(entity.id)) {
        console.warn(`Cannot create explosion for entity ${entity.id}: entity removed during async operation`);
        this.explodingEntities.delete(entity.id);
        return;
      }

      if (!frames || frames.length === 0) {
        console.warn(`Cannot create explosion: no frames loaded`);
        this.explodingEntities.delete(entity.id);
        return;
      }

      // Rimuovi componenti non necessari per l'esplosione
      this.ecs.removeComponent(entity, Health);
      this.ecs.removeComponent(entity, Shield);
      this.ecs.removeComponent(entity, Damage);
      this.ecs.removeComponent(entity, DamageTaken);
      this.ecs.removeComponent(entity, SelectedNpc);
      this.ecs.removeComponent(entity, Npc);
      this.ecs.removeComponent(entity, Velocity);

      // Aggiungi il componente esplosione
      const explosion = new Explosion(frames, 20, 1);
      this.ecs.addComponent(entity, Explosion, explosion);

      // Notifica il sistema di rete per sincronizzazione multiplayer
      const clientNetworkSystem = this.getClientNetworkSystem();
      if (clientNetworkSystem) {
        const transform = this.ecs.getComponent(entity, Transform);
        if (transform) {
          const hasNpc = this.ecs.hasComponent(entity, Npc);
          const entityType = hasNpc ? 'npc' : 'player';

          const explosionId = `expl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          clientNetworkSystem.sendExplosionCreated({
            explosionId,
            entityId: entity.id.toString(),
            entityType,
            position: { x: transform.x, y: transform.y },
            explosionType: 'entity_death'
          });
        }
      }

      setTimeout(() => {
        this.explodingEntities.delete(entity.id);
      }, 1000);

    } catch (error) {
      console.error('Error creating explosion:', error);
      this.explodingEntities.delete(entity.id);
      this.ecs.removeEntity(entity);
    }
  }

  /**
   * Loads all explosion animation frames
   */
  async loadExplosionFrames(explosionType?: string): Promise<HTMLImageElement[]> {
    try {
      const atlasPath = `/assets/explosions/explosions_npc/explosion.atlas`;
      const atlasData = await AtlasParser.parseAtlas(atlasPath);
      const frames = await AtlasParser.extractFrames(atlasData);
      return frames;
    } catch (error) {
      console.error('Failed to load explosion frames from atlas:', error);
      return [];
    }
  }

  /**
   * Removes dead entities (now empty, kept for compatibility)
   */
  removeDeadEntities(): void {
    // RIMOSSO: Check locale della morte
    // Le morti vengono ora gestite SOLO dal server attraverso messaggi entity_destroyed
  }

  /**
   * Checks if entity is currently exploding
   */
  isExploding(entityId: number): boolean {
    return this.explodingEntities.has(entityId);
  }

  /**
   * Marks entity as exploding
   */
  markAsExploding(entityId: number): void {
    this.explodingEntities.add(entityId);
  }

  /**
   * Clears explosion tracking (for cleanup)
   */
  clear(): void {
    this.explodingEntities.clear();
  }
}
