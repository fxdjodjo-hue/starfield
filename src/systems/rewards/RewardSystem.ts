import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Health } from '../../entities/combat/Health';
import { Explosion } from '../../entities/combat/Explosion';
import { Npc } from '../../entities/ai/Npc';
import { PlayerStats } from '../../entities/player/PlayerStats';
import { getNpcDefinition } from '../../config/NpcConfig';
import { LogSystem } from '../rendering/LogSystem';
import { LogType } from '../../presentation/ui/LogMessage';
import { QuestEventType } from '../../config/QuestConfig';
import { QuestTrackingSystem } from '../quest/QuestTrackingSystem';
import { ActiveQuest } from '../../entities/quest/ActiveQuest';
import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente per marcare NPC già processati per le ricompense
 */
class RewardProcessed extends Component {}

/**
 * Sistema Reward - gestisce l'assegnazione di ricompense quando gli NPC vengono sconfitti
 * Segue il principio di Single Responsibility: solo ricompense, niente combattimento
 */
export class RewardSystem extends BaseSystem {
  private economySystem: any = null;
  private playerEntity: any = null;
  private logSystem: LogSystem | null = null;
  private questTrackingSystem: QuestTrackingSystem | null = null;
  private playState: any = null; // Reference to PlayState for saving

  constructor(ecs: ECS, playState?: any) {
    super(ecs);
    this.playState = playState;
  }

  /**
   * Imposta il riferimento all'EconomySystem per assegnare ricompense
   */
  setEconomySystem(economySystem: any): void {
    this.economySystem = economySystem;
  }

  /**
   * Imposta l'entità player per aggiornare le statistiche
   */
  setPlayerEntity(playerEntity: any): void {
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
    if (!this.economySystem) return;

    // Trova tutti gli NPC morti che non sono ancora stati processati per le ricompense
    const deadNpcs = this.ecs.getEntitiesWithComponents(Npc, Health).filter((entity: any) => {
      const health = this.ecs.getComponent(entity, Health);
      const alreadyProcessed = this.ecs.hasComponent(entity, RewardProcessed);
      return health && health.isDead() && !alreadyProcessed;
    });

    // Assegna ricompense per ogni NPC morto
    for (const npcEntity of deadNpcs) {
      this.assignNpcRewards(npcEntity);
    }
  }

  /**
   * Assegna ricompense ricevute dal server quando un NPC viene ucciso
   */
  assignRewardsFromServer(rewards: any, npcType: string): void {
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

    // Assegna ricompense economiche ricevute dal server
    if (rewards.credits > 0) {
      this.economySystem.addCredits(rewards.credits, `defeated ${npcType}`);
    }

    if (rewards.cosmos > 0) {
      this.economySystem.addCosmos(rewards.cosmos, `defeated ${npcType}`);
    }

    if (rewards.experience > 0) {
      this.economySystem.addExperience(rewards.experience, `defeated ${npcType}`);
    }

    if (rewards.honor > 0) {
      this.economySystem.addHonor(rewards.honor, `defeated ${npcType}`);
    }

    // Segnala cambiamento per salvataggio event-driven
    if (this.playState && this.playState.markAsChanged) {
      this.playState.markAsChanged();
    }

    // Crea il messaggio dell'NPC sconfitto
    if (this.logSystem) {
      let killMessage = `💀 ${npcType} sconfitto!`;

      // Aggiungi ricompense se presenti
      const rewardParts: string[] = [];
      if (rewards.credits > 0) rewardParts.push(`${rewards.credits} crediti`);
      if (rewards.cosmos > 0) rewardParts.push(`${rewards.cosmos} cosmos`);
      if (rewards.experience > 0) rewardParts.push(`${rewards.experience} XP`);
      if (rewards.honor > 0) rewardParts.push(`${rewards.honor} onore`);

      if (rewardParts.length > 0) {
        killMessage += `\n🎁 Ricompense: ${rewardParts.join(', ')}`;
      }

      this.logSystem.addLogMessage(killMessage, LogType.NPC_KILLED, 4000);
    }

    // Notifica il sistema quest per aggiornare il progresso
    if (this.questTrackingSystem) {
      const event = {
        type: QuestEventType.NPC_KILLED,
        targetId: npcType,
        targetType: npcType.toLowerCase(),
        amount: 1
      };

      this.questTrackingSystem.triggerEvent(event);
    }

    // Pianifica il respawn dell'NPC morto
    if (this.respawnSystem) {
      this.respawnSystem.scheduleRespawn(npcType, Date.now());
    }
  }

  /**
   * Assegna le ricompense per aver ucciso un NPC
   */
  private assignNpcRewards(npcEntity: any): void {
    const npc = this.ecs.getComponent(npcEntity, Npc);
    if (!npc) return;

    const npcDef = getNpcDefinition(npc.npcType);
    if (!npcDef) {
      return;
    }


    // Incrementa contatore kills del player
    if (this.playerEntity) {
      const playerStats = this.ecs.getComponent(this.playerEntity, PlayerStats);
      if (playerStats) {
        playerStats.addKill();
      }
    }

    // Assegna ricompense economiche
    if (npcDef.rewards.credits > 0) {
      this.economySystem.addCredits(npcDef.rewards.credits, `defeated ${npc.npcType}`);
    }

    if (npcDef.rewards.cosmos > 0) {
      this.economySystem.addCosmos(npcDef.rewards.cosmos, `defeated ${npc.npcType}`);
    }

    if (npcDef.rewards.experience > 0) {
      this.economySystem.addExperience(npcDef.rewards.experience, `defeated ${npc.npcType}`);
    }

    if (npcDef.rewards.honor > 0) {
      this.economySystem.addHonor(npcDef.rewards.honor, `defeated ${npc.npcType}`);
    }

    // Segnala cambiamento per salvataggio event-driven
    if (this.playState && this.playState.markAsChanged) {
      this.playState.markAsChanged();
      // Logging ridotto per performance
      if (import.meta.env.DEV) {
        console.log('🎯 [RewardSystem] Ricompensa assegnata - salvataggio pianificato');
      }
    }
    // Nota: se playState non è disponibile, il salvataggio non avviene automaticamente
    // ma il gioco continua normalmente

    // Crea il messaggio dell'NPC sconfitto PRIMA di notificare il quest system
    if (this.logSystem) {
      let killMessage = `💀 ${npc.npcType} sconfitto!`;

      // Aggiungi ricompense se presenti
      const rewardParts: string[] = [];
      if (npcDef.rewards.credits > 0) rewardParts.push(`${npcDef.rewards.credits} crediti`);
      if (npcDef.rewards.cosmos > 0) rewardParts.push(`${npcDef.rewards.cosmos} cosmos`);
      if (npcDef.rewards.experience > 0) rewardParts.push(`${npcDef.rewards.experience} XP`);
      if (npcDef.rewards.honor > 0) rewardParts.push(`${npcDef.rewards.honor} onore`);

      if (rewardParts.length > 0) {
        killMessage += `\n🎁 Ricompense: ${rewardParts.join(', ')}`;
      }

      this.logSystem.addLogMessage(killMessage, LogType.NPC_KILLED, 4000);
    }

    // Notifica il sistema quest per aggiornare il progresso tramite eventi
    if (this.questTrackingSystem) {
      const event = {
        type: QuestEventType.NPC_KILLED,
        targetId: npc.npcType,
        targetType: npc.npcType.toLowerCase(),
        amount: 1
      };

      this.questTrackingSystem.triggerEvent(event);
    }

    // Nota: Il respawn degli NPC è ora gestito lato server

    // Marca l'NPC come processato per le ricompense (verrà rimosso dall'ExplosionSystem)
    this.ecs.addComponent(npcEntity, RewardProcessed, new RewardProcessed());
  }
}
