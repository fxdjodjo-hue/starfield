import { ECS } from '../../../infrastructure/ecs/ECS';
import { Transform } from '../../../entities/spatial/Transform';
import { Velocity } from '../../../entities/spatial/Velocity';
import { Npc } from '../../../entities/ai/Npc';
import { NETWORK_CONFIG } from '../../../config/NetworkConfig';

/**
 * Tracks and caches the local player position
 * Optimizes ECS queries by caching the player entity reference
 */
export class PlayerPositionTracker {
  private readonly ecs: ECS;
  private cachedPlayerEntity: any = null;
  private cacheTimestamp = 0;
  private lastFallbackLog = 0;

  constructor(ecs: ECS) {
    this.ecs = ecs;
  }

  /**
   * Gets the current local player position
   * Uses caching to avoid repeated ECS queries
   */
  getLocalPlayerPosition(): { x: number; y: number; rotation: number } {
    const now = Date.now();

    // Use cache if still valid
    if (this.cachedPlayerEntity && this.isCacheValid(now)) {
      return this.getPositionFromEntity(this.cachedPlayerEntity);
    }

    // Find and cache player entity
    const playerEntity = this.findLocalPlayer();
    if (playerEntity) {
      this.cachedPlayerEntity = playerEntity;
      this.cacheTimestamp = now;
      return this.getPositionFromEntity(playerEntity);
    }

    // Fallback position
    console.warn('[PlayerPositionTracker] Could not find local player position, using fallback');
    return { ...NETWORK_CONFIG.FALLBACK_POSITION };
  }

  /**
   * Checks if the cache is still valid
   */
  private isCacheValid(currentTime: number): boolean {
    return (currentTime - this.cacheTimestamp) < NETWORK_CONFIG.PLAYER_POSITION_CACHE_DURATION;
  }

  /**
   * Extracts position from a cached entity
   */
  private getPositionFromEntity(entity: any): { x: number; y: number; rotation: number } {
    const transform = this.ecs.getComponent(entity, Transform);

    if (transform && this.isValidTransform(transform)) {
      return {
        x: transform.x,
        y: transform.y,
        rotation: transform.rotation || 0
      };
    }

    // Fallback con logging ridotto per evitare spam
    if (Date.now() - this.lastFallbackLog > 10000) {
      console.warn('[PlayerPositionTracker] Using fallback position for invalid transform:', {
        hasTransform: !!transform,
        transform: transform,
        entityId: entity?.id
      });
      this.lastFallbackLog = Date.now();
    }
    return { ...NETWORK_CONFIG.FALLBACK_POSITION };
  }

  /**
   * Valida che il Transform component abbia valori validi
   */
  private isValidTransform(transform: any): boolean {
    return transform &&
           Number.isFinite(transform.x) &&
           Number.isFinite(transform.y) &&
           (transform.rotation === undefined || Number.isFinite(transform.rotation));
  }

  /**
   * Finds the local player entity
   * Assumes local player is the only entity with Transform but without Npc component
   */
  private findLocalPlayer(): any {
    const entitiesWithTransform = this.ecs.getEntitiesWithComponents(Transform);

    // Debug: log entità trovate con più dettagli
    if (Date.now() - this.lastFallbackLog > 5000) {
      entitiesWithTransform.forEach(entity => {
        const hasNpc = this.ecs.hasComponent(entity, Npc);
        const hasVelocity = this.ecs.hasComponent(entity, Velocity);
        const transform = this.ecs.getComponent(entity, Transform);
        const velocity = this.ecs.getComponent(entity, Velocity);
      });
      this.lastFallbackLog = Date.now();
    }

    // Find entities that have Transform but not Npc (local player)
    // Prioritize entities with Velocity (moving entities) as they are likely the player
    const movingEntities = entitiesWithTransform.filter(entity =>
      !this.ecs.hasComponent(entity, Npc) && this.ecs.hasComponent(entity, Velocity)
    );

    if (movingEntities.length > 0) {
      // Return the first moving entity (should be the player)
      return movingEntities[0];
    }

    // Fallback: find any entity without Npc component
    for (const entity of entitiesWithTransform) {
      if (!this.ecs.hasComponent(entity, Npc)) {
        return entity;
      }
    }

    return null;
  }

  /**
   * Invalidates the cache (useful for testing or when player entity changes)
   */
  invalidateCache(): void {
    this.cachedPlayerEntity = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Gets cache information for debugging
   */
  getCacheInfo(): { isValid: boolean; age: number; hasEntity: boolean } {
    const now = Date.now();
    return {
      isValid: this.isCacheValid(now),
      age: now - this.cacheTimestamp,
      hasEntity: this.cachedPlayerEntity !== null
    };
  }
}
