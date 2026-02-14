import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { PlayerDataResponseMessage } from '../../../config/NetworkConfig';
import { PlayerUpgrades } from '../../../entities/player/PlayerUpgrades';
import { PlayerRole } from '../../../entities/player/PlayerRole';
import { Health } from '../../../entities/combat/Health';
import { Shield } from '../../../entities/combat/Shield';
import { ActiveQuest } from '../../../entities/quest/ActiveQuest';
import { Inventory } from '../../../entities/player/Inventory';

/**
 * Handles player data response messages from the server
 * Updates the client's player data with complete inventory, upgrades, and quests
 */
export class PlayerDataResponseHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PLAYER_DATA_RESPONSE);
  }

  handle(message: PlayerDataResponseMessage, networkSystem: ClientNetworkSystem): void {
    // Aggiorna i dati del giocatore nel game context
    if (networkSystem.gameContext) {
      // Aggiorna inventory
      if (message.inventory) {
        networkSystem.gameContext.playerInventory = {
          ...message.inventory,
          recentHonor: message.recentHonor // Includi RecentHonor nell'inventory
        };
      }

      // Aggiorna upgrades
      if (message.upgrades) {
        networkSystem.gameContext.playerUpgrades = message.upgrades;
      }

      // Aggiorna quests
      if (message.quests) {
        networkSystem.gameContext.playerQuests = message.quests;

        // Hydrate QuestManager
        const questManager = networkSystem.getQuestManager();
        if (questManager) {

          // Ensure QuestManager has the player ID (critical for saving)
          if (networkSystem.gameContext.playerDbId) {
            questManager.setPlayerId(networkSystem.gameContext.playerDbId);
          } else {
            console.warn('[PlayerDataResponseHandler] GameContext has no playerDbId! Quest saving may fail.');
          }

          questManager.loadState(message.quests);

          // Ripristina le quest attive nel componente del giocatore
          const playerEntity = networkSystem.getPlayerSystem()?.getPlayerEntity();
          const ecs = networkSystem.getECS();


          if (playerEntity && ecs) {
            const activeQuestComponent = ecs.getComponent(playerEntity, ActiveQuest);

            if (activeQuestComponent) {
              questManager.restoreActiveQuests(message.quests, activeQuestComponent);
            } else {
              console.warn('[PlayerDataResponseHandler] ActiveQuest component missing on player entity!');
              questManager.setPendingQuestState(message.quests);
            }
          } else {
            questManager.setPendingQuestState(message.quests);
          }
        } else {
          console.warn('[PlayerDataResponseHandler] QuestManager not found!');
        }
      }
    }

    // AGGIORNA ECONOMY SYSTEM CON DATI DAL DATABASE (server authoritative)
    const economySystem = networkSystem.getEconomySystem();
    if (economySystem && message.inventory) {
      economySystem.setExperience(message.inventory.experience, 'server_update');
      economySystem.setCredits(message.inventory.credits, 'server_update');
      economySystem.setCosmos(message.inventory.cosmos, 'server_update');
      economySystem.setHonor(message.inventory.honor, 'server_update');

      // Aggiorna RecentHonor in RankSystem se disponibile
      if (message.recentHonor !== undefined) {
        economySystem.setRecentHonor(message.recentHonor);

        // Notifica che i dati sono pronti (per PlayState)
        // Questo viene fatto tramite il context che viene aggiornato sopra
      }

      // ✅ L'ECONOMY SYSTEM TRIGGERA AUTOMATICAMENTE onExperienceChanged -> UiSystem.updatePlayerData
    } else {
    }

    // ✅ L'ECONOMY SYSTEM TRIGGERA AUTOMATICAMENTE onExperienceChanged -> UiSystem.updatePlayerData


    // SINCRONIZZA IL RUOLO DEL PLAYER (Server Authoritative)
    // 🔧 FIX: Also check pendingAdministrator from GameContext (from welcome message)
    const playerEntity = networkSystem.getPlayerSystem()?.getPlayerEntity();
    const ecs = networkSystem.getECS();
    if (playerEntity && ecs) {
      const playerRole = ecs?.getComponent(playerEntity, PlayerRole);
      if (playerRole) {
        // Use message.isAdministrator if available, otherwise check pending from GameContext
        if (message.isAdministrator !== undefined) {
          playerRole.setAdministrator(message.isAdministrator);
        } else if (networkSystem.gameContext.pendingAdministrator !== null) {
          playerRole.setAdministrator(networkSystem.gameContext.pendingAdministrator);
          networkSystem.gameContext.pendingAdministrator = null; // Clear after applying
        }

        // Sincronizza il Rank (Fisso + Percentili dal DB)
        if (message.rank) {
          playerRole.setRank(message.rank);
        }
      }
    }

    // SINCRONIZZA GLI UPGRADE DEL PLAYER CON IL COMPONENTE ECS (Server Authoritative)
    if (networkSystem.getPlayerSystem() && message.upgrades) {
      if (playerEntity && ecs) {
        const playerUpgrades = ecs.getComponent(playerEntity, PlayerUpgrades);

        if (playerUpgrades) {
          // Sincronizza gli upgrade ricevuti dal server con il componente ECS
          playerUpgrades.setUpgrades(
            message.upgrades.hpUpgrades || 0,
            message.upgrades.shieldUpgrades || 0,
            message.upgrades.speedUpgrades || 0,
            message.upgrades.damageUpgrades || 0,
            message.upgrades.missileDamageUpgrades || 0
          );
        }
      }
    }

    // SINCRONIZZA L'INVENTARIO ITEMS (Server Authoritative)
    if (networkSystem.getPlayerSystem() && (message as any).items) {
      if (playerEntity && ecs) {
        const inventoryComponent = ecs.getComponent(playerEntity, Inventory);

        if (inventoryComponent) {
          inventoryComponent.sync((message as any).items);
          // console.log('[PlayerDataResponseHandler] Inventory synced with', (message as any).items.length, 'items');

          // Refresh stats to apply item bonuses
          networkSystem.getPlayerSystem()?.refreshPlayerStats();
        }
      }
    }

    // Applica SEMPRE i vitals server-authoritative se presenti nel payload.
    // Questo evita che eventuali ricalcoli locali lascino HP/SHD "stale" dopo il login.
    const hasAuthoritativeVitals =
      typeof message.health === 'number' &&
      typeof message.maxHealth === 'number' &&
      typeof message.shield === 'number' &&
      typeof message.maxShield === 'number';

    if (hasAuthoritativeVitals && playerEntity && ecs) {
      const health = message.health as number;
      const maxHealth = message.maxHealth as number;
      const shield = message.shield as number;
      const maxShield = message.maxShield as number;

      const healthComponent = ecs.getComponent(playerEntity, Health);
      if (healthComponent) {
        healthComponent.current = health;
        healthComponent.max = maxHealth;
      }

      const shieldComponent = ecs.getComponent(playerEntity, Shield);
      if (shieldComponent) {
        shieldComponent.current = shield;
        shieldComponent.max = maxShield;
      }

      // Refresh immediato HUD HP/SHD senza aspettare il prossimo tick.
      const playerStatusSystem = ecs
        .getSystems()
        .find((s: any) => s.constructor.name === 'PlayerStatusDisplaySystem') as any;
      if (playerStatusSystem && typeof playerStatusSystem.updateDisplay === 'function') {
        playerStatusSystem.updateDisplay();
      }
    }

    // Gli altri sistemi vengono aggiornati sopra con i dati economici
  }
}
