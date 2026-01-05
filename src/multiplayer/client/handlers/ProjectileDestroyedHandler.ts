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
    console.log(`💥 [CLIENT] Projectile destroyed: ${message.projectileId} (${message.reason})`);

    const remoteProjectileSystem = networkSystem.getRemoteProjectileSystem();
    if (!remoteProjectileSystem) {
      return;
    }

    // Rimuovi il proiettile dal mondo del client
    remoteProjectileSystem.removeRemoteProjectile(message.projectileId);
  }
}
