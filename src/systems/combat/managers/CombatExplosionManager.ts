import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { Entity } from '../../../infrastructure/ecs/Entity';
import type { ClientNetworkSystem } from '../../../multiplayer/client/ClientNetworkSystem';
import { Explosion } from '../../../entities/combat/Explosion';
import { Transform } from '../../../entities/spatial/Transform';
import { Npc } from '../../../entities/ai/Npc';
import { AtlasParser } from '../../../core/utils/AtlasParser';
import { LifeState, LifeStateType } from '../../../entities/combat/LifeState';
import { Active } from '../../../entities/tags/Active';

/**
 * Manages explosion creation and dead entity removal
 */
export class CombatExplosionManager {
  private explosionFrames: HTMLImageElement[] | null = null;
  private explodingEntities: Set<number> = new Set();
  private poolCursor: number = 0;

  constructor(
    private readonly ecs: ECS,
    private readonly getClientNetworkSystem: () => ClientNetworkSystem | null,
    private readonly getPreloadedFrames: () => HTMLImageElement[] | null,
    private readonly setPreloadedFrames: (frames: HTMLImageElement[]) => void
  ) { }

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

      // Mark entity as exploding but don't add structural component to it
      const lifeState = this.ecs.getComponent(entity, LifeState);
      if (lifeState) {
        lifeState.state = LifeStateType.EXPLODING;
      }

      const active = this.ecs.getComponent(entity, Active);
      if (active) {
        active.isEnabled = false;
      }

      // Create or reuse separate explosion entity
      const allExplosions = this.ecs.getEntitiesWithComponentsReadOnly(Active, Explosion);
      let explosionEntity: Entity | null = null;
      const len = allExplosions.length;

      // Find an inactive explosion entity to reuse using round-robin cursor (O(1) amortized)
      if (len > 0) {
        for (let i = 0; i < len; i++) {
          const idx = (this.poolCursor + i) % len;
          const e = allExplosions[idx];
          const active = this.ecs.getComponent(e, Active);
          if (active && !active.isEnabled) {
            explosionEntity = e;
            this.poolCursor = (idx + 1) % len;
            break;
          }
        }
      }

      if (explosionEntity) {
        // Reuse existing entity
        const transform = this.ecs.getComponent(entity, Transform);
        const explosionTransform = this.ecs.getComponent(explosionEntity, Transform);
        if (transform && explosionTransform) {
          explosionTransform.x = transform.x;
          explosionTransform.y = transform.y;
          explosionTransform.rotation = transform.rotation;
          explosionTransform.scaleX = transform.scaleX;
          explosionTransform.scaleY = transform.scaleY;
        }

        const explosion = this.ecs.getComponent(explosionEntity, Explosion);
        if (explosion) {
          explosion.frames = frames;
          explosion.reset();
        }

        const active = this.ecs.getComponent(explosionEntity, Active);
        if (active) {
          active.isEnabled = true;
        }
      } else {
        // Create new explosion entity
        explosionEntity = this.ecs.createEntity();
        const transform = this.ecs.getComponent(entity, Transform);
        if (transform) {
          this.ecs.addComponent(explosionEntity, Transform, new Transform(
            transform.x,
            transform.y,
            transform.rotation,
            transform.scaleX,
            transform.scaleY
          ));
        }

        const explosion = new Explosion(frames, 20, 1);
        this.ecs.addComponent(explosionEntity, Explosion, explosion);
        this.ecs.addComponent(explosionEntity, Active, new Active(true));
      }

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
      const atlasPath = `assets/explosions/explosion.atlas`;
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
