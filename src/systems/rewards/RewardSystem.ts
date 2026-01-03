import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Health } from '../../entities/combat/Health';
import { Explosion } from '../../entities/combat/Explosion';
import { Npc } from '../../entities/ai/Npc';
import { PlayerStats } from '../../entities/player/PlayerStats';
import { getNpcDefinition } from '../../config/NpcConfig';
import { LogSystem } from '../rendering/LogSystem';
import { LogType } from '../../presentation/ui/LogMessage';
import { NpcRespawnSystem } from '../npc/NpcRespawnSystem';
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
  private respawnSystem: NpcRespawnSystem | null = null;
  private questTrackingSystem: QuestTrackingSystem | null = null;

  constructor(ecs: ECS) {
    super(ecs);
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
   * Imposta il riferimento al RespawnSystem per la rigenerazione degli NPC
   */
  setRespawnSystem(respawnSystem: NpcRespawnSystem): void {
    this.respawnSystem = respawnSystem;
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

    // Pianifica il respawn dell'NPC morto
    if (this.respawnSystem) {
      this.respawnSystem.scheduleRespawn(npc.npcType, Date.now());
    }

    // Marca l'NPC come processato per le ricompense (verrà rimosso dall'ExplosionSystem)
    this.ecs.addComponent(npcEntity, RewardProcessed, new RewardProcessed());
  }
}
