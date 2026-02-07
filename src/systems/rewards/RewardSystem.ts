import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { EconomySystem } from '../economy/EconomySystem';
import { PlayState } from '../../game/states/PlayState';
import { PlayerStats } from '../../entities/player/PlayerStats';
import { LogSystem } from '../rendering/LogSystem';
import { LogType } from '../../presentation/ui/LogMessage';
import { QuestEventType } from '../../config/QuestConfig';
import { QuestTrackingSystem } from '../quest/QuestTrackingSystem';
import { ITEM_REGISTRY } from '../../config/ItemConfig';
import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente per marcare NPC già processati per le ricompense
 */


/**
 * Sistema Reward - gestisce l'assegnazione di ricompense quando gli NPC vengono sconfitti
 * Segue il principio di Single Responsibility: solo ricompense, niente combattimento
 */
export class RewardSystem extends BaseSystem {
  private economySystem: EconomySystem | null = null;
  private playerEntity: Entity | null = null;
  private logSystem: LogSystem | null = null;
  private questTrackingSystem: QuestTrackingSystem | null = null;
  private playState: PlayState | null = null; // Reference to PlayState for saving

  constructor(ecs: ECS, playState?: PlayState) {
    super(ecs);
    this.playState = playState || null;
  }

  /**
   * Imposta il riferimento all'EconomySystem per assegnare ricompense
   */
  setEconomySystem(economySystem: EconomySystem): void {
    this.economySystem = economySystem;
  }

  /**
   * Imposta l'entità player per aggiornare le statistiche
   */
  setPlayerEntity(playerEntity: Entity): void {
    this.playerEntity = playerEntity;
  }

  /**
   * Imposta il riferimento al LogSystem per logging delle ricompense
   */
  setLogSystem(logSystem: LogSystem): void {
    this.logSystem = logSystem;
  }


  /**
   * Imposta il riferimento al QuestTrackingSystem per aggiornare le quest
   */
  setQuestTrackingSystem(questTrackingSystem: QuestTrackingSystem): void {
    this.questTrackingSystem = questTrackingSystem;
  }

  update(deltaTime: number): void {
    // MMO ARCHITECTURE: Rewards are exclusively handled by the server
    // via assignRewardsFromServer(). Local entity processing is disabled
    // to strictly enforce server authority and correct drop rates.
  }

  /**
   * Assegna ricompense ricevute dal server quando un NPC viene ucciso
   * NOTA: Le ricompense economiche sono già state aggiunte dal server all'inventario
   * e sincronizzate tramite player_state_update. Questo metodo gestisce solo:
   * - Statistiche (kills)
   * - Quest tracking
   * - Logging
   * - Salvataggio stato
   */
  assignRewardsFromServer(rewards: { credits: number; cosmos: number; experience: number; honor: number; droppedItems?: any[] }, npcType: string): void {
    if (!this.economySystem) {
      console.warn('[RewardSystem] EconomySystem not available for server rewards');
      return;
    }

    // Incrementa contatore kills del player
    if (this.playerEntity) {
      const playerStats = this.ecs.getComponent(this.playerEntity, PlayerStats);
      if (playerStats) {
        playerStats.addKill();
      }
    }

    // NON aggiungere ricompense economiche qui - sono già state aggiunte dal server
    // e sincronizzate tramite player_state_update che imposta i valori totali
    // Le ricompense economiche vengono gestite direttamente dal server e sincronizzate
    // tramite EconomySystem.setCredits/setCosmos/setExperience/setHonor in PlayerStateUpdateHandler

    // Log unificato dell'NPC sconfitto con ricompense
    if (this.logSystem) {
      this.logSystem.logNpcDefeatWithRewards(
        npcType,
        rewards.credits,
        rewards.cosmos,
        rewards.experience,
        rewards.honor
      );
    }

    // Notifica il sistema missioni per aggiornare il progresso
    if (this.questTrackingSystem && this.questTrackingSystem.hasPlayer()) {
      const event = {
        type: QuestEventType.NPC_KILLED,
        targetId: npcType,
        targetType: npcType.toLowerCase(),
        amount: 1
      };
      this.questTrackingSystem.triggerEvent(event);
    } else if (this.questTrackingSystem && !this.questTrackingSystem.hasPlayer()) {
      console.warn(`⚠️ [MISSION] QuestTrackingSystem has no playerEntity yet - skipping mission update for ${npcType}`);
    }

    // 🚀 Gestione Item Drops ricevuti dal server
    if (this.playerEntity && rewards.droppedItems && Array.isArray(rewards.droppedItems)) {
      for (const itemData of rewards.droppedItems) {
        const item = ITEM_REGISTRY[itemData.id];
        if (item) {
          if (this.logSystem) {
            // Determina il LogType basato sulla rarità
            let logType = LogType.GIFT;
            const rarity = (item.rarity || 'COMMON').toUpperCase();

            if (rarity === 'COMMON') logType = LogType.RARITY_COMMON;
            else if (rarity === 'UNCOMMON') logType = LogType.RARITY_UNCOMMON;
            else if (rarity === 'RARE') logType = LogType.RARITY_RARE;
            else if (rarity === 'EPIC') logType = LogType.RARITY_EPIC;

            this.logSystem.addLogMessage(`DROPPED: ${item.name}! [${rarity}]`, logType, 5000);
          }
          // console.log(`[RewardSystem] Item dropped from server: ${itemData.id} (${itemData.instanceId})`);
        }
      }
    }
  }


}
