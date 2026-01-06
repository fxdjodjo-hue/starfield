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
    console.log(`💥 [DAMAGE_TEXT] Received entity_damaged: ${message.entityType} ${message.entityId}, damage: ${message.damage}, newHealth: ${message.newHealth}, newShield: ${message.newShield}`);

    // Crea damage text per il danno ricevuto
    const ecs = networkSystem.getECS();
    if (ecs) {
      // Trova il CombatSystem per creare i damage text
      const combatSystem = this.findCombatSystem(ecs);

      if (combatSystem && combatSystem.createDamageText) {
        // Trova l'entità danneggiata
        let targetEntity = null;

        if (message.entityType === 'npc') {
          // Usa il RemoteNpcSystem per trovare l'entità dell'NPC remoto
          const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
          if (remoteNpcSystem) {
            const entityId = remoteNpcSystem.getRemoteNpcEntity(message.entityId);
            console.log(`💥 [DAMAGE_TEXT] RemoteNpcSystem lookup for ${message.entityId}: ${entityId}`);
            if (entityId !== undefined) {
              // Ottieni l'entità effettiva dall'ECS usando l'entity ID
              targetEntity = ecs.getEntity(entityId);
              console.log(`💥 [DAMAGE_TEXT] ECS entity lookup result: ${targetEntity}, type: ${typeof targetEntity}`);
              if (targetEntity) {
                console.log(`💥 [DAMAGE_TEXT] Entity found with id: ${targetEntity.id}`);
              } else {
                console.log(`💥 [DAMAGE_TEXT] Entity ${entityId} not found in ECS, available entities: ${Array.from(ecs.getEntitiesWithComponents(Transform)).map(e => e.id).join(', ')}`);
              }
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
        console.log(`💥 [DAMAGE_TEXT] Target entity: ${targetEntity} for ${message.entityType} ${message.entityId}`);
        if (targetEntity !== undefined && targetEntity !== null && typeof targetEntity.id === 'number' && targetEntity.id >= 0) {
          // Mostra il danno totale come testo rosso (HP damage)
          // Il server ha già applicato correttamente la logica shield→HP
          console.log(`💥 [DAMAGE_TEXT] Creating damage text: ${message.damage} for ${message.entityType} ${message.entityId}, entity ID: ${targetEntity.id}`);
          combatSystem.createDamageText(targetEntity, message.damage, false); // false = HP damage (rosso)
        } else {
          console.log(`💥 [DAMAGE_TEXT] No valid target entity found for ${message.entityType} ${message.entityId} (targetEntity: ${targetEntity}, id: ${targetEntity?.id})`);
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
