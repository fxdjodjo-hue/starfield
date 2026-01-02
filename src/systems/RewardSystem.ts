import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { Health } from '/src/entities/combat/Health';
import { Npc } from '/src/entities/ai/Npc';
import { PlayerStats } from '/src/entities/PlayerStats';
import { getNpcDefinition } from '/src/config/NpcConfig';

/**
 * Sistema Reward - gestisce l'assegnazione di ricompense quando gli NPC vengono sconfitti
 * Segue il principio di Single Responsibility: solo ricompense, niente combattimento
 */
export class RewardSystem extends BaseSystem {
  private economySystem: any = null;
  private playerEntity: any = null;

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

  update(deltaTime: number): void {
    if (!this.economySystem) return;

    // Trova tutti gli NPC morti che non sono ancora stati processati
    const deadNpcs = this.ecs.getEntitiesWithComponents(Npc, Health).filter(entity => {
      const health = this.ecs.getComponent(entity, Health);
      return health && health.isDead();
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
      console.warn(`No reward definition found for NPC type: ${npc.npcType}`);
      return;
    }

    console.log(`🎉 NPC defeated: ${npc.nickname} (${npc.npcType})`);

    // Incrementa contatore kills del player
    if (this.playerEntity) {
      const playerStats = this.ecs.getComponent(this.playerEntity, PlayerStats);
      if (playerStats) {
        playerStats.addKill();
        console.log(`⚔️ Kill counter: ${playerStats.kills}`);
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

    console.log(`💰 Rewards: ${npcDef.rewards.credits} CR, ${npcDef.rewards.cosmos} CO, ${npcDef.rewards.experience} XP, ${npcDef.rewards.honor} HN`);
  }
}
