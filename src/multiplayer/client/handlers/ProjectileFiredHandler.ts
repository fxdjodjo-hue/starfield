import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce il messaggio projectile_fired quando un giocatore spara
 */
export class ProjectileFiredHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PROJECTILE_FIRED);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    console.log(`🔫 [CLIENT] Projectile fired: ${message.projectileId} by ${message.playerId}`);

    const remoteProjectileSystem = networkSystem.getRemoteProjectileSystem();
    if (!remoteProjectileSystem) {
      console.error('[CLIENT] RemoteProjectileSystem not available for projectile fired');
      return;
    }

    // Aggiungi sempre il proiettile al sistema remoto per renderizzarlo
    // Anche i proiettili del giocatore locale vengono creati dal server
    remoteProjectileSystem.addRemoteProjectile(
      message.projectileId,
      message.playerId,
      message.position,
      message.velocity,
      message.damage,
      message.projectileType,
      message.targetId
    );
  }
}
