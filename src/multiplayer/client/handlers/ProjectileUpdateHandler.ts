import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce gli aggiornamenti di posizione dei proiettili
 */
export class ProjectileUpdateHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PROJECTILE_UPDATE);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const remoteProjectileSystem = networkSystem.getRemoteProjectileSystem();
    if (!remoteProjectileSystem) {
      return;
    }

    // Aggiorna posizione proiettile (solo per proiettili non locali)
    remoteProjectileSystem.updateRemoteProjectile(message.projectileId, message.position);
  }
}
