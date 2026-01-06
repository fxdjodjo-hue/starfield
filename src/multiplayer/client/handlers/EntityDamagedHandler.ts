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
    // Crea damage text per il danno ricevuto
    const ecs = networkSystem.getECS();
    if (ecs) {
      // Trova il CombatSystem per creare i damage text
      const combatSystem = this.findCombatSystem(ecs);
      if (combatSystem && combatSystem.createDamageText) {
        // Trova l'entità danneggiata
        let targetEntity = null;

        if (message.entityType === 'npc') {
          // Cerca l'NPC remoto con l'ID specificato
          const allEntities = ecs.getEntitiesWithComponents(Health);
          for (const entity of allEntities) {
            // Per gli NPC, l'entityId nel messaggio corrisponde all'ID entità
            if (entity === message.entityId) {
              targetEntity = entity;
              break;
            }
          }
        } else if (message.entityType === 'player') {
          if (message.entityId === networkSystem.getLocalClientId()) {
            // Giocatore locale - trova l'entità locale
            const allEntities = ecs.getEntitiesWithComponents(Health, Shield);
            for (const entity of allEntities) {
              if (!ecs.hasComponent(entity, 'RemotePlayer')) {
                targetEntity = entity;
                break;
              }
            }
          } else {
            // Giocatore remoto - trova l'entità remota
            const allEntities = ecs.getEntitiesWithComponents(Health);
            for (const entity of allEntities) {
              const remotePlayer = ecs.getComponent(entity, 'RemotePlayer');
              if (remotePlayer && remotePlayer.clientId === message.entityId) {
                targetEntity = entity;
                break;
              }
            }
          }
        }

        // Crea il damage text se abbiamo trovato l'entità
        if (targetEntity) {
          // Determina se è danno a shield o HP
          const oldHealth = message.newHealth + message.damage; // Ricostruisci il valore precedente
          const oldShield = message.newShield; // Assumiamo che il danno sia andato prima allo shield

          if (message.newShield < oldShield) {
            // Danno a shield
            const shieldDamage = oldShield - message.newShield;
            combatSystem.createDamageText(targetEntity, shieldDamage, true); // true = shield damage
          }

          if (message.newHealth < oldHealth) {
            // Danno a HP
            const healthDamage = oldHealth - message.newHealth;
            combatSystem.createDamageText(targetEntity, healthDamage, false); // false = HP damage
          }
        }
      }
    }

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

    // TODO: Aggiungere altri effetti visivi di danno (particle effects, screen shake, etc.)
  }

  /**
   * Trova il CombatSystem nell'ECS
   */
  private findCombatSystem(ecs: any): any {
    // Cerca il CombatSystem nell'ECS
    const systems = ecs.systems || [];
    return systems.find((system: any) => system.constructor.name === 'CombatSystem');
  }
}
