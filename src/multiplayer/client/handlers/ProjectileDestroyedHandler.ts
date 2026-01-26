import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { Transform } from '../../../entities/spatial/Transform';

/**
 * Gestisce la distruzione dei proiettili
 */
export class ProjectileDestroyedHandler extends BaseMessageHandler {

  constructor() {
    super(MESSAGE_TYPES.PROJECTILE_DESTROYED);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const remoteProjectileSystem = networkSystem.getRemoteProjectileSystem();
    if (!remoteProjectileSystem) {
      return;
    }

    // Check for missile explosion sound
    // Play sound ONLY if it hit something (not if it just vanished because target was lost)
    const validExplosionReasons = ['target_hit', 'collision', 'hit', 'deterministic_hit'];
    const type = remoteProjectileSystem.getRemoteProjectileType(message.projectileId);

    if (type === 'missile' && validExplosionReasons.includes(message.reason)) {
      const entityId = remoteProjectileSystem.getRemoteProjectileEntity(message.projectileId);
      if (entityId !== undefined) {
        const ecs = networkSystem.getECS();
        const entity = ecs?.getEntity(entityId);

        let position = { x: 0, y: 0 };
        let foundPosition = false;

        // Try to get position from entity transform
        if (entity && ecs) {
          const transform = ecs.getComponent(entity, Transform);
          if (transform) {
            position.x = transform.x;
            position.y = transform.y;
            foundPosition = true;
          }
        }

        if (foundPosition) {
          // Trigger visual explosion animation
          networkSystem.createRemoteExplosion({
            explosionId: `missile_exp_${Date.now()}_${message.projectileId}`,
            entityId: message.projectileId,
            entityType: 'missile',
            position: position,
            explosionType: 'projectile_impact'
          });
        } else {
          // Fallback global sound if position not found (shouldn't happen much)
          const audioSystem = networkSystem.getAudioSystem();
          if (audioSystem) {
            audioSystem.playSound('missileHit', 0.8);
          }
        }
      }
    }

    // Rimuovi il proiettile dal mondo del client
    remoteProjectileSystem.removeRemoteProjectile(message.projectileId);
  }
}
