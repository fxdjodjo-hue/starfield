import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import type { PlayerStateUpdateMessage } from '../../../config/NetworkConfig';
import { PlayerUpgrades } from '../../../entities/player/PlayerUpgrades';
import { Health } from '../../../entities/combat/Health';
import { Shield } from '../../../entities/combat/Shield';
import { SkillPoints } from '../../../entities/currency/SkillPoints';

/**
 * Gestisce gli aggiornamenti completi dello stato del giocatore dal server
 * (Server Authoritative - il server è l'unica fonte di verità)
 */
export class PlayerStateUpdateHandler extends BaseMessageHandler {
  constructor() {
    super('player_state_update');
  }


  handle(message: PlayerStateUpdateMessage, networkSystem: ClientNetworkSystem): void {
    const { inventory, upgrades, health, maxHealth, shield, maxShield, source, rewardsEarned } = message;

    // AGGIORNA IL GAME CONTEXT CON STATO COMPLETO (server authoritative)
    if (networkSystem.gameContext) {
      // Aggiorna inventory nel GameContext
      networkSystem.gameContext.playerInventory = {
        credits: inventory.credits,
        cosmos: inventory.cosmos,
        experience: inventory.experience,
        honor: inventory.honor,
        skillPoints: inventory.skillPoints
      };
    }

    // AGGIORNA L'ECONOMY SYSTEM CON STATO COMPLETO (server authoritative)
    const economySystem = networkSystem.getEconomySystem();
    if (economySystem && inventory) {
      // Imposta direttamente i valori dal server (server authoritative)
      economySystem.setCredits(inventory.credits, 'server_update');
      economySystem.setCosmos(inventory.cosmos, 'server_update');
      economySystem.setExperience(inventory.experience, 'server_update');
      economySystem.setHonor(inventory.honor, 'server_update');
      economySystem.setSkillPoints(inventory.skillPoints, 'server_update');
    }

    // AGGIORNA IL COMPONENTE ECS SKILLPOINTS (dopo EconomySystem per coerenza)
    const playerSystem = networkSystem.getPlayerSystem();
    const ecs = networkSystem.getECS();
    if (playerSystem && ecs) {
      const playerEntity = playerSystem.getPlayerEntity();
      if (playerEntity) {
        const skillPointsComponent = ecs.getComponent(playerEntity, SkillPoints);
        if (skillPointsComponent) {
          // Imposta direttamente i punti abilità ricevuti dal server
          skillPointsComponent.setPoints(inventory.skillPoints);
        }
      }
    }

    // SINCRONIZZA GLI UPGRADE DEL PLAYER (Server Authoritative)
    if (upgrades) {
      const playerSystem = networkSystem.getPlayerSystem();
      if (playerSystem) {
        const playerEntity = playerSystem.getPlayerEntity();
        if (playerEntity && networkSystem.getECS()) {
          // Ottieni il componente PlayerUpgrades
          const ecs = networkSystem.getECS();
          const playerUpgrades = ecs?.getComponent(playerEntity, PlayerUpgrades);

          if (playerUpgrades) {
            playerUpgrades.setUpgrades(upgrades.hpUpgrades, upgrades.shieldUpgrades, upgrades.speedUpgrades, upgrades.damageUpgrades);

            // Resetta tutti gli upgrade in progress dato che abbiamo ricevuto una risposta dal server
            networkSystem.resetAllUpgradeProgress();

          }

          // Aggiorna componenti Health e Shield con valori server authoritative
          // Ritardiamo leggermente per assicurarci che i componenti siano stati aggiunti
          setTimeout(() => {
            if (playerEntity) {

            // Aggiorna Health component
            if (typeof health === 'number' && typeof maxHealth === 'number' && ecs) {
              const healthComponent = ecs.getComponent(playerEntity, Health);
              if (healthComponent) {
                healthComponent.current = health;
                healthComponent.max = maxHealth;
              }
            }

            // Aggiorna Shield component
            if (typeof shield === 'number' && typeof maxShield === 'number' && ecs) {
              const shieldComponent = ecs.getComponent(playerEntity, Shield);
              if (shieldComponent) {
                shieldComponent.current = shield;
                shieldComponent.max = maxShield;
              }
            }
            }
          }, 100); // Ritardo di 100ms per permettere l'inizializzazione
        }
      }
    }

    // Ottieni riferimento all'UiSystem per aggiornamenti successivi
    const uiSystem = networkSystem.getUiSystem();

    // Mostra notifica delle ricompense guadagnate (se presente)
    if (rewardsEarned) {
      // Chiama il RewardSystem per assegnare le ricompense e aggiornare le quest
      const rewardSystem = networkSystem.getRewardSystem();
      if (rewardSystem && rewardsEarned.npcType) {
        rewardSystem.assignRewardsFromServer({
          credits: rewardsEarned.credits,
          cosmos: rewardsEarned.cosmos || 0,
          experience: rewardsEarned.experience,
          honor: rewardsEarned.honor
        }, rewardsEarned.npcType);
      }

      const logSystem = networkSystem.getLogSystem();
      if (logSystem) {
        logSystem.logReward(
          rewardsEarned.credits,
          rewardsEarned.cosmos || 0,
          rewardsEarned.experience,
          rewardsEarned.honor,
          rewardsEarned.skillPoints || 0
        );
      }
    }

    // 🔄 AGGIORNA L'HUD IN TEMPO REALE DOPO TUTTI GLI AGGIORNAMENTI
    if (uiSystem) {
      // L'UiSystem aggiornerà automaticamente l'HUD tramite i suoi meccanismi interni

      // Aggiorna anche il pannello Skills per riflettere i valori reali
      const skillsPanel = uiSystem.getSkillsPanel();
      if (skillsPanel) {
        // Assicurati che abbia il riferimento al PlayerSystem
        const playerSystem = networkSystem.getPlayerSystem();
        if (playerSystem) {
          skillsPanel.setPlayerSystem(playerSystem);
        }
        skillsPanel.updatePlayerStats();
      }

      // Aggiorna l'HUD in tempo reale
      setTimeout(() => {
        uiSystem.showPlayerInfo();
      }, 50); // Delay ridotto per permettere all'EconomySystem di aggiornarsi
    }
  }
}
