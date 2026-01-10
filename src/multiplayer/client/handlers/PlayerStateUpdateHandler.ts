import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import type { PlayerStateUpdateMessage } from '../../../config/NetworkConfig';
import { PlayerUpgrades } from '../../../entities/player/PlayerUpgrades';
import { Health } from '../../../entities/combat/Health';
import { Shield } from '../../../entities/combat/Shield';

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

    // AGGIORNA L'ECONOMY SYSTEM CON STATO COMPLETO (non somme locali)
    const economySystem = networkSystem.getEconomySystem();
    if (economySystem) {
      console.log('💰 [ECONOMY] Applicando stato completo dal server');

      // Imposta direttamente i valori dal server (server authoritative)
      economySystem.setCredits(inventory.credits, 'server_update');
      economySystem.setCosmos(inventory.cosmos, 'server_update');
      economySystem.setExperience(inventory.experience, 'server_update');
      economySystem.setHonor(inventory.honor, 'server_update');
      economySystem.setSkillPoints(inventory.skillPoints, 'server_update');

      console.log('✅ [ECONOMY] Stato EconomySystem sincronizzato con server');
    }

    // SINCRONIZZA GLI UPGRADE DEL PLAYER (Server Authoritative)
    if (upgrades) {
      const playerSystem = networkSystem.getPlayerSystem();
      if (playerSystem) {
        const playerEntity = playerSystem.getPlayerEntity();
        if (playerEntity) {
          // Ottieni il componente PlayerUpgrades
          const playerUpgrades = networkSystem.getECS().getComponent(playerEntity, PlayerUpgrades);

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
            if (typeof health === 'number' && typeof maxHealth === 'number') {
              const healthComponent = networkSystem.getECS().getComponent(playerEntity, Health);
              if (healthComponent) {
                healthComponent.current = health;
                healthComponent.max = maxHealth;
              }
            }

            // Aggiorna Shield component
            if (typeof shield === 'number' && typeof maxShield === 'number') {
              const shieldComponent = networkSystem.getECS().getComponent(playerEntity, Shield);
              if (shieldComponent) {
                shieldComponent.current = shield;
                shieldComponent.max = maxShield;
              }
            }
            }
          }, 100); // Ritardo di 100ms per permettere l'inizializzazione
        } else {
          console.log('❌ [PLAYER_STATE] PlayerUpgrades component non trovato');
          console.log('🔍 [PLAYER_STATE] Player entity:', playerEntity.id);
          // Debug: lista tutti i componenti disponibili
          const ecs = networkSystem.getECS();
          console.log('🔍 [PLAYER_STATE] ECS components disponibili:', Object.keys(ecs.components || {}));
        }
      }
    }

    // Aggiorna il PlayerHUD con i nuovi dati
    const uiSystem = networkSystem.getUiSystem();
    if (uiSystem) {
      const playerHUD = uiSystem.getPlayerHUD();
      if (playerHUD) {
        playerHUD.updateData({
          level: 1, // Per ora fisso, possiamo implementare calcolo livello dopo
          playerId: networkSystem.gameContext.localClientId || 0,
          credits: inventory.credits,
          cosmos: inventory.cosmos,
          experience: inventory.experience,
          expForNextLevel: 1000, // Placeholder, possiamo calcolare dopo
          honor: inventory.honor
        });

    // Forza la visualizzazione dell'HUD se non è già visibile
    playerHUD.show();
    console.log('✅ [HUD] PlayerHUD aggiornato con stato server');

    // Aggiorna anche il pannello Skills per riflettere i valori reali
    const skillsPanel = uiSystem.getSkillsPanel();
    if (skillsPanel) {
      skillsPanel.updatePlayerStats();
      console.log('✅ [SKILLS] SkillsPanel aggiornato con valori server authoritative');
    }
      }
    }

    // Mostra notifica delle ricompense guadagnate (se presente)
    if (rewardsEarned) {
      // Chiama il RewardSystem per assegnare le ricompense e aggiornare le quest
      const rewardSystem = networkSystem.getRewardSystem();
      if (rewardSystem && rewardsEarned.npcType) {
        console.log(`🎯 [REWARDS] Assegnando ricompense dal server per ${rewardsEarned.npcType}`);
        rewardSystem.assignRewardsFromServer({
          credits: rewardsEarned.credits,
          cosmos: rewardsEarned.cosmos,
          experience: rewardsEarned.experience,
          honor: rewardsEarned.honor
        }, rewardsEarned.npcType);
      }

      const logSystem = networkSystem.getLogSystem();
      if (logSystem) {
        logSystem.logReward(
          rewardsEarned.credits,
          rewardsEarned.cosmos,
          rewardsEarned.experience,
          rewardsEarned.honor,
          rewardsEarned.skillPoints || 0
        );
      }

      console.log(`🎁 Ricompense guadagnate! ${rewardsEarned.credits} credits, ${rewardsEarned.cosmos} cosmos, ${rewardsEarned.experience} XP, ${rewardsEarned.honor} honor, ${rewardsEarned.skillPoints} skillPoints`);
    }

    console.log(`📊 Nuovo stato inventario: ${inventory.credits} credits, ${inventory.cosmos} cosmos, ${inventory.experience} XP, ${inventory.honor} honor, ${inventory.skillPoints} skillPoints`);
  }
}
