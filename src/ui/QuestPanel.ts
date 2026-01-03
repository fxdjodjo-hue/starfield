import { BasePanel, PanelConfig, PanelData } from './UIManager';

/**
 * Dati per il pannello delle quest
 */
export interface QuestData {
  activeQuests: Quest[];
  completedQuests: Quest[];
  availableQuests: Quest[];
}

/**
 * Interfaccia per una singola quest
 */
export interface Quest {
  id: string;
  title: string;
  description: string;
  type: 'kill' | 'survival' | 'progression' | 'collection' | 'achievement';
  objectives: QuestObjective[];
  rewards: QuestReward[];
  progress: number; // 0-100
  isCompleted: boolean;
  isActive: boolean;
  timeRemaining?: number; // per quest a tempo
}

/**
 * Obiettivo di una quest
 */
export interface QuestObjective {
  id: string;
  description: string;
  current: number;
  target: number;
  type: string;
}

/**
 * Ricompensa di una quest
 */
export interface QuestReward {
  type: 'credits' | 'experience' | 'item' | 'title';
  amount?: number;
  itemId?: string;
  title?: string;
}

/**
 * QuestPanel - Pannello che mostra quest attive, completate e disponibili
 * Implementa l'interfaccia BasePanel per l'integrazione nel sistema UI
 */
export class QuestPanel extends BasePanel {
  private questData: QuestData = {
    activeQuests: [],
    completedQuests: [],
    availableQuests: []
  };

  constructor(config: PanelConfig) {
    super(config);
  }

  /**
   * Crea il contenuto del pannello delle quest
   */
  protected createPanelContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'quest-panel-content';
    content.style.cssText = `
      padding: 24px;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
      position: relative;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
      border-radius: 16px;
      overflow-y: auto;
    `;

    // Pulsante di chiusura "X" nell'angolo superiore destro
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(239, 68, 68, 0.9);
      border: 1px solid rgba(239, 68, 68, 0.5);
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 8px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
      transition: all 0.2s ease;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(239, 68, 68, 1)';
      closeButton.style.borderColor = 'rgba(239, 68, 68, 0.8)';
      closeButton.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
      closeButton.style.transform = 'translateY(-1px)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(239, 68, 68, 0.9)';
      closeButton.style.borderColor = 'rgba(239, 68, 68, 0.5)';
      closeButton.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
      closeButton.style.transform = 'translateY(0)';
    });

    closeButton.addEventListener('click', () => {
      this.hide();
    });

    content.appendChild(closeButton);

    // Header con titolo
    const header = document.createElement('div');
    header.style.cssText = `
      text-align: center;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 8px;
      margin-top: 10px;
    `;

    const title = document.createElement('h2');
    title.textContent = '📋 Missioni & Quest';
    title.style.cssText = `
      margin: 0;
      color: rgba(255, 255, 255, 0.95);
      font-size: 22px;
      font-weight: 700;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      background: linear-gradient(135deg, #60a5fa, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    `;

    header.appendChild(title);
    content.appendChild(header);

    // Container principale per le quest
    const questContainer = document.createElement('div');
    questContainer.className = 'quest-container';
    questContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    // Sezione quest attive
    const activeSection = this.createQuestSection('🎯 Quest Attive', 'active-quests', this.questData.activeQuests);
    const completedSection = this.createQuestSection('✅ Quest Completate', 'completed-quests', this.questData.completedQuests);
    const availableSection = this.createQuestSection('📋 Quest Disponibili', 'available-quests', this.questData.availableQuests);

    questContainer.appendChild(activeSection);
    questContainer.appendChild(completedSection);
    questContainer.appendChild(availableSection);

    content.appendChild(questContainer);

    return content;
  }

  /**
   * Crea una sezione per un tipo di quest
   */
  private createQuestSection(title: string, containerId: string, quests: Quest[]): HTMLElement {
    const section = document.createElement('div');
    section.className = 'quest-section';
    section.style.cssText = `
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = title;
    sectionTitle.style.cssText = `
      margin: 0 0 8px 0;
      color: rgba(148, 163, 184, 0.9);
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    section.appendChild(sectionTitle);

    const questList = document.createElement('div');
    questList.id = containerId;
    questList.className = 'quest-list';
    questList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
    `;

    // Aggiungi quest placeholder se la lista è vuota
    if (quests.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'Nessuna quest in questa categoria';
      emptyMessage.style.cssText = `
        color: rgba(148, 163, 184, 0.6);
        font-style: italic;
        text-align: center;
        padding: 20px;
        font-size: 14px;
      `;
      questList.appendChild(emptyMessage);
    }

    section.appendChild(questList);

    return section;
  }

  /**
   * Crea una card per una singola quest
   */
  private createQuestCard(quest: Quest): HTMLElement {
    const card = document.createElement('div');
    card.className = 'quest-card';
    card.style.cssText = `
      background: rgba(51, 65, 85, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: all 0.3s ease;
      cursor: pointer;
    `;

    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
      card.style.borderColor = this.getQuestColor(quest.type);
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
      card.style.borderColor = 'rgba(148, 163, 184, 0.2)';
    });

    // Header della quest
    const questHeader = document.createElement('div');
    questHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const questTitle = document.createElement('span');
    questTitle.textContent = quest.title;
    questTitle.style.cssText = `
      color: rgba(255, 255, 255, 0.95);
      font-size: 14px;
      font-weight: 600;
    `;

    const questStatus = document.createElement('span');
    questStatus.textContent = quest.isCompleted ? '✅' : `${quest.progress}%`;
    questStatus.style.cssText = `
      color: ${quest.isCompleted ? '#10b981' : this.getQuestColor(quest.type)};
      font-size: 12px;
      font-weight: 600;
    `;

    questHeader.appendChild(questTitle);
    questHeader.appendChild(questStatus);

    // Descrizione
    const questDescription = document.createElement('div');
    questDescription.textContent = quest.description;
    questDescription.style.cssText = `
      color: rgba(148, 163, 184, 0.8);
      font-size: 12px;
      line-height: 1.4;
    `;

    // Progress bar se non completata
    if (!quest.isCompleted && quest.progress > 0) {
      const progressContainer = document.createElement('div');
      progressContainer.style.cssText = `
        width: 100%;
        height: 4px;
        background: rgba(148, 163, 184, 0.2);
        border-radius: 2px;
        overflow: hidden;
      `;

      const progressBar = document.createElement('div');
      progressBar.style.cssText = `
        width: ${quest.progress}%;
        height: 100%;
        background: linear-gradient(90deg, ${this.getQuestColor(quest.type)}, ${this.adjustColorBrightness(this.getQuestColor(quest.type), 30)});
        border-radius: 2px;
        transition: width 0.5s ease;
      `;

      progressContainer.appendChild(progressBar);
      card.appendChild(progressContainer);
    }

    card.appendChild(questHeader);
    card.appendChild(questDescription);

    return card;
  }

  /**
   * Ottiene il colore associato al tipo di quest
   */
  private getQuestColor(type: string): string {
    const colors: { [key: string]: string } = {
      'kill': '#ef4444',      // Rosso
      'survival': '#10b981',  // Verde
      'progression': '#3b82f6', // Blu
      'collection': '#f59e0b',  // Arancione
      'achievement': '#8b5cf6'  // Viola
    };
    return colors[type] || '#6b7280'; // Grigio di default
  }

  /**
   * Regola la luminosità di un colore
   */
  private adjustColorBrightness(color: string, amount: number): string {
    // Semplice funzione per schiarire un colore (implementazione base)
    if (color.startsWith('#')) {
      const num = parseInt(color.replace("#", ""), 16);
      const amt = Math.round(2.55 * amount);
      const R = (num >> 16) + amt;
      const G = (num >> 8 & 0x00FF) + amt;
      const B = (num & 0x0000FF) + amt;
      return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
    return color;
  }

  /**
   * Aggiorna i dati del pannello
   */
  update(data: PanelData): void {
    const questData = data as QuestData;
    if (!questData) return;

    // Aggiorna i dati interni
    Object.assign(this.questData, questData);

    // Aggiorna l'interfaccia
    this.updateDisplay();
  }

  /**
   * Aggiorna la visualizzazione delle quest
   */
  private updateDisplay(): void {
    // Aggiorna quest attive
    this.updateQuestList('active-quests', this.questData.activeQuests);

    // Aggiorna quest completate
    this.updateQuestList('completed-quests', this.questData.completedQuests);

    // Aggiorna quest disponibili
    this.updateQuestList('available-quests', this.questData.availableQuests);
  }

  /**
   * Aggiorna una lista specifica di quest
   */
  private updateQuestList(containerId: string, quests: Quest[]): void {
    const container = this.container.querySelector(`#${containerId}`) as HTMLElement;
    if (!container) return;

    // Svuota il container
    container.innerHTML = '';

    if (quests.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'Nessuna quest in questa categoria';
      emptyMessage.style.cssText = `
        color: rgba(148, 163, 184, 0.6);
        font-style: italic;
        text-align: center;
        padding: 20px;
        font-size: 14px;
      `;
      container.appendChild(emptyMessage);
    } else {
      // Aggiungi ogni quest come card
      quests.forEach(quest => {
        const questCard = this.createQuestCard(quest);
        container.appendChild(questCard);
      });
    }
  }

  /**
   * Callback chiamato quando il pannello viene mostrato
   */
  protected onShow(): void {
    // Potrebbe servire per aggiornare dati in tempo reale o animazioni
  }

  /**
   * Callback chiamato quando il pannello viene nascosto
   */
  protected onHide(): void {
    // Potrebbe servire per salvare stato o cleanup
  }
}
