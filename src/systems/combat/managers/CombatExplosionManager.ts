import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { Entity } from '../../../infrastructure/ecs/Entity';
import type { ClientNetworkSystem } from '../../../multiplayer/client/ClientNetworkSystem';
import { Explosion } from '../../../entities/combat/Explosion';
import { Transform } from '../../../entities/spatial/Transform';
import { Npc } from '../../../entities/ai/Npc';
import { Sprite } from '../../../entities/Sprite';
import { AnimatedSprite } from '../../../entities/AnimatedSprite';
import { AtlasParser } from '../../../core/utils/AtlasParser';
import { LifeState, LifeStateType } from '../../../entities/combat/LifeState';
import { Active } from '../../../entities/tags/Active';

/**
 * Manages explosion creation and dead entity removal
 */
export class CombatExplosionManager {
  private explosionFrames: HTMLImageElement[] | null = null;
  private shieldHitFrames: HTMLImageElement[] | null = null;
  private lastShieldHitTimes: Map<number, number> = new Map();
  private explodingEntities: Set<number> = new Set();
  private poolCursor: number = 0;

  private readonly SHIELD_HIT_COOLDOWN = 90;
  private readonly SHIELD_HIT_ATLAS_PATH = 'assets/shieldhit/shieldhit.atlas';
  private readonly SHIELD_HIT_SCALE = 1.9;
  private readonly SHIELD_HIT_FRAME_DURATION = 28;
  private readonly SHIELD_HIT_ROTATION_OFFSET = Math.PI;
  private readonly SHIELD_HIT_RING_RATIO = 0.42;
  private readonly SHIELD_HIT_MIN_RADIUS = 34;
  private readonly SHIELD_HIT_MAX_RADIUS = 220;

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
   * Triggers a shield hit visual effect
   */
  public async triggerShieldHitEffect(
    targetEntity: Entity,
    impactPosition?: { x: number; y: number },
    attackerPosition?: { x: number; y: number }
  ): Promise<void> {
    // ONLY for player entities (as requested: "non dovrebbe esserci su npc")
    if (this.ecs.hasComponent(targetEntity, Npc)) {
      return;
    }

    const now = Date.now();
    const lastHitTime = this.lastShieldHitTimes.get(targetEntity.id) || 0;
    if (now - lastHitTime < this.SHIELD_HIT_COOLDOWN) return;
    this.lastShieldHitTimes.set(targetEntity.id, now);

    try {
      if (!this.shieldHitFrames) {
        this.shieldHitFrames = await this.loadShieldHitFrames();
      }

      if (!this.shieldHitFrames || this.shieldHitFrames.length === 0) {
        console.warn('[EXPLOSION_MANAGER] No shield hit frames available, skipping effect');
        return;
      }

      const targetTransform = this.ecs.getComponent(targetEntity, Transform);
      if (!targetTransform) return;

      const centerX = Number(targetTransform.x);
      const centerY = Number(targetTransform.y);
      const radius = this.computeTargetShieldRingRadius(targetEntity);

      const direction = this.resolveShieldHitDirection(centerX, centerY, impactPosition, attackerPosition, targetEntity.id);

      const effectX = centerX + direction.x * radius;
      const effectY = centerY + direction.y * radius;
      const rotation = Math.atan2(direction.y, direction.x);

      this.spawnShieldHitEntity(effectX, effectY, rotation, this.shieldHitFrames);
    } catch (error) {
      console.warn('[EXPLOSION_MANAGER] Failed to trigger shield hit effect:', error);
    }
  }

  private computeTargetShieldRingRadius(targetEntity: Entity): number {
    const animatedSprite = this.ecs.getComponent(targetEntity, AnimatedSprite);
    const sprite = this.ecs.getComponent(targetEntity, Sprite);
    const transform = this.ecs.getComponent(targetEntity, Transform);

    const baseWidth = animatedSprite
      ? Number(animatedSprite.width)
      : (sprite ? Number(sprite.width) : 0);
    const baseHeight = animatedSprite
      ? Number(animatedSprite.height)
      : (sprite ? Number(sprite.height) : 0);

    const maxBaseSize = Math.max(0, baseWidth, baseHeight);
    const averageTransformScale = transform
      ? (Math.abs(Number(transform.scaleX || 1)) + Math.abs(Number(transform.scaleY || 1))) * 0.5
      : 1;

    const rawRadius = maxBaseSize > 0
      ? maxBaseSize * Math.max(0.25, this.SHIELD_HIT_RING_RATIO) * Math.max(0.5, averageTransformScale)
      : 58;

    return Math.max(this.SHIELD_HIT_MIN_RADIUS, Math.min(this.SHIELD_HIT_MAX_RADIUS, rawRadius));
  }

  private resolveShieldHitDirection(
    centerX: number,
    centerY: number,
    impactPosition: { x: number; y: number } | undefined,
    attackerPosition: { x: number; y: number } | null | undefined,
    targetId: number
  ): { x: number; y: number } {
    if (attackerPosition) {
      const dx = Number(attackerPosition.x) - centerX;
      const dy = Number(attackerPosition.y) - centerY;
      const length = Math.hypot(dx, dy);
      if (length > 4) {
        return { x: dx / length, y: dy / length };
      }
    }

    if (impactPosition) {
      const dx = Number(impactPosition.x) - centerX;
      const dy = Number(impactPosition.y) - centerY;
      const length = Math.hypot(dx, dy);
      if (length > 4) {
        return { x: dx / length, y: dy / length };
      }
    }

    // Fallback deterministic direction (consistent for the same entity in a short window)
    const timeSeed = Math.floor(Date.now() / this.SHIELD_HIT_COOLDOWN);
    const angle = ((targetId * 1337) ^ (timeSeed * 7331)) % 360;
    const rad = (angle * Math.PI) / 180;

    return { x: Math.cos(rad), y: Math.sin(rad) };
  }

  private async loadShieldHitFrames(): Promise<HTMLImageElement[]> {
    try {
      const atlasData = await AtlasParser.parseAtlas(this.SHIELD_HIT_ATLAS_PATH);
      if (!atlasData) return [];

      const frames = await AtlasParser.extractFrames(atlasData);
      if (frames.length === 0) {
        console.warn('[CombatExplosionManager] No frames extracted from shield hit atlas');
      }
      return frames;
    } catch (error) {
      console.error('[CombatExplosionManager] Failed to load shield hit frames:', error);
      return [];
    }
  }

  private spawnShieldHitEntity(x: number, y: number, rotation: number, frames: HTMLImageElement[]): void {
    const effectEntity = this.ecs.createEntity();
    this.ecs.addComponent(effectEntity, Transform, new Transform(x, y, rotation, 1, 1));
    this.ecs.addComponent(effectEntity, Explosion, new Explosion(
      frames,
      this.SHIELD_HIT_FRAME_DURATION,
      1,
      this.SHIELD_HIT_SCALE,
      true, // isShieldHit
      this.SHIELD_HIT_ROTATION_OFFSET
    ));
    this.ecs.addComponent(effectEntity, Active, new Active(true));
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
