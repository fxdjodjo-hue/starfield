import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import type { PlayerStateUpdateMessage } from '../../../config/NetworkConfig';
import { PlayerUpgrades } from '../../../entities/player/PlayerUpgrades';
import { Health } from '../../../entities/combat/Health';
import { Shield } from '../../../entities/combat/Shield';
import { DamageText } from '../../../entities/combat/DamageText';

/**
 * Gestisce gli aggiornamenti completi dello stato del giocatore dal server
 * (Server Authoritative - il server è l'unica fonte di verità)
 */
export class PlayerStateUpdateHandler extends BaseMessageHandler {
  constructor() {
    super('player_state_update');
  }


  handle(message: PlayerStateUpdateMessage, networkSystem: ClientNetworkSystem): void {
    const { inventory, upgrades, health, maxHealth, shield, maxShield, source, rewardsEarned, recentHonor, healthRepaired, shieldRepaired } = message;

    // AGGIORNA IL GAME CONTEXT CON STATO COMPLETO (server authoritative)
    // Nota: inventory può essere undefined per messaggi di riparazione che aggiornano solo HP/shield
    if (networkSystem.gameContext && inventory) {
      // Aggiorna inventory nel GameContext
      networkSystem.gameContext.playerInventory = {
        credits: inventory.credits,
        cosmos: inventory.cosmos,
        experience: inventory.experience,
        honor: inventory.honor,
        recentHonor: recentHonor // Includi RecentHonor se disponibile
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

      // Aggiorna RecentHonor in RankSystem se disponibile
      if (recentHonor !== undefined) {
        economySystem.setRecentHonor(recentHonor);
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
            playerUpgrades.setUpgrades(
              upgrades.hpUpgrades,
              upgrades.shieldUpgrades,
              upgrades.speedUpgrades,
              upgrades.damageUpgrades,
              upgrades.missileDamageUpgrades
            );

            // Resetta tutti gli upgrade in progress dato che abbiamo ricevuto una risposta dal server
            networkSystem.resetAllUpgradeProgress();

          }

          // Aggiorna componenti Health e Shield con valori server authoritative
          // Aggiorna immediatamente senza setTimeout per riparazioni in tempo reale
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
        }
      }
    }

    // Aggiorna Health e Shield anche se non ci sono upgrades (per messaggi di riparazione)
    // Questo è importante perché i messaggi di riparazione inviano solo health/shield senza upgrades
    if ((typeof health === 'number' || typeof shield === 'number')) {
      const playerSystem = networkSystem.getPlayerSystem();
      const ecs = networkSystem.getECS();
      if (playerSystem && ecs) {
        const playerEntity = playerSystem.getPlayerEntity();
        if (playerEntity) {
          // Aggiorna Health component
          if (typeof health === 'number' && typeof maxHealth === 'number') {
            const healthComponent = ecs.getComponent(playerEntity, Health);
            if (healthComponent) {
              healthComponent.current = health;
              healthComponent.max = maxHealth;
            }
          }

          // Aggiorna Shield component
          if (typeof shield === 'number' && typeof maxShield === 'number') {
            const shieldComponent = ecs.getComponent(playerEntity, Shield);
            if (shieldComponent) {
              shieldComponent.current = shield;
              shieldComponent.max = maxShield;
            }
          }
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
          rewardsEarned.honor
        );
      }
    }

    // 🔄 AGGIORNA L'HUD IN TEMPO REALE DOPO TUTTI GLI AGGIORNAMENTI
    // Questo è importante per aggiornare le barre HP/shield quando arrivano messaggi di riparazione
    if (uiSystem) {
      // Aggiorna anche il pannello Upgrade per riflettere i valori reali (solo se ci sono upgrades)
      if (upgrades) {
        const upgradePanel = uiSystem.getUpgradePanel();
        if (upgradePanel) {
          // Assicurati che abbia il riferimento al PlayerSystem
          const playerSystem = networkSystem.getPlayerSystem();
          if (playerSystem) {
            upgradePanel.setPlayerSystem(playerSystem);
          }
          upgradePanel.updatePlayerStats();
        }
      }

      // Aggiorna l'HUD in tempo reale (sempre, anche per messaggi di riparazione)
      uiSystem.showPlayerInfo();
    }

    // Forza aggiornamento immediato di PlayerStatusDisplaySystem per messaggi di riparazione
    // (aggiorna HP/shield barre senza aspettare il prossimo UPDATE_INTERVAL)
    if ((typeof health === 'number' || typeof shield === 'number') && !upgrades) {
      const ecs = networkSystem.getECS();
      if (ecs) {
        // Cerca PlayerStatusDisplaySystem nell'ECS
        const systems = ecs.getSystems();
        const playerStatusSystem = systems.find((s: any) => s.constructor.name === 'PlayerStatusDisplaySystem') as any;
        if (playerStatusSystem && typeof playerStatusSystem.updateDisplay === 'function') {
          // Forza aggiornamento immediato del display
          playerStatusSystem.updateDisplay();
        }
      }
    }

    // Crea repair text se ci sono valori riparati (per messaggi di riparazione)
    if ((healthRepaired && healthRepaired > 0) || (shieldRepaired && shieldRepaired > 0)) {
      this.createRepairText(networkSystem, healthRepaired || 0, shieldRepaired || 0);
    }
  }

  /**
   * Crea repair text (simile a damage text ma con colori verdi/azzurri)
   */
  private createRepairText(networkSystem: ClientNetworkSystem, healthRepaired: number, shieldRepaired: number): void {
    const ecs = networkSystem.getECS();
    const playerSystem = networkSystem.getPlayerSystem();
    if (!ecs || !playerSystem) return;

    const playerEntity = playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    // Crea repair text per shield (azzurro, più in alto)
    if (shieldRepaired > 0) {
      const shieldTextEntity = ecs.createEntity();
      const repairText = new DamageText(
        shieldRepaired,
        playerEntity.id,
        (Math.random() - 0.5) * 20, // ±10px offset X
        -30, // Offset Y iniziale
        '#00ccff', // Azzurro per shield repair
        1500 // Lifetime 1.5 secondi
      );
      ecs.addComponent(shieldTextEntity, DamageText, repairText);
    }

    // Crea repair text per HP (verde, più in basso se c'è anche shield)
    if (healthRepaired > 0) {
      const healthTextEntity = ecs.createEntity();
      const repairText = new DamageText(
        healthRepaired,
        playerEntity.id,
        (Math.random() - 0.5) * 20, // ±10px offset X
        shieldRepaired > 0 ? -15 : -30, // Più in basso se c'è anche shield repair
        '#00ff88', // Verde per HP repair
        1500 // Lifetime 1.5 secondi
      );
      ecs.addComponent(healthTextEntity, DamageText, repairText);
    }
  }
}
