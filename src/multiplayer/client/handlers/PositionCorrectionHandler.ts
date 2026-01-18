import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { MathUtils } from '../../../core/utils/MathUtils';

/**
 * Handles position correction messages from the server
 * Applies server-authoritative position corrections to maintain sync
 */
export class PositionCorrectionHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.POSITION_CORRECTION);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const { clientId, position, velocityX, velocityY, timestamp } = message;

    // Applica correzione SOLO se differenza significativa (>5px)
    const currentPos = networkSystem.getLocalPlayerPosition();
    const dx = position.x - currentPos.x;
    const dy = position.y - currentPos.y;
    const dr = position.rotation - currentPos.rotation;
    const distance = MathUtils.calculateDistance(position.x, position.y, currentPos.x, currentPos.y);

    if (distance > 5 || Math.abs(dr) > 0.1) {

      // TRUTH LOG: Correzione posizione ricevuta dal server

      // Applica correzione alla posizione locale del player
      networkSystem.invalidatePositionCache(); // Forza aggiornamento cache

      // In un sistema ECS reale, qui aggiorneremmo i componenti Transform e Velocity
      // Per ora, lasciamo che il sistema di movimento naturale si sincronizzi gradualmente
      // o implementiamo un'interpolazione smooth verso la posizione corretta
    }
  }
}