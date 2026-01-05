import { ECS } from '../../../infrastructure/ecs/ECS';
import { Transform } from '../../../entities/spatial/Transform';
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

    if (transform) {
      return {
        x: transform.x,
        y: transform.y,
        rotation: transform.rotation || 0
      };
    }

    // Fallback if transform is missing
    return { ...NETWORK_CONFIG.FALLBACK_POSITION };
  }

  /**
   * Finds the local player entity
   * Assumes local player is the only entity with Transform but without Npc component
   */
  private findLocalPlayer(): any {
    const entitiesWithTransform = this.ecs.getEntitiesWithComponents(Transform);

    // Find entities that have Transform but not Npc (local player)
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
