import { ECS } from '../../infrastructure/ecs/ECS';
import { AssetManager } from '../../infrastructure/AssetManager';
import { Projectile } from '../../entities/combat/Projectile';
import { PlayerSystem } from '../../systems/player/PlayerSystem';

/**
 * Rendering parameters for projectiles
 */
export interface ProjectileRenderParams {
  color: string;
  length: number;
  shadowColor?: string;
  shadowBlur?: number;
  lineWidth: number;
  hasImage: boolean;
  imageSize?: number;
  image?: HTMLImageElement;
}

/**
 * Helper class for projectile rendering logic
 */
export class ProjectileRenderer {
  private ecs: ECS;
  private playerSystem: PlayerSystem;
  private assetManager: AssetManager;

  constructor(ecs: ECS, playerSystem: PlayerSystem, assetManager: AssetManager) {
    this.ecs = ecs;
    this.playerSystem = playerSystem;
    this.assetManager = assetManager;
  }

  /**
   * Get rendering parameters for a projectile
   */
  getRenderParams(projectile: Projectile): ProjectileRenderParams {
    const playerEntity = this.playerSystem.getPlayerEntity();
    const isNpcProjectile = playerEntity && projectile.ownerId !== playerEntity.id;

    if (isNpcProjectile) {
      // NPC projectile - try to use image first, fallback to green laser
      const projectileImage = this.getProjectileImageForOwner(projectile.ownerId);

      if (projectileImage && projectileImage.complete && projectileImage.width > 0) {
        // Image-based projectile
        const ownerEntity = this.ecs.getEntity(projectile.ownerId);
        const npc = ownerEntity ? this.ecs.getComponent(ownerEntity, 'Npc' as any) : null;
        const imageSize = (npc && (npc as any).npcType === 'Frigate') ? 28 : 36;

        return {
          color: '#00ff00', // Green (fallback)
          length: 12,
          lineWidth: 2.5,
          hasImage: true,
          imageSize,
          image: projectileImage
        };
      } else {
        // Laser-based projectile
        return {
          color: '#00ff00', // Green
          length: 12,
          lineWidth: 2.5,
          hasImage: false
        };
      }
    } else {
      // Player projectile - red laser with glow
      return {
        color: '#ff0000', // Red
        length: 15,
        shadowColor: '#ff0000',
        shadowBlur: 8,
        lineWidth: 3,
        hasImage: false
      };
    }
  }

  /**
   * Get projectile image for NPC owner
   */
  private getProjectileImageForOwner(ownerId: number): HTMLImageElement | null {
    const ownerEntity = this.ecs.getEntity(ownerId);
    if (!ownerEntity) return this.assetManager.getOrLoadImage('assets/npc_ships/scouter/npc_scouter_projectile.png');

    const npc = this.ecs.getComponent(ownerEntity, 'Npc' as any);
    if (npc && (npc as any).npcType === 'Frigate') {
      return this.assetManager.getOrLoadImage('assets/npc_ships/frigate/npc_frigate_projectile.png');
    }

    return this.assetManager.getOrLoadImage('assets/npc_ships/scouter/npc_scouter_projectile.png');
  }
}
