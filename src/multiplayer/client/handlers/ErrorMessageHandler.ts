import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { secureLogger } from '../../../config/NetworkConfig';

/**
 * Handles error messages from the server
 * Displays them in the game log system
 */
export class ErrorMessageHandler extends BaseMessageHandler {
  constructor() {
    super('error');
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const { message: errorMsg, code } = message;

    // Log to console for debugging (and fallback)
    secureLogger.warn(`[SERVER ERROR] ${code || 'UNKNOWN'}: ${errorMsg}`);

    // Show in game log system
    const logSystem = networkSystem.getLogSystem();

    if (logSystem && typeof logSystem.addLogMessage === 'function') {
      // Using 'system' or 'error' style if available, otherwise just text
      // LogType.MISSION (or similar red/important type)
      // Since we can't easily import LogType here without potentially circular deps or checking exports,
      // we'll cast to any or just pass the parameters matching the signature.
      // Signature: addLogMessage(text: string, type: LogType, duration: number)
      // LogType.INFO = 0, WELCOME = 1, ATTACK_FAILED = 2, NPC_KILLED = 3, REWARD = 4, MISSION = 5
      // We probably want 'MISSION' (5) or just default 'INFO' (0).
      // Let's try passing a number if we can't import enum.
      // Or better, let's look at LogMessage.ts to see the enum.
      // Assuming 5 (MISSION) or 2 (ATTACK_FAILED - red?) based on usage.
      // Safe bet: Pass it as 'any' to avoid TS errors if enum not imported, or import it.
      // Let's import it in the next step or just use dynamic access.

      // Actually, let's check LogMessage.ts first.
      if (logSystem && typeof logSystem.addLogMessage === 'function') {
        // Using 'attack_failed' to get red color for errors
        logSystem.addLogMessage(`System: ${errorMsg}`, 'attack_failed', 4000);
      } else {
        // Fallback
        console.warn(`[SERVER ERROR] ${code}: ${errorMsg}`);
      }

      // 🔄 FIX: Reset Portal System state if the error is PORTAL_COOLDOWN
      // We need to access PortalSystem to reset 'isTransitioning' flag
      // networkSystem has 'gameContext', but PortalSystem is in 'ecs'
      // Let's try to find PortalSystem in ECS and reset it.

      if (code === 'PORTAL_COOLDOWN' || code === 'PORTAL_ERROR') {
        const ecs = networkSystem.getECS();
        if (ecs) {
          // We need to import PortalSystem class or dynamic find
          const systems = ecs.getSystems();
          const portalSystem = systems.find((s: any) =>
            (s.constructor as any).Type === 'PortalSystem' ||
            s.constructor.name === 'PortalSystem'
          ) as any;
          if (portalSystem && typeof portalSystem.resetTransitionState === 'function') {
            // Reset immediately so the user can try again (and see the message again if they want)
            // or wait for the cooldown.
            // Actually, if we reset it, they can try again and get the message again (which is what they want).
            portalSystem.resetTransitionState();
          }
        }
      }
    }
  }
}
