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
import { getPlayerDefinition } from '../../../config/PlayerConfig';
import { AnimatedSprite } from '../../../entities/AnimatedSprite';
import { createPlayerShipAnimatedSprite } from '../../../core/services/PlayerShipSpriteFactory';
import { getSelectedPlayerShipSkinId, getUnlockedPlayerShipSkinIds } from '../../../config/ShipSkinConfig';

/**
 * Handles player data response messages from the server
 * Updates the client's player data with complete inventory, upgrades, and quests
 */
export class PlayerDataResponseHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PLAYER_DATA_RESPONSE);
  }

  handle(message: PlayerDataResponseMessage, networkSystem: ClientNetworkSystem): void {
    const normalizedResourceInventory = this.normalizeResourceInventory(message.resourceInventory);

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

      if (message.shipSkins) {
        const selectedSkinId = getSelectedPlayerShipSkinId(message.shipSkins.selectedSkinId || null);
        const unlockedSkinIds = getUnlockedPlayerShipSkinIds(
          message.shipSkins.unlockedSkinIds || [],
          selectedSkinId
        );
        networkSystem.gameContext.playerShipSkinId = selectedSkinId;
        networkSystem.gameContext.unlockedPlayerShipSkinIds = unlockedSkinIds;
      }

      if (normalizedResourceInventory) {
        networkSystem.gameContext.playerResourceInventory = normalizedResourceInventory;
        this.notifyResourceInventoryUpdated(normalizedResourceInventory);
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
    if (playerEntity && networkSystem.getECS()) {
      const ecs = networkSystem.getECS();
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
      const playerEntity = networkSystem.getPlayerSystem()?.getPlayerEntity();
      if (playerEntity && networkSystem.getECS()) {
        const ecs = networkSystem.getECS();
        const playerUpgrades = ecs?.getComponent(playerEntity, PlayerUpgrades);

        if (playerUpgrades) {
          // Sincronizza gli upgrade ricevuti dal server con il componente ECS
          playerUpgrades.setUpgrades(
            message.upgrades.hpUpgrades || 0,
            message.upgrades.shieldUpgrades || 0,
            message.upgrades.speedUpgrades || 0,
            message.upgrades.damageUpgrades || 0,
            message.upgrades.missileDamageUpgrades || 0
          );

          // APPLICA GLI UPGRADE AI VALORI ATTUALI DI HP E SHIELD
          const playerDef = getPlayerDefinition();

          // Aggiorna Health component con upgrade applicati
          const healthComponent = ecs?.getComponent(playerEntity, Health);
          if (healthComponent) {
            const newMaxHP = Math.floor(playerDef.stats.health * playerUpgrades.getHPBonus());
            const currentHPPercent = healthComponent.current / healthComponent.max;
            healthComponent.max = newMaxHP;
            healthComponent.current = Math.floor(newMaxHP * currentHPPercent);
          }

          // Aggiorna Shield component con upgrade applicati
          const shieldComponent = ecs?.getComponent(playerEntity, Shield);
          if (shieldComponent && playerDef.stats.shield) {
            const newMaxShield = Math.floor(playerDef.stats.shield * playerUpgrades.getShieldBonus());
            const currentShieldPercent = shieldComponent.current / shieldComponent.max;
            shieldComponent.max = newMaxShield;
            shieldComponent.current = Math.floor(newMaxShield * currentShieldPercent);
          }
        }
      }
    }

    // SINCRONIZZA L'INVENTARIO ITEMS (Server Authoritative)
    if (networkSystem.getPlayerSystem() && (message as any).items) {
      const playerEntity = networkSystem.getPlayerSystem()?.getPlayerEntity();
      if (playerEntity && networkSystem.getECS()) {
        const ecs = networkSystem.getECS();
        const inventoryComponent = ecs?.getComponent(playerEntity, Inventory);

        if (inventoryComponent) {
          inventoryComponent.sync((message as any).items);
          // console.log('[PlayerDataResponseHandler] Inventory synced with', (message as any).items.length, 'items');

          // Refresh stats to apply item bonuses
          networkSystem.getPlayerSystem()?.refreshPlayerStats();
        }
      }
    }

    // Gli altri sistemi vengono aggiornati sopra con i dati economici
    if (message.shipSkins) {
      const selectedSkinId = getSelectedPlayerShipSkinId(message.shipSkins.selectedSkinId || null);
      const playerEntity = networkSystem.getPlayerSystem()?.getPlayerEntity();
      const ecs = networkSystem.getECS();
      const assetManager = networkSystem.gameContext.assetManager;

      if (playerEntity && ecs && assetManager) {
        createPlayerShipAnimatedSprite(assetManager, selectedSkinId)
          .then((playerAnimatedSprite) => {
            ecs.addComponent(playerEntity, AnimatedSprite, playerAnimatedSprite);
            const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
            if (remotePlayerSystem && typeof remotePlayerSystem.updateSharedAnimatedSprite === 'function') {
              remotePlayerSystem.updateSharedAnimatedSprite(playerAnimatedSprite);
            }
          })
          .catch((error) => {
            if (import.meta.env.DEV) {
              console.warn(`[PlayerDataResponseHandler] Failed to apply ship skin "${selectedSkinId}"`, error);
            }
          });
      }
    }

    if (normalizedResourceInventory) {
      this.updateCraftingPanel(networkSystem, normalizedResourceInventory);
    }
  }

  private normalizeResourceInventory(rawInventory: unknown): Record<string, number> | null {
    if (!rawInventory || typeof rawInventory !== 'object') return null;

    const normalizedInventory: Record<string, number> = {};
    for (const [rawType, rawQuantity] of Object.entries(rawInventory as Record<string, unknown>)) {
      const resourceType = String(rawType || '').trim();
      if (!resourceType) continue;

      const parsedQuantity = Number(rawQuantity);
      normalizedInventory[resourceType] = Number.isFinite(parsedQuantity)
        ? Math.max(0, Math.floor(parsedQuantity))
        : 0;
    }

    return normalizedInventory;
  }

  private updateCraftingPanel(networkSystem: ClientNetworkSystem, resourceInventory: Record<string, number>): void {
    const uiSystem = networkSystem.getUiSystem();
    if (!uiSystem || typeof uiSystem.getUIManager !== 'function') return;

    const uiManager = uiSystem.getUIManager();
    const craftingPanel = uiManager?.getPanel?.('crafting-panel');
    if (craftingPanel && typeof (craftingPanel as any).update === 'function') {
      (craftingPanel as any).update({ resourceInventory });
    }
  }

  private notifyResourceInventoryUpdated(resourceInventory: Record<string, number>): void {
    if (typeof document === 'undefined') return;
    document.dispatchEvent(new CustomEvent('playerResourceInventoryUpdated', {
      detail: { resourceInventory }
    }));
  }
}
