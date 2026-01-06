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
    // Delega la creazione dell'esplosione al ClientNetworkSystem
    // che ha accesso diretto all'ECS
    networkSystem.createRemoteExplosion(message);
  }


}
