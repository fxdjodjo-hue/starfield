import { BasePanel } from './UIManager';
import type { PanelConfig } from './PanelConfig';
import type { PanelData } from './UIManager';

/**
 * Dati per il pannello delle abilità
 */
export interface SkillsData {
  availablePoints: number;
  totalPoints: number;
  categories: {
    combat: SkillCategory;
    exploration: SkillCategory;
    social: SkillCategory;
    technical: SkillCategory;
  };
}

export interface SkillCategory {
  name: string;
  description: string;
  skills: Skill[];
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  currentLevel: number;
  maxLevel: number;
  cost: number;
  icon: string;
}

/**
 * SkillsPanel - Pannello per gestire i punti abilità del giocatore
 * Mostra categorie di abilità e permette di spendere punti per upgrade
 */
export class SkillsPanel extends BasePanel {
  private skillsData: SkillsData;
    availablePoints: 5,
    totalPoints: 15,
    categories: {
      combat: {
        name: 'Combattimento',
        description: 'Abilità offensive e difensive',
        skills: [
          {
            id: 'damage',
            name: 'Potenza di Fuoco',
            description: 'Aumenta il danno inflitto ai nemici',
            currentLevel: 3,
            maxLevel: 10,
            cost: 2,
            icon: '💥'
          },
          {
            id: 'shield',
            name: 'Capacità Scudo',
            description: 'Migliora la resistenza degli scudi',
            currentLevel: 2,
            maxLevel: 8,
            cost: 3,
            icon: '🛡️'
          },
          {
            id: 'health',
            name: 'Vitalità',
            description: 'Aumenta la salute massima',
            currentLevel: 4,
            maxLevel: 12,
            cost: 2,
            icon: '❤️'
          }
        ]
      },
      exploration: {
        name: 'Esplorazione',
        description: 'Navigazione e scoperta',
        skills: [
          {
            id: 'scanning',
            name: 'Scansione Avanzata',
            description: 'Rileva risorse e nemici a distanza maggiore',
            currentLevel: 1,
            maxLevel: 6,
            cost: 4,
            icon: '📡'
          },
          {
            id: 'navigation',
            name: 'Navigazione Stellare',
            description: 'Migliora la velocità e l\'efficienza del viaggio',
            currentLevel: 2,
            maxLevel: 8,
            cost: 3,
            icon: '🧭'
          }
        ]
      },
      social: {
        name: 'Sociale',
        description: 'Interazioni e diplomazia',
        skills: [
          {
            id: 'negotiation',
            name: 'Negoziazione',
            description: 'Migliora i prezzi di acquisto e vendita',
            currentLevel: 1,
            maxLevel: 5,
            cost: 5,
            icon: '💬'
          },
          {
            id: 'intimidation',
            name: 'Intimidazione',
            description: 'Riduce le probabilità di essere attaccati',
            currentLevel: 0,
            maxLevel: 4,
            cost: 6,
            icon: '😠'
          }
        ]
      },
      technical: {
        name: 'Tecnico',
        description: 'Riparazione e ottimizzazione',
        skills: [
          {
            id: 'repair',
            name: 'Riparazione Rapida',
            description: 'Riduce il tempo necessario per le riparazioni',
            currentLevel: 2,
            maxLevel: 7,
            cost: 3,
            icon: '🔧'
          },
          {
            id: 'efficiency',
            name: 'Efficienza Energetica',
            description: 'Riduce il consumo di energia dei sistemi',
            currentLevel: 1,
            maxLevel: 6,
            cost: 4,
            icon: '⚡'
          }
        ]
      }
    }
  };

  constructor(config: PanelConfig) {
    // Inizializza i dati prima di chiamare super() per evitare errori
    this.skillsData = {
      availablePoints: 5,
      totalPoints: 15,
      categories: {
        combat: {
          name: 'Combattimento',
          description: 'Abilità offensive e difensive',
          skills: [
            {
              id: 'damage',
              name: 'Potenza di Fuoco',
              description: 'Aumenta il danno inflitto ai nemici',
              currentLevel: 3,
              maxLevel: 10,
              cost: 2,
              icon: '💥'
            },
            {
              id: 'shield',
              name: 'Capacità Scudo',
              description: 'Migliora la resistenza degli scudi',
              currentLevel: 2,
              maxLevel: 8,
              cost: 3,
              icon: '🛡️'
            },
            {
              id: 'health',
              name: 'Vitalità',
              description: 'Aumenta la salute massima',
              currentLevel: 4,
              maxLevel: 12,
              cost: 2,
              icon: '❤️'
            }
          ]
        },
        exploration: {
          name: 'Esplorazione',
          description: 'Navigazione e scoperta',
          skills: [
            {
              id: 'scanning',
              name: 'Scansione Avanzata',
              description: 'Rileva risorse e nemici a distanza maggiore',
              currentLevel: 1,
              maxLevel: 6,
              cost: 4,
              icon: '📡'
            },
            {
              id: 'navigation',
              name: 'Navigazione Stellare',
              description: 'Migliora la velocità e l\'efficienza del viaggio',
              currentLevel: 2,
              maxLevel: 8,
              cost: 3,
              icon: '🧭'
            }
          ]
        },
        social: {
          name: 'Sociale',
          description: 'Interazioni e diplomazia',
          skills: [
            {
              id: 'negotiation',
              name: 'Negoziazione',
              description: 'Migliora i prezzi di acquisto e vendita',
              currentLevel: 1,
              maxLevel: 5,
              cost: 5,
              icon: '💬'
            },
            {
              id: 'intimidation',
              name: 'Intimidazione',
              description: 'Riduce le probabilità di essere attaccati',
              currentLevel: 0,
              maxLevel: 4,
              cost: 6,
              icon: '😠'
            }
          ]
        },
        technical: {
          name: 'Tecnico',
          description: 'Riparazione e ottimizzazione',
          skills: [
            {
              id: 'repair',
              name: 'Riparazione Rapida',
              description: 'Riduce il tempo necessario per le riparazioni',
              currentLevel: 2,
              maxLevel: 7,
              cost: 3,
              icon: '🔧'
            },
            {
              id: 'efficiency',
              name: 'Efficienza Energetica',
              description: 'Riduce il consumo di energia dei sistemi',
              currentLevel: 1,
              maxLevel: 6,
              cost: 4,
              icon: '⚡'
            }
          ]
        }
      }
    };

    super(config);
  }

  /**
   * Crea il contenuto del pannello abilità
   */
  protected createPanelContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'skills-content';
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

    // Pulsante di chiusura
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

    // Header con punti abilità
    const header = this.createHeader();
    content.appendChild(header);

    // Categorie di abilità
    const categoriesContainer = this.createCategoriesContainer();
    content.appendChild(categoriesContainer);

    return content;
  }

  /**
   * Crea l'header con i punti abilità disponibili
   */
  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.style.cssText = `
      text-align: center;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 8px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
    `;

    const title = document.createElement('h2');
    title.textContent = '💎 Sistema Abilità';
    title.style.cssText = `
      margin: 0 0 8px 0;
      color: rgba(255, 255, 255, 0.95);
      font-size: 24px;
      font-weight: 700;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      background: linear-gradient(135deg, #60a5fa, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    `;

    const pointsDisplay = document.createElement('div');
    pointsDisplay.style.cssText = `
      color: rgba(255, 255, 255, 0.8);
      font-size: 16px;
      font-weight: 600;
    `;
    pointsDisplay.textContent = `Punti Disponibili: ${this.skillsData.availablePoints} | Totale Guadagnati: ${this.skillsData.totalPoints}`;

    header.appendChild(title);
    header.appendChild(pointsDisplay);

    return header;
  }

  /**
   * Crea il contenitore delle categorie di abilità
   */
  private createCategoriesContainer(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      align-items: start;
    `;

    // Crea una sezione per ogni categoria
    Object.entries(this.skillsData.categories).forEach(([key, category]) => {
      const categorySection = this.createCategorySection(category);
      container.appendChild(categorySection);
    });

    return container;
  }

  /**
   * Crea una sezione per una categoria di abilità
   */
  private createCategorySection(category: SkillCategory): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    // Header della categoria
    const header = document.createElement('div');
    header.style.cssText = `
      text-align: center;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.3);
    `;

    const title = document.createElement('h3');
    title.textContent = category.name;
    title.style.cssText = `
      margin: 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    const description = document.createElement('p');
    description.textContent = category.description;
    description.style.cssText = `
      margin: 4px 0 0 0;
      color: rgba(148, 163, 184, 0.7);
      font-size: 12px;
      font-style: italic;
    `;

    header.appendChild(title);
    header.appendChild(description);
    section.appendChild(header);

    // Lista delle abilità
    category.skills.forEach(skill => {
      const skillElement = this.createSkillElement(skill);
      section.appendChild(skillElement);
    });

    return section;
  }

  /**
   * Crea un elemento per una singola abilità
   */
  private createSkillElement(skill: Skill): HTMLElement {
    const skillElement = document.createElement('div');
    skillElement.style.cssText = `
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: all 0.2s ease;
    `;

    skillElement.addEventListener('mouseenter', () => {
      skillElement.style.background = 'rgba(15, 23, 42, 0.8)';
      skillElement.style.borderColor = 'rgba(59, 130, 246, 0.3)';
    });

    skillElement.addEventListener('mouseleave', () => {
      skillElement.style.background = 'rgba(15, 23, 42, 0.6)';
      skillElement.style.borderColor = 'rgba(148, 163, 184, 0.15)';
    });

    // Icona dell'abilità
    const iconElement = document.createElement('span');
    iconElement.textContent = skill.icon;
    iconElement.style.cssText = `
      font-size: 24px;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    `;

    // Contenuto dell'abilità
    const contentElement = document.createElement('div');
    contentElement.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    const nameElement = document.createElement('div');
    nameElement.textContent = skill.name;
    nameElement.style.cssText = `
      color: rgba(255, 255, 255, 0.9);
      font-weight: 600;
      font-size: 14px;
    `;

    const descElement = document.createElement('div');
    descElement.textContent = skill.description;
    descElement.style.cssText = `
      color: rgba(148, 163, 184, 0.7);
      font-size: 11px;
      line-height: 1.3;
    `;

    const levelElement = document.createElement('div');
    levelElement.textContent = `Livello: ${skill.currentLevel}/${skill.maxLevel}`;
    levelElement.style.cssText = `
      color: rgba(255, 255, 255, 0.8);
      font-size: 12px;
      font-weight: 500;
    `;

    contentElement.appendChild(nameElement);
    contentElement.appendChild(descElement);
    contentElement.appendChild(levelElement);

    // Pulsante upgrade (se disponibile)
    if (skill.currentLevel < skill.maxLevel && this.skillsData.availablePoints >= skill.cost) {
      const upgradeButton = document.createElement('button');
      upgradeButton.textContent = `+ (${skill.cost}pts)`;
      upgradeButton.style.cssText = `
        background: linear-gradient(135deg, #10b981, #059669);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: white;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        align-self: flex-start;
      `;

      upgradeButton.addEventListener('mouseenter', () => {
        upgradeButton.style.background = 'linear-gradient(135deg, #059669, #047857)';
        upgradeButton.style.transform = 'scale(1.05)';
      });

      upgradeButton.addEventListener('mouseleave', () => {
        upgradeButton.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        upgradeButton.style.transform = 'scale(1)';
      });

      upgradeButton.addEventListener('click', () => {
        this.upgradeSkill(skill.id);
      });

      contentElement.appendChild(upgradeButton);
    }

    skillElement.appendChild(iconElement);
    skillElement.appendChild(contentElement);

    return skillElement;
  }

  /**
   * Gestisce l'upgrade di un'abilità
   */
  private upgradeSkill(skillId: string): void {
    // Trova l'abilità e la categoria
    for (const category of Object.values(this.skillsData.categories)) {
      const skill = category.skills.find(s => s.id === skillId);
      if (skill && skill.currentLevel < skill.maxLevel && this.skillsData.availablePoints >= skill.cost) {
        skill.currentLevel++;
        this.skillsData.availablePoints -= skill.cost;
        this.updateDisplay();
        break;
      }
    }
  }

  /**
   * Aggiorna i dati del pannello
   */
  update(data: PanelData): void {
    const skillsData = data as SkillsData;
    if (skillsData) {
      Object.assign(this.skillsData, skillsData);
      this.updateDisplay();
    }
  }

  /**
   * Aggiorna la visualizzazione
   */
  private updateDisplay(): void {
    // Ricrea il contenuto per riflettere i cambiamenti
    const newContent = this.createPanelContent();
    if (this.content.parentNode) {
      this.content.parentNode.replaceChild(newContent, this.content);
      this.content = newContent;
    }
  }

  /**
   * Callback quando il pannello viene mostrato
   */
  protected onShow(): void {
    // Potrebbe servire per aggiornare dati in tempo reale
  }

  /**
   * Callback quando il pannello viene nascosto
   */
  protected onHide(): void {
    // Potrebbe servire per salvare stato
  }
}
