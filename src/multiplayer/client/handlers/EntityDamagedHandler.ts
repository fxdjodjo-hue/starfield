import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { Health } from '../../../entities/combat/Health';
import { Shield } from '../../../entities/combat/Shield';

/**
 * Gestisce i danni ricevuti dalle entità (NPC o giocatori)
 */
export class EntityDamagedHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.ENTITY_DAMAGED);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    if (message.entityType === 'npc') {
      // Danno a NPC
      const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
      if (remoteNpcSystem) {
        remoteNpcSystem.updateRemoteNpc(message.entityId, undefined, {
          current: message.newHealth,
          max: message.newHealth // TODO: gestire max health correttamente
        });
      }
    } else if (message.entityType === 'player') {
      // Controlla se il danno è per il giocatore locale
      if (message.entityId === networkSystem.getLocalClientId()) {
        // Danno al giocatore LOCALE - aggiorna i propri componenti
        console.log(`💥 [CLIENT] Local player damaged: ${message.newHealth} HP, ${message.newShield} shield`);

        // Trova e aggiorna i componenti del giocatore locale
        const ecs = networkSystem.getECS();
        if (ecs) {
          // Il giocatore locale ha componenti come PlayerUpgrades, PlayerStats, ecc.
          // Cerchiamo entità che hanno Health e Shield ma non RemotePlayer
          const allEntities = ecs.getEntitiesWithComponents(Health, Shield);

          for (const entity of allEntities) {
            // Salta remote players (hanno anche RemotePlayer component)
            if (ecs.hasComponent(entity, 'RemotePlayer')) continue;

            // Questa dovrebbe essere l'entità del giocatore locale
            const healthComponent = ecs.getComponent(entity, Health);
            const shieldComponent = ecs.getComponent(entity, Shield);

            if (healthComponent && shieldComponent) {
              healthComponent.current = message.newHealth;
              shieldComponent.current = message.newShield;
              console.log(`✅ [CLIENT] Updated local player health: ${healthComponent.current}/${healthComponent.max}, shield: ${shieldComponent.current}/${shieldComponent.max}`);
              break;
            }
          }
        }

        // TODO: Aggiungere effetti visivi di danno per il giocatore locale (screen shake, damage numbers, etc.)
      } else {
        // Danno a giocatore remoto
        const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
        if (remotePlayerSystem) {
          // Per i remote players, assumiamo che max health/shield siano gli stessi dei valori correnti ricevuti
          // In futuro potremmo voler ricevere anche i valori massimi dal server
          remotePlayerSystem.updatePlayerStats(message.entityId, message.newHealth, message.newHealth, message.newShield, message.newShield);
        }
      }
    }

    // TODO: Aggiungere effetti visivi di danno (particle effects, screen shake, etc.)
  }
}
