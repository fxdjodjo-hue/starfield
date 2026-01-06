import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { RewardSystem } from '../../../systems/rewards/RewardSystem';

/**
 * Gestisce la distruzione delle entità (NPC o giocatori morti)
 */
export class EntityDestroyedHandler extends BaseMessageHandler {
  private rewardSystem: RewardSystem | null = null;

  constructor() {
    super(MESSAGE_TYPES.ENTITY_DESTROYED);
  }

  /**
   * Imposta il riferimento al RewardSystem per assegnare ricompense
   */
  setRewardSystem(rewardSystem: RewardSystem): void {
    this.rewardSystem = rewardSystem;
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    console.log(`💥 [CLIENT] Entity destroyed: ${message.entityId} (${message.entityType})`);

    if (message.entityType === 'npc') {
      // NPC distrutto - assegna ricompense se presenti
      if (message.rewards && this.rewardSystem) {
        // Converti l'entityId NPC (es. "npc_6") nel tipo NPC (es. "Scouter")
        const npcType = this.extractNpcTypeFromId(message.entityId);
        this.rewardSystem.assignRewardsFromServer(message.rewards, npcType);
        console.log(`💰 [REWARDS] Assegnate ricompense per ${npcType}:`, message.rewards);
      }

      // Rimuovi l'NPC dal sistema remoto
      const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
      if (remoteNpcSystem) {
        const removed = remoteNpcSystem.removeRemoteNpc(message.entityId);
        console.log(`🗑️ [CLIENT] NPC ${message.entityId} removed from RemoteNpcSystem: ${removed}`);
      }
    } else if (message.entityType === 'player') {
      // Giocatore remoto morto
      const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
      if (remotePlayerSystem) {
        remotePlayerSystem.removeRemotePlayer(message.entityId);
      }
    }

    // TODO: Aggiungere effetti visivi di distruzione (esplosioni, particle effects, etc.)
    // Per ora, le esplosioni vengono gestite dal server attraverso messaggi separati
  }

  /**
   * Estrae il tipo NPC dall'entityId del server (es. "npc_6" -> "Scouter")
   * Per ora usa una logica semplice basata sull'ID, ma potrebbe essere migliorata
   */
  private extractNpcTypeFromId(entityId: string): string {
    // Il server potrebbe includere il tipo nel messaggio in futuro
    // Per ora assumiamo che gli NPC con ID < 25 siano Scouter, gli altri Frigate
    const npcNumber = parseInt(entityId.replace('npc_', ''));
    return npcNumber < 25 ? 'Scouter' : 'Frigate';
  }
}
