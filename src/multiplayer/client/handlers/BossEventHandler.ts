import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { LogType } from '../../../presentation/ui/LogMessage';
import type { LogCategory } from '../../../systems/rendering/LogSystem';

/**
 * Gestisce i messaggi evento boss e li inoltra al LogSystem in-game.
 */
export class BossEventHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.BOSS_EVENT);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const logSystem = networkSystem.getLogSystem();
    if (!logSystem || typeof logSystem.addLogMessage !== 'function') return;

    const content = typeof message?.content === 'string' ? message.content.trim() : '';
    if (!content) return;

    const durationMs = Number.isFinite(message?.durationMs)
      ? Math.max(2000, Math.min(12000, Math.floor(Number(message.durationMs))))
      : 5000;

    logSystem.addLogMessage(
      content,
      this.resolveLogType(message?.severity),
      durationMs,
      this.resolveLogCategory()
    );
  }

  private resolveLogType(severity: string): LogType {
    switch (String(severity || '').toLowerCase()) {
      case 'danger':
      case 'warning':
        return LogType.ATTACK_FAILED;
      case 'success':
        return LogType.REWARD;
      case 'mission':
      case 'info':
      default:
        return LogType.MISSION;
    }
  }

  private resolveLogCategory(): LogCategory {
    return 'events';
  }
}
