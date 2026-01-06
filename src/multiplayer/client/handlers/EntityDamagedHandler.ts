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
      console.log(`💥 [DAMAGE_TEXT] Found CombatSystem: ${!!combatSystem}, has createDamageText: ${!!(combatSystem && combatSystem.createDamageText)}`);

      if (combatSystem && combatSystem.createDamageText) {
        // Trova l'entità danneggiata
        let targetEntity = null;

        if (message.entityType === 'npc') {
          console.log(`💥 [DAMAGE_TEXT] Looking for NPC entity ${message.entityId}`);
          // Usa il RemoteNpcSystem per trovare l'entità dell'NPC remoto
          const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
          if (remoteNpcSystem) {
            const entityId = remoteNpcSystem.getRemoteNpcEntity(message.entityId);
            if (entityId !== undefined) {
              targetEntity = entityId;
              console.log(`💥 [DAMAGE_TEXT] Found NPC entity ${entityId} for server ID ${message.entityId}`);
            } else {
              console.log(`💥 [DAMAGE_TEXT] RemoteNpcSystem returned undefined for NPC ${message.entityId}`);
            }
          } else {
            console.log(`💥 [DAMAGE_TEXT] RemoteNpcSystem not available`);
          }
        } else if (message.entityType === 'player') {
          console.log(`💥 [DAMAGE_TEXT] Looking for player entity ${message.entityId}, local client: ${networkSystem.getLocalClientId()}`);
          if (message.entityId === networkSystem.getLocalClientId()) {
            console.log(`💥 [DAMAGE_TEXT] This is local player damage`);
            // Giocatore locale - trova l'entità locale
            const allEntities = ecs.getEntitiesWithComponents(Health, Shield);
            console.log(`💥 [DAMAGE_TEXT] Found ${allEntities.length} local entities with Health+Shield`);
            for (const entity of allEntities) {
              console.log(`💥 [DAMAGE_TEXT] Checking local entity ${entity}, has RemotePlayer: ${ecs.hasComponent(entity, 'RemotePlayer')}`);
              if (!ecs.hasComponent(entity, 'RemotePlayer')) {
                targetEntity = entity;
                console.log(`💥 [DAMAGE_TEXT] Found local player entity ${entity}`);
                break;
              }
            }
          } else {
            console.log(`💥 [DAMAGE_TEXT] This is remote player damage`);
            // Giocatore remoto - trova l'entità remota
            const allEntities = ecs.getEntitiesWithComponents(Health);
            console.log(`💥 [DAMAGE_TEXT] Found ${allEntities.length} entities with Health for remote players`);
            for (const entity of allEntities) {
              const remotePlayer = ecs.getComponent(entity, 'RemotePlayer');
              console.log(`💥 [DAMAGE_TEXT] Checking remote entity ${entity}, RemotePlayer component: ${!!remotePlayer}, clientId: ${remotePlayer?.clientId}`);
              if (remotePlayer && remotePlayer.clientId === message.entityId) {
                targetEntity = entity;
                console.log(`💥 [DAMAGE_TEXT] Found remote player entity ${entity}`);
                break;
              }
            }
          }
        }

        // Crea il damage text se abbiamo trovato l'entità
        console.log(`💥 [DAMAGE_TEXT] Target entity found: ${!!targetEntity} (entity ID: ${targetEntity})`);
        if (targetEntity) {
          // Determina se è danno a shield o HP
          const oldHealth = message.newHealth + message.damage; // Ricostruisci il valore precedente
          const oldShield = message.newShield; // Assumiamo che il danno sia andato prima allo shield

          console.log(`💥 [DAMAGE_TEXT] Damage calculation - oldHealth: ${oldHealth}, newHealth: ${message.newHealth}, oldShield: ${oldShield}, newShield: ${message.newShield}`);

          if (message.newShield < oldShield) {
            // Danno a shield
            const shieldDamage = oldShield - message.newShield;
            console.log(`💥 [DAMAGE_TEXT] Creating shield damage text: ${shieldDamage}`);
            combatSystem.createDamageText(targetEntity, shieldDamage, true); // true = shield damage
          }

          if (message.newHealth < oldHealth) {
            // Danno a HP
            const healthDamage = oldHealth - message.newHealth;
            console.log(`💥 [DAMAGE_TEXT] Creating HP damage text: ${healthDamage}`);
            combatSystem.createDamageText(targetEntity, healthDamage, false); // false = HP damage
          }
        } else {
          console.log(`💥 [DAMAGE_TEXT] No target entity found for ${message.entityType} ${message.entityId}`);
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
