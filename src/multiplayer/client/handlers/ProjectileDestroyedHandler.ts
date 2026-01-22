import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

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

    // Missile explosion sound logic removed - missiles are no longer supported

    // Rimuovi il proiettile dal mondo del client
    remoteProjectileSystem.removeRemoteProjectile(message.projectileId);
  }
}
