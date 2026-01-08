import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { Health } from '../../../entities/combat/Health';
import { Shield } from '../../../entities/combat/Shield';
import { RemotePlayer } from '../../../entities/player/RemotePlayer';

/**
 * Gestisce i danni ricevuti dalle entità (NPC o giocatori)
 */
export class EntityDamagedHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.ENTITY_DAMAGED);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    console.log(`💥 [EntityDamagedHandler] Received damage:`, JSON.stringify(message));

    // Crea damage text per il danno ricevuto
    const ecs = networkSystem.getECS();
    if (!ecs) {
      console.error('[EntityDamagedHandler] ECS not available!');
      return;
    }

    // Trova il CombatSystem per creare i damage text
    const combatSystem = this.findCombatSystem(ecs);

    if (!combatSystem) {
      console.error('[EntityDamagedHandler] CombatSystem not found in ECS!');
      return;
    }

    // CombatSystem trovato e valido (ha il metodo createDamageText), procedi con la creazione dei damage text
    if (combatSystem) {
      // Trova l'entità danneggiata
      let targetEntity = null;

        if (message.entityType === 'npc') {
          // Usa il RemoteNpcSystem per trovare l'entità dell'NPC remoto
          const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
          if (remoteNpcSystem) {
            // FIX: Converti message.entityId a stringa per gli NPC
            const npcId = message.entityId.toString();
            const entityId = remoteNpcSystem.getRemoteNpcEntity(npcId);
            if (entityId !== undefined) {
              // Ottieni l'entità effettiva dall'ECS usando l'entity ID
              targetEntity = ecs.getEntity(entityId);
            }
          } else {
            console.error('[EntityDamagedHandler] RemoteNpcSystem not available!');
          }
        } else         if (message.entityType === 'player') {
          if (message.entityId === networkSystem.getLocalClientId()) {
            // Giocatore locale - trova l'entità locale
            const allEntities = ecs.getEntitiesWithComponents(Health, Shield);
            for (const entity of allEntities) {
              if (!ecs.hasComponent(entity, RemotePlayer)) {
                targetEntity = entity;
                break;
              }
            }
          } else {
            // Giocatore remoto - trova l'entità remota
            const allEntities = ecs.getEntitiesWithComponents(Health);
            for (const entity of allEntities) {
              const remotePlayer = ecs.getComponent(entity, RemotePlayer);
              if (remotePlayer && remotePlayer.clientId === message.entityId) {
                targetEntity = entity;
                break;
              }
            }
          }
        }

        // Crea damage text se abbiamo trovato l'entità target
        if (targetEntity) {
          // Crea damage text per il danno ricevuto dal server
          if (message.damage > 0) {
            // Per ora mostriamo tutto come danno HP (bianco/rosso)
            // In futuro potremmo migliorare la logica per distinguere shield vs HP
            const isShieldDamage = false;
            combatSystem.createDamageText({ id: targetEntity.id }, message.damage, isShieldDamage);
          }
        }
    }

    // Nota: l'aggiornamento dei valori health/shield è già stato fatto sopra
    // nella sezione di creazione dei damage text per evitare duplicazioni

    if (message.entityType === 'player') {
      // Controlla se il danno è per il giocatore locale
      if (message.entityId === networkSystem.getLocalClientId()) {
        // Danno al giocatore LOCALE - aggiorna i propri componenti

        // Trova e aggiorna i componenti del giocatore locale
        if (ecs) {
          // Il giocatore locale ha componenti come PlayerUpgrades, PlayerStats, ecc.
          // Cerchiamo entità che hanno Health e Shield ma non RemotePlayer
          const allEntities = ecs.getEntitiesWithComponents(Health, Shield);

          for (const entity of allEntities) {
            // Salta remote players (hanno anche RemotePlayer component)
            if (ecs.hasComponent(entity, RemotePlayer)) continue;

            // Questa dovrebbe essere l'entità del giocatore locale
            const healthComponent = ecs.getComponent(entity, Health);
            const shieldComponent = ecs.getComponent(entity, Shield);

            if (healthComponent && shieldComponent) {
              healthComponent.current = message.newHealth;
              shieldComponent.current = message.newShield;
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
   * Trova il CombatSystem nell'ECS (robusto contro minificazione)
   */
  private findCombatSystem(ecs: any): any {
    // Cerca il sistema che ha il metodo createDamageText (unico del CombatSystem)
    const systems = ecs.getSystems ? ecs.getSystems() : [];
    return systems.find((system: any) => typeof system.createDamageText === 'function');
  }
}
