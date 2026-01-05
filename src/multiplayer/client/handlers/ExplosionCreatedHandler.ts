import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce la creazione di esplosioni per effetti visivi sincronizzati
 */
export class ExplosionCreatedHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.EXPLOSION_CREATED);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    console.log(`💥 [CLIENT] Explosion created: ${message.explosionType} at (${message.position.x.toFixed(0)}, ${message.position.y.toFixed(0)})`);

    // Delega la creazione dell'esplosione al ClientNetworkSystem
    // che ha accesso diretto all'ECS
    networkSystem.createRemoteExplosion(message);
  }


}
