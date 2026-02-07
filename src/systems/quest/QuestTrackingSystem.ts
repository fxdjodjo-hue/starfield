import { World } from '../../infrastructure/engine/World';
import { ActiveQuest } from '../../entities/quest/ActiveQuest';
import { QuestManager } from '../../core/domain/quest/QuestManager';
import { LogSystem } from '../rendering/LogSystem';
import { LogType } from '../../presentation/ui/LogMessage';
import { NumberFormatter } from '../../core/utils/ui/NumberFormatter';
import {
  type QuestEvent,
  QuestEventType,
  QuestRegistry,
  ObjectiveType,
  RewardType,
  type QuestEventHandler
} from '../../config/QuestConfig';

/**
 * QuestTrackingSystem - Sistema modulare per tracciare eventi di gioco e aggiornare missioni
 *
 * Caratteristiche principali:
 * - Event-driven architecture per massima scalabilità
 * - Supporto per molteplici tipi di eventi (kill, collect, explore, interact)
 * - Configurazione esterna tramite QuestRegistry
 * - Facile estensione per nuovi tipi di missione
 * - Single source of truth per la logica di tracking
 */
export class QuestTrackingSystem implements QuestEventHandler {
  private economySystem: any = null;
  private logSystem: LogSystem | null = null;
  private playerEntity: any = null;
  private playState: any = null; // Reference to PlayState for saving

  private world: World;
  private questManager: QuestManager;

  constructor(world: World, questManager: QuestManager, playState?: any) {
    this.world = world;
    this.questManager = questManager;
    this.playState = playState;
  }

  /**
   * Imposta il riferimento all'EconomySystem per assegnare ricompense
   */
  setEconomySystem(economySystem: any): void {
    this.economySystem = economySystem;
  }

  /**
   * Imposta il riferimento al LogSystem per mostrare messaggi
   */
  setLogSystem(logSystem: LogSystem): void {
    this.logSystem = logSystem;
  }

  /**
   * Verifica se l'entità player è impostata
   */
  hasPlayer(): boolean {
    return this.playerEntity !== null;
  }

  /**
   * Imposta il riferimento l'entità player
   */
  setPlayerEntity(playerEntity: any): void {
    this.playerEntity = playerEntity;
  }

  /**
   * Gestisce un evento di missione in modo modulare con consumo sequenziale dell'ammontare.
   * Questo assicura che un singolo evento non conti per più missioni contemporaneamente
   * a meno che non ci sia una quantità residua.
   */
  handleEvent(event: QuestEvent, activeQuestComponent: ActiveQuest): void {
    let remainingAmount = event.amount || 1;

    // Trova tutte le missioni attive che potrebbero essere interessate da questo evento
    // Usiamo un ciclo for tradizionale per poter interrompere quando l'ammontare è esaurito
    const activeQuests = activeQuestComponent.getActiveQuests();

    for (const quest of activeQuests) {
      if (remainingAmount <= 0) break;

      const questConfig = QuestRegistry.get(quest.id);
      if (!questConfig) continue;

      // Controlla ogni obiettivo della missione
      for (const objective of quest.objectives) {
        if (remainingAmount <= 0) break;

        if (this.shouldUpdateObjective(objective, event)) {
          // SERVER-AUTHORITATIVE: Local progress update DISABLED.
          // The server will send QuestProgressUpdate messages.
          // const result = this.questManager.updateQuestProgress(
          //   quest.id,
          //   objective.id,
          //   activeQuestComponent,
          //   remainingAmount
          // );

          // Only for visual feedback prediction (optional, skipping for now to be strictly authoritative)
          const result = { completed: false, consumed: 0 };

          // remainingAmount -= result.consumed;

          // Notifica la UI che i dati delle missioni sono cambiati
          if (typeof document !== 'undefined' && result.consumed > 0) {
            document.dispatchEvent(new CustomEvent('requestQuestDataUpdate'));
          }

          if (result.completed) {
            this.handleQuestCompletion(quest, activeQuestComponent);
          }
        }
      }
    }
  }

  /**
   * Determina se un obiettivo dovrebbe essere aggiornato per un dato evento
   * Questa logica è completamente configurabile tramite QuestRegistry
   */
  private shouldUpdateObjective(objective: any, event: QuestEvent): boolean {
    const amount = event.amount || 1;

    switch (objective.type) {
      case ObjectiveType.KILL:
        return event.type === QuestEventType.NPC_KILLED &&
          event.targetType?.toLowerCase() === objective.targetType?.toLowerCase() &&
          amount > 0;

      case ObjectiveType.COLLECT:
        return event.type === QuestEventType.ITEM_COLLECTED &&
          event.targetId === objective.targetName &&
          amount > 0;

      case ObjectiveType.EXPLORE:
        return event.type === QuestEventType.LOCATION_VISITED &&
          event.targetId === objective.targetName;

      case ObjectiveType.INTERACT:
        return event.type === QuestEventType.INTERACTION_COMPLETED &&
          event.targetId === objective.targetName;

      default:
        return false;
    }
  }

  /**
   * Gestisce il completamento di una missione
   */
  private handleQuestCompletion(quest: any, activeQuestComponent: ActiveQuest): void {
    // Completa la missione e ottieni le ricompense
    const rewards = this.questManager.completeQuest(quest.id, activeQuestComponent);

    // Calcola la stringa delle ricompense per il log unificato
    let rewardString = '';
    if (rewards && rewards.length > 0) {
      const rewardLines: string[] = [];
      const totalCredits = rewards.filter(r => r.type === RewardType.CREDITS).reduce((sum, r) => sum + (r.amount || 0), 0);
      const totalCosmos = rewards.filter(r => r.type === RewardType.COSMOS).reduce((sum, r) => sum + (r.amount || 0), 0);
      const totalExperience = rewards.filter(r => r.type === RewardType.EXPERIENCE).reduce((sum, r) => sum + (r.amount || 0), 0);
      const totalHonor = rewards.filter(r => r.type === RewardType.HONOR).reduce((sum, r) => sum + (r.amount || 0), 0);

      const f = (n: number) => NumberFormatter.format(n);
      if (totalCredits > 0) rewardLines.push(`${f(totalCredits)} Credits`);
      if (totalCosmos > 0) rewardLines.push(`${f(totalCosmos)} Cosmos`);
      if (totalExperience > 0) rewardLines.push(`${f(totalExperience)} Experience`);
      if (totalHonor > 0) rewardLines.push(`${f(totalHonor)} Honor`);

      if (rewardLines.length > 0) {
        rewardString = `Rewards: ${rewardLines.join(', ')}`;
      }
    }

    // Mostra messaggio di completamento missione unificato nel log
    if (this.logSystem) {
      this.logSystem.logMissionCompletion(quest.title, rewardString);
    }

    if (rewards) {
      this.applyQuestRewards(rewards, false); // Pass false to avoid second reward log
    }
  }

  /**
   * Applica le ricompense della missione completata.
   * NOTA: In multiplayer, i premi economici (Credits, Cosmos, XP, Honor) 
   * sono ora gestiti in modo autoritario dal server.
   */
  private applyQuestRewards(rewards: any[], showLog: boolean = true): void {
    if (!this.economySystem) {
      console.warn('EconomySystem not set in QuestTrackingSystem');
      return;
    }

    let totalCredits = 0;
    let totalCosmos = 0;
    let totalExperience = 0;
    let totalHonor = 0;

    rewards.forEach(reward => {
      const amount = reward.amount || 0;
      switch (reward.type) {
        case RewardType.CREDITS:
          totalCredits += amount;
          // IMMO-AUTHORITATIVE: Non aggiungere più localmente, il server invierà un player_state_update
          // this.economySystem.addCredits(amount, 'mission reward');
          break;

        case RewardType.COSMOS:
          totalCosmos += amount;
          // IMMO-AUTHORITATIVE: Non aggiungere più localmente
          // this.economySystem.addCosmos(amount, 'mission reward');
          break;

        case RewardType.EXPERIENCE:
          totalExperience += amount;
          // XP e Honor sono tipicamente gestiti dal server, ma l'EconomySystem locale
          // può aggiornarsi tramite l'update di stato.
          break;

        case RewardType.HONOR:
          totalHonor += amount;
          break;

        case RewardType.ITEM:
          // TODO: Implementare item rewards se necessario (già gestite dal server per i drop NPC)
          break;

        default:
          break;
      }
    });

    // Mostra le ricompense nel log se richiesto (anche se non ancora applicate localmente)
    if (showLog && this.logSystem && (totalCredits > 0 || totalCosmos > 0 || totalExperience > 0 || totalHonor > 0)) {
      this.logSystem.logReward(totalCredits, totalCosmos, totalExperience, totalHonor, 4000);
    }
  }

  /**
   * Innesca un evento di missione manualmente (per test o eventi speciali)
   * Metodo pubblico per triggerare eventi programmaticamente
   */
  triggerEvent(event: QuestEvent): void {
    if (!this.playerEntity) {
      return;
    }

    const activeQuest = this.world.getECS().getComponent(this.playerEntity, ActiveQuest);
    if (activeQuest) {
      this.handleEvent(event, activeQuest);
    }
  }

  /**
   * Metodo legacy per retrocompatibilità - sarà rimosso in futuro
   * @deprecated Usa triggerEvent() con QuestEvent invece
   */
  onNpcKilled(npcType: string, activeQuestComponent: ActiveQuest): void {
    // Converte la chiamata legacy in un evento moderno
    const event: QuestEvent = {
      type: QuestEventType.NPC_KILLED,
      targetId: npcType,
      targetType: npcType.toLowerCase(),
      amount: 1
    };

    this.handleEvent(event, activeQuestComponent);
  }

  /**
   * Valida che una missione sia ancora valida (non scaduta, prerequisiti soddisfatti, ecc.)
   */
  validateQuest(questId: string, playerLevel: number, completedQuestIds: string[]): boolean {
    const config = QuestRegistry.get(questId);
    if (!config) return false;

    // Controllo livello
    if (config.levelRequirement && playerLevel < config.levelRequirement) {
      return false;
    }

    // Controllo prerequisiti
    if (!QuestRegistry.hasPrerequisites(config, completedQuestIds)) {
      return false;
    }

    // Altri controlli futuri (tempo, stato del mondo, ecc.)
    return true;
  }

  /**
   * Ottiene suggerimenti per missioni disponibili per il giocatore
   */
  getQuestSuggestions(playerLevel: number, completedQuestIds: string[]): string[] {
    const availableQuests = QuestRegistry.getAvailableForLevel(playerLevel)
      .filter(config => QuestRegistry.hasPrerequisites(config, completedQuestIds))
      .filter(config => !completedQuestIds.includes(config.id))
      .map(config => config.id);

    return availableQuests.slice(0, 3); // Limita a 3 suggerimenti
  }
}
