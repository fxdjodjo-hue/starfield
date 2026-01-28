import { BasePanel } from './FloatingIcon';
import type { PanelConfig } from './PanelConfig';
import type { PanelData } from './UIManager';

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
  type: 'kill' | 'survival' | 'progression' | 'collection' | 'achievement' | 'exploration';
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
  targetName?: string;
  targetType?: string;
}

/**
 * Ricompensa di una quest
 */
export interface QuestReward {
  type: 'credits' | 'experience' | 'item' | 'title' | 'cosmos' | 'honor';
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
    this.setupQuestEventListeners();
  }

  /**
   * Imposta i listener per gli eventi delle quest
   */
  private setupQuestEventListeners(): void {
    // Ascolta l'evento di aggiornamento dei dati delle quest dal QuestSystem
    document.addEventListener('questDataUpdate', (event: any) => {
      const questData = event.detail;
      if (questData) {
        this.update(questData);
      }
    });

    // Ascolta anche l'evento alternativo dall'UiSystem
    document.addEventListener('updateQuestPanel', (event: any) => {
      const questData = event.detail;
      if (questData) {
        this.update(questData);
      }
    });
  }

  /**
   * Crea il contenuto del pannello delle quest
   */
  private currentTab: 'active' | 'completed' | 'available' = 'active';

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
      overflow-y: hidden;
      box-sizing: border-box;
    `;

    // Pulsante di chiusura "X" nell'angolo superiore destro
    const closeButton = document.createElement('button');
    closeButton.textContent = 'X';
    closeButton.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.6);
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
      transition: all 0.2s ease;
      backdrop-filter: blur(4px);
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(239, 68, 68, 0.8)';
      closeButton.style.color = 'white';
      closeButton.style.borderColor = 'rgba(239, 68, 68, 1)';
      closeButton.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.4)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.05)';
      closeButton.style.color = 'rgba(255, 255, 255, 0.6)';
      closeButton.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      closeButton.style.boxShadow = 'none';
    });

    closeButton.addEventListener('click', () => {
      this.hide();
    });

    content.appendChild(closeButton);

    // Header con titolo
    const header = document.createElement('div');
    header.style.cssText = `
      text-align: center;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 8px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    `;

    const title = document.createElement('h2');
    // Unify terminology to "Missions" as requested
    title.textContent = 'Missions';
    title.style.cssText = `
      margin: 0;
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      letter-spacing: 0.5px;
    `;

    header.appendChild(title);
    content.appendChild(header);

    // Tab Navigation
    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = `
      display: flex;
      gap: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 10px;
      margin-bottom: 10px;
    `;

    const tabs: { id: 'active' | 'completed' | 'available', label: string }[] = [
      { id: 'active', label: 'Active' },
      { id: 'available', label: 'Available' },
      { id: 'completed', label: 'Completed' }
    ];

    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.textContent = tab.label;
      btn.id = `tab-btn-${tab.id}`;
      btn.className = 'quest-tab-btn'; // Useful for future styling if needed
      this.styleTabButton(btn, tab.id === this.currentTab);

      btn.addEventListener('click', () => {
        this.switchTab(tab.id);
      });

      tabContainer.appendChild(btn);
    });

    content.appendChild(tabContainer);

    // Container principale per le quest
    const questContainer = document.createElement('div');
    questContainer.className = 'quest-container';
    questContainer.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    `;

    // Hide scrollbar style
    const style = document.createElement('style');
    style.textContent = `
      .quest-container::-webkit-scrollbar {
        width: 8px;
      }
      .quest-container::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 4px;
      }
      .quest-container::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }
      .quest-container::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    `;
    content.appendChild(style);


    // Sezione quest attive
    const activeSection = this.createQuestSection('Active Quests', 'active-quests', [], 'active');
    activeSection.id = 'section-active';
    activeSection.style.display = 'flex'; // Default visible

    // Sezione quest completate
    const completedSection = this.createQuestSection('✅ Completed Quests', 'completed-quests', [], 'completed');
    completedSection.id = 'section-completed';
    completedSection.style.display = 'none';

    // Sezione quest disponibili
    const availableSection = this.createQuestSection('📋 Available Quests', 'available-quests', [], 'available');
    availableSection.id = 'section-available';
    availableSection.style.display = 'none';

    questContainer.appendChild(activeSection);
    questContainer.appendChild(availableSection);
    questContainer.appendChild(completedSection);

    content.appendChild(questContainer);

    return content;
  }

  private styleTabButton(btn: HTMLButtonElement, isActive: boolean) {
    btn.style.cssText = `
        padding: 8px 16px;
        background: ${isActive ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)'};
        color: ${isActive ? 'white' : 'rgba(255, 255, 255, 0.6)'};
        border: 1px solid ${isActive ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)'};
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s ease;
        flex: 1;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-size: 13px;
        backdrop-filter: blur(4px);
      `;

    // Hover effect handling manually since we use inline styles
    if (!isActive) {
      btn.onmouseenter = () => {
        btn.style.background = 'rgba(255, 255, 255, 0.1)';
        btn.style.color = 'white';
        btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      };
      btn.onmouseleave = () => {
        btn.style.background = 'rgba(255, 255, 255, 0.05)';
        btn.style.color = 'rgba(255, 255, 255, 0.6)';
        btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      };
    } else {
      btn.onmouseenter = null;
      btn.onmouseleave = null;
    }
  }

  private switchTab(tabId: 'active' | 'completed' | 'available') {
    this.currentTab = tabId;

    // Update buttons
    ['active', 'completed', 'available'].forEach(id => {
      const btn = this.container.querySelector(`#tab-btn-${id}`) as HTMLButtonElement;
      if (btn) {
        this.styleTabButton(btn, id === tabId);
      }
    });

    // Show/Hide sections
    const activeSection = this.container.querySelector('#section-active') as HTMLElement;
    const completedSection = this.container.querySelector('#section-completed') as HTMLElement;
    const availableSection = this.container.querySelector('#section-available') as HTMLElement;

    if (activeSection) activeSection.style.display = tabId === 'active' ? 'flex' : 'none';
    if (completedSection) completedSection.style.display = tabId === 'completed' ? 'flex' : 'none';
    if (availableSection) availableSection.style.display = tabId === 'available' ? 'flex' : 'none';
  }





  /**
   * Crea una sezione per un tipo di quest
   */
  private createQuestSection(title: string, containerId: string, quests: Quest[], sectionType: 'active' | 'completed' | 'available' = 'active'): HTMLElement {
    const section = document.createElement('div');
    section.className = 'quest-section';
    section.style.cssText = `
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
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
      color: rgba(255, 255, 255, 0.9);
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
    `;

    // Aggiungi quest placeholder se la lista è vuota
    if (quests.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'No quests in this category';
      emptyMessage.style.cssText = `
        color: rgba(255, 255, 255, 0.6);
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
  private createQuestCard(quest: Quest, sectionType: 'active' | 'completed' | 'available' = 'active'): HTMLElement {
    const card = document.createElement('div');
    card.className = 'quest-card';
    card.style.cssText = `
      background: rgba(10, 10, 10, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: all 0.3s ease;
      cursor: pointer;
    `;

    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.4)';
      card.style.background = 'rgba(30, 30, 30, 0.7)';
      card.style.borderColor = this.getQuestColor(quest.type);
    });

    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = 'none';
      card.style.background = 'rgba(10, 10, 10, 0.6)';
      card.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    });

    // Header della quest
    const questHeader = document.createElement('div');
    questHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start; /* Align top in case of wrapping */
      gap: 12px;
    `;

    const questTitle = document.createElement('span');
    questTitle.textContent = quest.title;
    questTitle.style.cssText = `
      color: white;
      font-size: 14px;
      font-weight: 600;
      flex: 1;
    `;
    questHeader.appendChild(questTitle);

    // Rewards/Status Container (Top Right)
    const statusContainer = document.createElement('div');
    statusContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    // Se completata mostriamo checkmark, altrimenti mostriamo le ricompense
    if (quest.isCompleted) {
      const completedIcon = document.createElement('span');
      completedIcon.textContent = 'COMPLETE';
      completedIcon.style.cssText = `
         color: white;
         font-size: 11px;
         font-weight: 700;
         letter-spacing: 0.5px;
         background: rgba(255, 255, 255, 0.1);
         padding: 2px 6px;
         border-radius: 4px;
       `;
      statusContainer.appendChild(completedIcon);
    }

    questHeader.appendChild(statusContainer);
    card.appendChild(questHeader);

    // Descrizione
    const questDescription = document.createElement('div');
    questDescription.textContent = quest.description;
    questDescription.style.cssText = `
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      line-height: 1.4;
      margin-top: 4px;
    `;
    card.appendChild(questDescription);

    // Unified Details Container (Objectives & Rewards)
    if ((quest.objectives && quest.objectives.length > 0) || (quest.rewards && quest.rewards.length > 0)) {
      const detailsContainer = document.createElement('div');
      detailsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 8px;
        background: rgba(0, 0, 0, 0.25);
        padding: 10px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.03);
      `;

      // 1. Objectives Section
      if (quest.objectives && quest.objectives.length > 0) {
        const objectivesSection = document.createElement('div');
        objectivesSection.style.cssText = `display: flex; flex-direction: column; gap: 4px;`;

        const objectivesTitle = document.createElement('div');
        objectivesTitle.textContent = 'Objectives:';
        objectivesTitle.style.cssText = `
          color: rgba(255, 255, 255, 0.4);
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        `;
        objectivesSection.appendChild(objectivesTitle);

        quest.objectives.forEach(obj => {
          const objEl = document.createElement('div');
          objEl.style.cssText = `
            color: rgba(255, 255, 255, 0.85);
            font-size: 11px;
            line-height: 1.4;
          `;

          let text = obj.description;
          if (!text && obj.targetName) {
            text = `${obj.type} ${obj.target} ${obj.targetName}`;
          }

          if (quest.isActive || quest.isCompleted) {
            text += ` (${obj.current}/${obj.target})`;
          } else if (!text.includes(obj.target.toString())) {
            text += ` (${obj.target})`;
          }

          objEl.textContent = `- ${text}`;
          objectivesSection.appendChild(objEl);
        });

        detailsContainer.appendChild(objectivesSection);
      }

      // 2. Divider if both exist
      if (quest.objectives?.length > 0 && quest.rewards?.length > 0) {
        const divider = document.createElement('div');
        divider.style.cssText = `
            height: 1px;
            background: rgba(255, 255, 255, 0.05);
            margin: 2px 0;
          `;
        detailsContainer.appendChild(divider);
      }

      // 3. Rewards Section
      if (quest.rewards && quest.rewards.length > 0) {
        const rewardsSection = document.createElement('div');
        rewardsSection.style.cssText = `display: flex; flex-direction: column; gap: 4px;`;

        const rewardsTitle = document.createElement('div');
        rewardsTitle.textContent = 'Rewards:';
        rewardsTitle.style.cssText = `
          color: rgba(255, 255, 255, 0.4);
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        `;
        rewardsSection.appendChild(rewardsTitle);

        quest.rewards.forEach(reward => {
          const rewardEl = document.createElement('div');
          rewardEl.style.cssText = `
            color: rgba(255, 255, 255, 0.85);
            font-size: 11px;
            font-weight: 600;
          `;

          let code = '';
          const amount = reward.amount || 0;

          switch (reward.type) {
            case 'credits': code = 'Credits'; break;
            case 'experience': code = 'Experience'; break;
            case 'cosmos': code = 'Cosmos'; break;
            case 'honor': code = 'Honor'; break;
            case 'item': code = 'Item'; break;
            case 'title': code = 'Title'; break;
            default: code = 'Reward';
          }

          rewardEl.textContent = amount > 0 ? `- ${amount} ${code}` : `- ${code}`;
          rewardsSection.appendChild(rewardEl);
        });

        detailsContainer.appendChild(rewardsSection);
      }

      card.appendChild(detailsContainer);
    }

    // (Rimosso vecchio blocco rewards display che era qui)
    // Old Rewards Display block (commented out as per instruction)
    /*
    if (quest.rewards && quest.rewards.length > 0) {
      const rewardsContainer = document.createElement('div');
      rewardsContainer.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 4px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        padding-top: 8px;
      `;

      quest.rewards.forEach(reward => {
        const rewardEl = document.createElement('div');
        rewardEl.style.cssText = `
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(255, 255, 255, 0.05);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.7);
        `;

        let icon = '';
        let label = '';
        const amount = reward.amount || 0;

        switch (reward.type) {
          case 'credits': icon = '💳'; label = `${amount} CR`; break;
          case 'experience': icon = '⭐'; label = `${amount} XP`; break;
          case 'cosmos': icon = '🌌'; label = `${amount} CO`; break;
          case 'honor': icon = '🎖️'; label = `${amount} H`; break;
          case 'item': icon = '📦'; label = 'Item'; break; // Could resolve item name if possible
          case 'title': icon = '👑'; label = `Title: ${reward.title}`; break;
          default: icon = '🎁'; label = 'Reward';
        }

        rewardEl.innerHTML = `<span style="opacity:0.8">${icon}</span> <span>${label}</span>`;
        rewardsContainer.appendChild(rewardEl);
      });

      card.appendChild(rewardsContainer);
    }
    */

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
        background: linear-gradient(90deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.4));
        border-radius: 2px;
        transition: width 0.5s ease;
      `;

      progressContainer.appendChild(progressBar);
      card.appendChild(progressContainer);
    }

    // Aggiungi pulsanti di azione basati sul tipo di sezione
    if (sectionType === 'active') {
      const actionContainer = document.createElement('div');
      actionContainer.style.cssText = `
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
      `;

      const abandonButton = document.createElement('button');
      abandonButton.textContent = 'Abandon Quest';
      abandonButton.style.cssText = `
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      `;

      abandonButton.addEventListener('mouseenter', () => {
        abandonButton.style.background = 'rgba(239, 68, 68, 0.2)'; // Subtle Red tint on hover
        abandonButton.style.color = '#fff';
        abandonButton.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      });

      abandonButton.addEventListener('mouseleave', () => {
        abandonButton.style.background = 'rgba(255, 255, 255, 0.05)';
        abandonButton.style.color = 'rgba(255, 255, 255, 0.7)';
        abandonButton.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      });

      abandonButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onQuestAbandon(quest.id);
      });

      actionContainer.appendChild(abandonButton);
      card.appendChild(actionContainer);
    } else if (sectionType === 'available') {
      const actionContainer = document.createElement('div');
      actionContainer.style.cssText = `
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
      `;

      const acceptButton = document.createElement('button');
      acceptButton.textContent = 'Accept Quest';
      acceptButton.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 6px 16px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      `;

      acceptButton.addEventListener('mouseenter', () => {
        acceptButton.style.background = 'rgba(255, 255, 255, 0.2)';
        acceptButton.style.borderColor = 'rgba(255, 255, 255, 0.4)';
        acceptButton.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.1)';
      });

      acceptButton.addEventListener('mouseleave', () => {
        acceptButton.style.background = 'rgba(255, 255, 255, 0.1)';
        acceptButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        acceptButton.style.boxShadow = 'none';
      });

      acceptButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onQuestAccept(quest.id);
      });

      actionContainer.appendChild(acceptButton);
      card.appendChild(actionContainer);
    }

    return card;
  }

  /**
   * Ottiene il colore associato al tipo di quest
   */
  private getQuestColor(type: string): string {
    // Neutral/White theme per richiesta utente
    // Returning white/off-white for all types to match UI
    return 'rgba(255, 255, 255, 0.9)';
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

    // Controlla se i dati sono effettivamente cambiati per evitare ri-rendering inutili
    const hasChanged =
      this.questData.activeQuests.length !== questData.activeQuests.length ||
      this.questData.completedQuests.length !== questData.completedQuests.length ||
      this.questData.availableQuests.length !== questData.availableQuests.length ||
      JSON.stringify(this.questData.activeQuests) !== JSON.stringify(questData.activeQuests) ||
      JSON.stringify(this.questData.completedQuests) !== JSON.stringify(questData.completedQuests) ||
      JSON.stringify(this.questData.availableQuests) !== JSON.stringify(questData.availableQuests);

    if (!hasChanged) return;

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
   * Determina il tipo di sezione dal containerId
   */
  private getSectionTypeFromContainerId(containerId: string): 'active' | 'completed' | 'available' {
    if (containerId === 'active-quests') return 'active';
    if (containerId === 'completed-quests') return 'completed';
    if (containerId === 'available-quests') return 'available';
    return 'active'; // Default fallback
  }

  /**
   * Aggiorna una lista specifica di quest
   */
  private updateQuestList(containerId: string, quests: Quest[]): void {
    const container = this.container.querySelector(`#${containerId}`) as HTMLElement;
    if (!container) return;

    // Determina il tipo di sezione
    const sectionType = this.getSectionTypeFromContainerId(containerId);

    // Svuota il container
    container.innerHTML = '';

    if (quests.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'No quests in this category';
      emptyMessage.style.cssText = `
        color: rgba(255, 255, 255, 0.6);
        font-style: italic;
        text-align: center;
        padding: 20px;
        font-size: 14px;
      `;
      container.appendChild(emptyMessage);
    } else {
      // Aggiungi ogni quest come card
      quests.forEach(quest => {
        const questCard = this.createQuestCard(quest, sectionType);
        container.appendChild(questCard);
      });
    }
  }

  /**
   * Callback chiamato quando il pannello viene mostrato
   */
  protected onShow(): void {
    // Reset to active tab
    this.switchTab('active');

    // Richiedi un aggiornamento dei dati delle quest
    this.requestQuestDataUpdate();

    // Accetta automaticamente la quest disponibile quando si apre il pannello
    this.autoAcceptAvailableQuests();
  }

  /**
   * Richiede un aggiornamento dei dati delle quest
   */
  private requestQuestDataUpdate(): void {
    // Trigger custom event per richiedere l'aggiornamento dei dati delle quest
    const event = new CustomEvent('requestQuestDataUpdate');
    document.dispatchEvent(event);
  }

  /**
   * Accetta automaticamente le quest disponibili
   */
  private autoAcceptAvailableQuests(): void {
    // Nota: Questa logica dovrebbe essere gestita dal PlayState o da un sistema centrale
    // Per ora, questa è solo una struttura placeholder
    // La logica reale sarà implementata quando il pannello avrà accesso al QuestManager
  }

  /**
   * Callback chiamato quando il pannello viene nascosto
   */
  protected onHide(): void {
    // Potrebbe servire per salvare stato o cleanup
  }

  /**
   * Gestisce l'accettazione di una quest
   */
  private onQuestAccept(questId: string): void {
    // Trigger custom event per notificare il PlayState
    const event = new CustomEvent('questAccept', { detail: { questId } });
    document.dispatchEvent(event);
  }

  private onQuestAbandon(questId: string): void {
    // Trigger custom event per notificare il PlayState
    const event = new CustomEvent('questAbandon', { detail: { questId } });
    document.dispatchEvent(event);
  }
}
