import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES, secureLogger } from '../../../config/NetworkConfig';

/**
 * Handles MAP_TRANSITION_START messages from the server.
 * Locks input and pauses position updates until map_change arrives.
 */
export class MapTransitionStartHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.MAP_TRANSITION_START);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    secureLogger.log('Handling MAP_TRANSITION_START:', message);

    // Pause position updates until map_change resumes them
    if (typeof networkSystem.pausePositionUpdatesUntilResume === 'function') {
      networkSystem.pausePositionUpdatesUntilResume();
    } else if (typeof networkSystem.pausePositionUpdates === 'function') {
      // Fallback: pause for 5 seconds if resume method not available
      networkSystem.pausePositionUpdates(5000);
    }

    const ecs = networkSystem.getECS();
    if (!ecs) return;

    // Lock input and stop movement immediately
    const systems = ecs.getSystems();
    const playerControlSystem = systems.find((s: any) => s.constructor?.name === 'PlayerControlSystem') as any;
    if (playerControlSystem) {
      if (typeof playerControlSystem.setInputForcedDisabled === 'function') {
        playerControlSystem.setInputForcedDisabled(true);
      }
      if (typeof playerControlSystem.forceStopMovement === 'function') {
        playerControlSystem.forceStopMovement();
      }
    }
  }
}
