import { System } from '../infrastructure/ecs/System';
import { ECS } from '../infrastructure/ecs/ECS';
import { ActiveQuest } from '../entities/quest/ActiveQuest';
import { QuestManager } from './QuestManager';
import { QuestPanel } from '../ui/QuestPanel';

/**
 * Sistema di orchestrazione per la gestione delle quest
 * Coordina QuestManager, ActiveQuest component e UI
 */
export class QuestSystem extends System {
  private questManager: QuestManager;
  private questPanel: QuestPanel | null = null;

  constructor(ecs: ECS, questManager: QuestManager) {
    super(ecs);
    this.questManager = questManager;

    // Setup event listeners per l'interazione UI
    this.setupQuestEventListeners();
  }

  /**
   * Imposta i listener per gli eventi delle quest
   */
  private setupQuestEventListeners(): void {
    document.addEventListener('questAccept', (event: any) => {
      const { questId } = event.detail;
      this.handleQuestAcceptance(questId);
    });

    document.addEventListener('questAbandon', (event: any) => {
      const { questId } = event.detail;
      this.handleQuestAbandon(questId);
    });
  }

  /**
   * Gestisce l'accettazione di una quest
   */
  private handleQuestAcceptance(questId: string): void {
    // Trova l'entità player con ActiveQuest
    const entities = this.ecs.getEntitiesWithComponents(ActiveQuest);
    if (entities.size === 0) return;

    const playerEntity = entities.values().next().value;
    const activeQuest = this.ecs.getComponent(playerEntity, ActiveQuest);

    if (this.questManager.isQuestAvailable(questId) && this.questManager.canAcceptQuest(questId)) {
      const accepted = this.questManager.acceptQuest(questId, activeQuest);
      if (accepted) {
        console.log(`🎉 Quest "${questId}" accettata dal giocatore!`);
        this.notifyQuestPanelUpdate();
      } else {
        console.warn(`❌ Impossibile accettare la quest "${questId}" - prerequisiti non soddisfatti`);
      }
    } else {
      console.warn(`❌ Quest "${questId}" non disponibile o prerequisiti non soddisfatti`);
    }
  }

  /**
   * Gestisce l'abbandono di una quest
   */
  private handleQuestAbandon(questId: string): void {
    // Trova l'entità player con ActiveQuest
    const entities = this.ecs.getEntitiesWithComponents(ActiveQuest);
    if (entities.size === 0) return;

    const playerEntity = entities.values().next().value;
    const activeQuest = this.ecs.getComponent(playerEntity, ActiveQuest);

    const abandoned = this.questManager.abandonQuest(questId, activeQuest);
    if (abandoned) {
      console.log(`👋 Quest "${questId}" abbandonata dal giocatore`);
      this.notifyQuestPanelUpdate();
    } else {
      console.warn(`❌ Impossibile abbandonare la quest "${questId}"`);
    }
  }

  /**
   * Imposta il riferimento al pannello quest per aggiornamenti
   */
  setQuestPanel(panel: QuestPanel): void {
    this.questPanel = panel;
  }

  /**
   * Notifica al pannello quest di aggiornarsi
   */
  private notifyQuestPanelUpdate(): void {
    if (this.questPanel) {
      // Trova l'entità player
      const entities = this.ecs.getEntitiesWithComponents(ActiveQuest);
      if (entities.size > 0) {
        const playerEntity = entities.values().next().value;
        const activeQuest = this.ecs.getComponent(playerEntity, ActiveQuest);
        const questData = this.questManager.getQuestData(activeQuest);

        // Trigger update event per il pannello
        const event = new CustomEvent('questDataUpdate', { detail: questData });
        document.dispatchEvent(event);
      }
    }
  }

  /**
   * Restituisce i dati delle quest per l'UI
   */
  getQuestUIData(): any {
    const entities = this.ecs.getEntitiesWithComponents(ActiveQuest);
    if (entities.size === 0) return null;

    const playerEntity = entities.values().next().value;
    const activeQuest = this.ecs.getComponent(playerEntity, ActiveQuest);
    return this.questManager.getQuestData(activeQuest);
  }

  /**
   * Restituisce il QuestManager sottostante
   */
  getQuestManager(): QuestManager {
    return this.questManager;
  }

  update(deltaTime: number): void {
    // Aggiorna il tracking delle quest attive
    const entities = this.ecs.getEntitiesWithComponents(ActiveQuest);
    for (const entity of entities) {
      const activeQuest = this.ecs.getComponent(entity, ActiveQuest);
      this.questManager.updateQuestProgress(activeQuest);
    }
  }
}
