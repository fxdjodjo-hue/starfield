import { ECS } from '../../infrastructure/ecs/ECS';
import { AssetManager } from '../../infrastructure/AssetManager';
import { Projectile } from '../../entities/combat/Projectile';
import { PlayerSystem } from '../../systems/player/PlayerSystem';
import { Npc } from '../../entities/ai/Npc';

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
    // Check if it's a missile first
    if (projectile.projectileType === 'missile') {
      return this.getMissileRenderParams(projectile);
    }

    const playerEntity = this.playerSystem.getPlayerEntity();
    const isNpcProjectile = this.isNpcProjectile(projectile, playerEntity);

    if (isNpcProjectile) {
      // NPC projectile - try to use image first, fallback to green laser
      const projectileImage = this.getProjectileImageForProjectile(projectile);

      if (projectileImage && projectileImage.complete && projectileImage.width > 0) {
        // Image-based projectile
        const imageSize = this.getProjectileImageSize(projectile);

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
      // Player projectile - try to use sprite first, fallback to red laser with glow
      const playerLaserImage = this.assetManager.getOrLoadImage('/assets/laser/laser1/laser1.png');
      
      if (playerLaserImage && playerLaserImage.complete && playerLaserImage.width > 0) {
        // Image-based projectile
        const imageSize = 48; // Dimensione sprite laser player
        
        return {
          color: '#ff0000', // Red (fallback)
          length: 15,
          lineWidth: 3,
          hasImage: true,
          imageSize,
          image: playerLaserImage
        };
      } else {
        // Laser-based projectile (fallback)
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
  }

  /**
   * Determina se un proiettile è di un NPC basandosi sul playerId
   */
  private isNpcProjectile(projectile: Projectile, playerEntity: any): boolean {
    if (!playerEntity) return true; // Se non c'è player locale, assume NPC

    // Se ha playerId e non inizia con 'client_', è un NPC
    if (projectile.playerId) {
      return !projectile.playerId.startsWith('client_');
    }

    // Fallback: controlla ownerId
    return projectile.ownerId !== playerEntity.id;
  }

  /**
   * Get projectile image based on projectile type
   */
  private getProjectileImageForProjectile(projectile: Projectile): HTMLImageElement | null {
    // Determina il tipo di NPC dal playerId
    if (projectile.playerId && projectile.playerId.startsWith('npc_')) {
      // È un proiettile NPC
      const npcType = this.getNpcTypeFromPlayerId(projectile.playerId);
      if (npcType === 'Kronos') {
        return this.assetManager.getOrLoadImage('/assets/npc_ships/kronos/npc_frigate_projectile.png');
      } else {
        return this.assetManager.getOrLoadImage('/assets/npc_ships/scouter/npc_scouter_projectile.png');
      }
    }

    // Default: scouter projectile
    return this.assetManager.getOrLoadImage('/assets/npc_ships/scouter/npc_scouter_projectile.png');
  }

  /**
   * Get NPC type from playerId (e.g., "npc_123" -> cerca l'NPC con id 123)
   */
  private getNpcTypeFromPlayerId(playerId: string): string | null {
    if (!playerId.startsWith('npc_')) return null;

    // Sul client, l'ID entity dell'NPC NON coincide con la parte numerica di "npc_X".
    // Il mapping corretto è tramite Npc.serverId, che contiene esattamente "npc_X".
    const npcEntities = this.ecs.getEntitiesWithComponents(Npc);

    for (const entity of npcEntities) {
      const npc = this.ecs.getComponent(entity, Npc);
      if (npc && npc.serverId === playerId) {
        return npc.npcType;
      }
    }

    return null;
  }

  /**
   * Get projectile image size based on projectile type
   */
  private getProjectileImageSize(projectile: Projectile): number {
    if (projectile.playerId && projectile.playerId.startsWith('npc_')) {
      const npcType = this.getNpcTypeFromPlayerId(projectile.playerId);
      // Kronos: proiettile più grande, Scouter: default
      return (npcType === 'Kronos') ? 48 : 36;
    }
    return 36; // Default size
  }

  /**
   * Get rendering parameters for a missile
   */
  private getMissileRenderParams(projectile: Projectile): ProjectileRenderParams {
    // Try to load missile image
    const missileImage = this.assetManager.getOrLoadImage('/assets/rocket/rocket3.png');
    
    // Check if image is loaded and ready
    const imageReady = missileImage && 
                       (missileImage.complete || missileImage.naturalWidth > 0) && 
                       missileImage.naturalWidth > 0;
    
    if (imageReady) {
      // Image-based missile - make it larger and more visible
      const imageSize = 10; // Increased size for better visibility
      
      return {
        color: '#ff8800', // Orange (fallback)
        length: 30,
        lineWidth: 6,
        hasImage: true,
        imageSize,
        image: missileImage,
        shadowColor: '#ff8800',
        shadowBlur: 15 // Increased glow
      };
    } else {
      // Fallback: orange laser with glow (always visible, so missiles are always seen)
      return {
        color: '#ff8800', // Orange
        length: 35, // Longer than laser for visibility
        shadowColor: '#ff8800',
        shadowBlur: 15, // More glow
        lineWidth: 6, // Thicker
        hasImage: false
      };
    }
  }
}
