import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Health } from '../../entities/combat/Health';
import { EconomySystem } from '../economy/EconomySystem';
import { PlayState } from '../../game/states/PlayState';
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
class RewardProcessed extends Component { }

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
    if (!this.economySystem) return;

    // In modalità multiplayer, gli NPC sono gestiti dal server
    // e le ricompense vengono assegnate tramite assignRewardsFromServer
    // Non processare NPC morti localmente per evitare duplicazioni
    if (this.playState && this.playState.isMultiplayer()) {
      // Modalità multiplayer: skip processamento NPC locali
      return;
    }

    // Modalità single-player: processa NPC morti localmente
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
   * NOTA: Le ricompense economiche sono già state aggiunte dal server all'inventario
   * e sincronizzate tramite player_state_update. Questo metodo gestisce solo:
   * - Statistiche (kills)
   * - Quest tracking
   * - Logging
   * - Salvataggio stato
   */
  assignRewardsFromServer(rewards: { credits: number; cosmos: number; experience: number; honor: number }, npcType: string): void {
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

    // Nota: Il respawn degli NPC è gestito lato server
  }

  /**
   * Assegna le ricompense per aver ucciso un NPC
   */
  private assignNpcRewards(npcEntity: Entity): void {
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
    if (this.economySystem) {
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
    }

    // Segnala cambiamento per salvataggio event-driven
    if (this.playState && this.playState.markAsChanged) {
      this.playState.markAsChanged();
      // Logging ridotto per performance
      if (import.meta.env.DEV) {
      }
    }
    // Nota: se playState non è disponibile, il salvataggio non avviene automaticamente
    // ma il gioco continua normalmente

    // Log unificato dell'NPC sconfitto con ricompense
    if (this.logSystem) {
      this.logSystem.logNpcDefeatWithRewards(
        npc.npcType,
        npcDef.rewards.credits,
        npcDef.rewards.cosmos,
        npcDef.rewards.experience,
        npcDef.rewards.honor
      );
    }

    // Notifica il sistema missioni per aggiornare il progresso tramite eventi
    if (this.questTrackingSystem && this.questTrackingSystem.hasPlayer()) {
      const event = {
        type: QuestEventType.NPC_KILLED,
        targetId: npc.npcType,
        targetType: npc.npcType.toLowerCase(),
        amount: 1
      };

      this.questTrackingSystem.triggerEvent(event);
    } else if (this.questTrackingSystem && !this.questTrackingSystem.hasPlayer()) {
      console.warn(`⚠️ [MISSION] QuestTrackingSystem has no playerEntity yet - skipping mission update for ${npc.npcType}`);
    }

    // Nota: Il respawn degli NPC è ora gestito lato server

    // Marca l'NPC come processato per le ricompense (verrà rimosso dall'ExplosionSystem)
    this.ecs.addComponent(npcEntity, RewardProcessed, new RewardProcessed());
  }
}
