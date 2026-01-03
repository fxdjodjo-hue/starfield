import { System as BaseSystem } from '../infrastructure/ecs/System';
import { ECS } from '../infrastructure/ecs/ECS';
import { Health } from '../entities/combat/Health';
import { Explosion } from '../entities/combat/Explosion';
import { Npc } from '../entities/ai/Npc';
import { PlayerStats } from '../entities/PlayerStats';
import { getNpcDefinition } from '../config/NpcConfig';
import { LogSystem } from './rendering/LogSystem';
import { NpcRespawnSystem } from './NpcRespawnSystem';
import { QuestTrackingSystem } from './QuestTrackingSystem';
import { ActiveQuest } from '../entities/quest/ActiveQuest';
import { Component } from '../infrastructure/ecs/Component';

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

    // Notifica il sistema quest per aggiornare il progresso
    if (this.questTrackingSystem && this.playerEntity) {
      const activeQuest = this.ecs.getComponent(this.playerEntity, ActiveQuest);
      if (activeQuest) {
        this.questTrackingSystem.onNpcKilled(npc.npcType, activeQuest);
      }
    }

    if (npcDef.rewards.experience > 0) {
      this.economySystem.addExperience(npcDef.rewards.experience, `defeated ${npc.npcType}`);
    }

    if (npcDef.rewards.honor > 0) {
      this.economySystem.addHonor(npcDef.rewards.honor, `defeated ${npc.npcType}`);
    }

    // Log delle ricompense guadagnate
    if (this.logSystem) {
      this.logSystem.logReward(
        npcDef.rewards.credits,
        npcDef.rewards.cosmos,
        npcDef.rewards.experience,
        npcDef.rewards.honor
      );
    }

    // Log dell'NPC ucciso
    if (this.logSystem) {
      this.logSystem.logNpcKilled(npc.npcType);
    }

    // Pianifica il respawn dell'NPC morto
    if (this.respawnSystem) {
      this.respawnSystem.scheduleRespawn(npc.npcType, Date.now());
    }

    // Marca l'NPC come processato per le ricompense (verrà rimosso dall'ExplosionSystem)
    this.ecs.addComponent(npcEntity, RewardProcessed, new RewardProcessed());
  }
}
