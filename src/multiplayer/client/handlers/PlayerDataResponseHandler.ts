import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { PlayerDataResponseMessage } from '../../../config/NetworkConfig';
import { SkillPoints } from '../../../entities/currency/SkillPoints';

/**
 * Handles player data response messages from the server
 * Updates the client's player data with complete inventory, upgrades, and quests
 */
export class PlayerDataResponseHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PLAYER_DATA_RESPONSE);
  }

  handle(message: PlayerDataResponseMessage, networkSystem: ClientNetworkSystem): void {
    console.log('📊 [PLAYER_DATA] ===== PLAYER DATA RESPONSE RECEIVED =====');
    console.log('📊 [PLAYER_DATA] Player ID:', message.playerId);
    console.log('📊 [PLAYER_DATA] Inventory:', message.inventory);
    console.log('📊 [PLAYER_DATA] Upgrades:', message.upgrades);
    console.log('📊 [PLAYER_DATA] Quests count:', message.quests?.length || 0);
    console.log('📊 [PLAYER_DATA] Full message:', message);

    // Aggiorna i dati del giocatore nel game context
    if (networkSystem.gameContext) {
      // Aggiorna inventory
      if (message.inventory) {
        networkSystem.gameContext.playerInventory = message.inventory;
        console.log('💰 [PLAYER_DATA] Inventory updated:', message.inventory);
        console.log('🔍 [PLAYER_DATA] GameContext playerInventory after update:', networkSystem.gameContext.playerInventory);
      }

      // Aggiorna upgrades
      if (message.upgrades) {
        networkSystem.gameContext.playerUpgrades = message.upgrades;
        console.log('⬆️ [PLAYER_DATA] Upgrades updated:', message.upgrades);
        console.log('🔍 [PLAYER_DATA] GameContext playerUpgrades after update:', networkSystem.gameContext.playerUpgrades);
      }

      // Aggiorna quests
      if (message.quests) {
        networkSystem.gameContext.playerQuests = message.quests;
        console.log('📜 [PLAYER_DATA] Quests updated:', message.quests.length, 'quests');
      }

      console.log('🔍 [PLAYER_DATA] GameContext reference check:', networkSystem.gameContext);
    }

    // Notifica l'UI che i dati del giocatore sono stati aggiornati
    const uiSystem = networkSystem.getUiSystem();
    if (uiSystem && typeof uiSystem.updatePlayerData === 'function') {
      uiSystem.updatePlayerData({
        inventory: message.inventory,
        upgrades: message.upgrades,
        quests: message.quests
      });
    }

    // INIZIALIZZA IL COMPONENTE ECS SKILLPOINTS (necessario per SkillsPanel)
    if (networkSystem.getPlayerSystem() && message.inventory) {
      const playerEntity = networkSystem.getPlayerSystem()?.getPlayerEntity();
      if (playerEntity) {
        const skillPointsComponent = networkSystem.getECS().getComponent(playerEntity, SkillPoints);
        if (skillPointsComponent) {
          // Inizializza i punti abilità ricevuti dal server
          skillPointsComponent.setPoints(message.inventory.skillPoints || 0);
          console.log(`🎯 [INIT] Initialized ECS SkillPoints component: ${message.inventory.skillPoints || 0}`);
        }
      }
    }

    // Notifica gli altri sistemi che potrebbero aver bisogno di questi dati
    const economySystem = networkSystem.getEconomySystem();
    if (economySystem && typeof economySystem.updatePlayerInventory === 'function') {
      economySystem.updatePlayerInventory(message.inventory);
    }

    console.log('✅ [PLAYER_DATA] Player data synchronization completed');
  }
}