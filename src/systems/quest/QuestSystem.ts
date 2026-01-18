import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { ActiveQuest } from '../../entities/quest/ActiveQuest';
import { QuestManager } from '../../core/domain/quest/QuestManager';
import { QuestPanel } from '../../presentation/ui/QuestPanel';
import { gameAPI } from '../../lib/SupabaseClient';

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

    // Listener per richieste di aggiornamento dati dal pannello quest
    document.addEventListener('requestQuestDataUpdate', () => {
      this.notifyQuestPanelUpdate();
    });
  }

  /**
   * Gestisce l'accettazione di una quest
   */
  private handleQuestAcceptance(questId: string): void {
    // Trova l'entità player con ActiveQuest
    const entities = this.ecs.getEntitiesWithComponents(ActiveQuest);
    if (entities.length === 0) return;

    const playerEntity = entities[0];
    const activeQuest = this.ecs.getComponent(playerEntity, ActiveQuest);
    if (!activeQuest) return;

    if (this.questManager.isQuestAvailable(questId) && this.questManager.canAcceptQuest(questId)) {
      const accepted = this.questManager.acceptQuest(questId, activeQuest);
      if (accepted) {
        this.notifyQuestPanelUpdate();
      }
    }
  }

  /**
   * Gestisce l'abbandono di una quest
   */
  private handleQuestAbandon(questId: string): void {
    // Trova l'entità player con ActiveQuest
    const entities = this.ecs.getEntitiesWithComponents(ActiveQuest);
    if (entities.length === 0) return;

    const playerEntity = entities[0];
    const activeQuest = this.ecs.getComponent(playerEntity, ActiveQuest);
    if (!activeQuest) return;

    const abandoned = this.questManager.abandonQuest(questId, activeQuest);
    if (abandoned) {
      this.notifyQuestPanelUpdate();
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
      if (entities.length > 0) {
        const playerEntity = entities[0];
        const activeQuest = this.ecs.getComponent(playerEntity, ActiveQuest);
        if (activeQuest) {
          const questData = this.questManager.getQuestData(activeQuest);

          // Trigger update event per il pannello
          const event = new CustomEvent('questDataUpdate', { detail: questData });
          document.dispatchEvent(event);
        }
      }
    }
  }

  /**
   * Restituisce i dati delle quest per l'UI
   */
  getQuestUIData(): any {
    const entities = this.ecs.getEntitiesWithComponents(ActiveQuest);
    if (entities.length === 0) return null;

    const playerEntity = entities[0];
    const activeQuest = this.ecs.getComponent(playerEntity, ActiveQuest);
    if (!activeQuest) return null;
    return this.questManager.getQuestData(activeQuest);
  }

  /**
   * Restituisce il QuestManager sottostante
   */
  getQuestManager(): QuestManager {
    return this.questManager;
  }

  update(deltaTime: number): void {
    // Il QuestSystem non gestisce aggiornamenti di progresso delle quest
    // Quello è responsabilità del QuestTrackingSystem che risponde agli eventi di gioco
    // Questo sistema gestisce solo l'interfaccia utente e accettazione/rifiuto quest
  }
}
