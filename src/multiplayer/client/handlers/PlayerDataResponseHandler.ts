import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { PlayerDataResponseMessage } from '../../../config/NetworkConfig';
import { SkillPoints } from '../../../entities/currency/SkillPoints';
import { PlayerUpgrades } from '../../../entities/player/PlayerUpgrades';
import { Health } from '../../../entities/combat/Health';
import { Shield } from '../../../entities/combat/Shield';
import { getPlayerDefinition } from '../../../config/PlayerConfig';

/**
 * Handles player data response messages from the server
 * Updates the client's player data with complete inventory, upgrades, and quests
 */
export class PlayerDataResponseHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PLAYER_DATA_RESPONSE);
  }

  handle(message: PlayerDataResponseMessage, networkSystem: ClientNetworkSystem): void {
    console.log(`[DEBUG_RECEIVE] CLIENT received player_data_response - experience: ${message.inventory?.experience}, honor: ${message.inventory?.honor}`);

    // Aggiorna i dati del giocatore nel game context
    if (networkSystem.gameContext) {
      // Aggiorna inventory
      if (message.inventory) {
        networkSystem.gameContext.playerInventory = message.inventory;
      }

      // Aggiorna upgrades
      if (message.upgrades) {
        networkSystem.gameContext.playerUpgrades = message.upgrades;
      }

      // Aggiorna quests
      if (message.quests) {
        networkSystem.gameContext.playerQuests = message.quests;
      }
    }

    // AGGIORNA ECONOMY SYSTEM CON DATI DAL DATABASE (server authoritative)
    const economySystem = networkSystem.getEconomySystem();
    if (economySystem && message.inventory) {
      console.log(`[DEBUG_ECONOMY] PlayerDataResponseHandler calling EconomySystem.setExperience(${message.inventory.experience})`);
      economySystem.setExperience(message.inventory.experience, 'server_update');
      economySystem.setCredits(message.inventory.credits, 'server_update');
      economySystem.setCosmos(message.inventory.cosmos, 'server_update');
      economySystem.setHonor(message.inventory.honor, 'server_update');
      economySystem.setSkillPoints(message.inventory.skillPoints, 'server_update');

      // ✅ L'ECONOMY SYSTEM TRIGGERA AUTOMATICAMENTE onExperienceChanged -> UiSystem.updatePlayerData
    } else {
      console.log(`[DEBUG_ECONOMY] ERROR: EconomySystem not available in PlayerDataResponseHandler`);
    }

    // ✅ L'ECONOMY SYSTEM TRIGGERA AUTOMATICAMENTE onExperienceChanged -> UiSystem.updatePlayerData

    // INIZIALIZZA IL COMPONENTE ECS SKILLPOINTS (necessario per SkillsPanel)
    if (networkSystem.getPlayerSystem() && message.inventory) {
      const playerEntity = networkSystem.getPlayerSystem()?.getPlayerEntity();
      if (playerEntity) {
        const skillPointsComponent = networkSystem.getECS().getComponent(playerEntity, SkillPoints);
        if (skillPointsComponent) {
          // Inizializza i punti abilità ricevuti dal server
          skillPointsComponent.setPoints(message.inventory.skillPoints || 0);
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
            message.upgrades.damageUpgrades || 0
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

    // Gli altri sistemi vengono aggiornati sopra con i dati economici
  }
}