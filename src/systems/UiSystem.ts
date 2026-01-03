import { System } from '../infrastructure/ecs/System';
import { ECS } from '../infrastructure/ecs/ECS';
import { UIManager } from '../ui/UIManager';
import { PlayerHUD } from '../ui/PlayerHUD';
import { PlayerStatsPanel } from '../ui/PlayerStatsPanel';
import { QuestPanel } from '../ui/QuestPanel';
import { getPanelConfig } from '../ui/PanelConfig';
import { QuestSystem } from './QuestSystem';

/**
 * Sistema di orchestrazione per la gestione dell'interfaccia utente
 * Coordina UIManager, HUD e pannelli UI
 */
export class UiSystem extends System {
  private uiManager: UIManager;
  private playerHUD: PlayerHUD;
  private questSystem: QuestSystem;
  private playerNicknameElement: HTMLElement | null = null;
  private mainTitleElement: HTMLElement | null = null;

  constructor(ecs: ECS, questSystem: QuestSystem) {
    super(ecs);
    this.uiManager = new UIManager();
    this.playerHUD = new PlayerHUD();
    this.questSystem = questSystem;
  }

  /**
   * Inizializza il sistema UI
   */
  initialize(): void {
    this.initializePanels();
    this.setupQuestPanelIntegration();
    console.log('UI System initialized with player stats and quest panels');
  }

  /**
   * Inizializza i pannelli UI
   */
  private initializePanels(): void {
    // Crea e registra il pannello delle statistiche giocatore
    const statsConfig = getPanelConfig('stats');
    const statsPanel = new PlayerStatsPanel(statsConfig);
    this.uiManager.registerPanel(statsPanel);

    // Crea e registra il pannello delle quest
    const questConfig = getPanelConfig('quest');
    const questPanel = new QuestPanel(questConfig);
    this.uiManager.registerPanel(questPanel);

    // Collega il pannello quest al sistema quest
    this.questSystem.setQuestPanel(questPanel);
  }

  /**
   * Imposta l'integrazione tra pannello quest e sistema quest
   */
  private setupQuestPanelIntegration(): void {
    const questPanel = this.uiManager.getPanel('quest-panel') as QuestPanel;
    if (questPanel) {
      // Sovrascrivi il metodo show per aggiornare dati prima di mostrare
      const originalShow = questPanel.show.bind(questPanel);
      questPanel.show = () => {
        originalShow();
        // Aggiorna l'UI con i dati attuali delle quest
        setTimeout(() => this.updatePanels(), 100);
      };
    }
  }

  /**
   * Mostra le informazioni del giocatore
   */
  showPlayerInfo(): void {
    this.playerHUD.show();
  }

  /**
   * Nasconde le informazioni del giocatore
   */
  hidePlayerInfo(): void {
    this.playerHUD.hide();
  }

  /**
   * Mostra l'HUD espanso
   */
  showExpandedHud(): void {
    this.playerHUD.expand();
  }

  /**
   * Nasconde l'HUD espanso
   */
  hideExpandedHud(): void {
    this.playerHUD.collapse();
  }

  /**
   * Imposta il listener per il toggle dell'HUD
   */
  setupHudToggle(): void {
    const toggleHandler = (event: KeyboardEvent) => {
      if (event.key === 'h' || event.key === 'H') {
        this.toggleHud();
      }
    };

    document.addEventListener('keydown', toggleHandler);

    // Store reference for cleanup
    (this as any).hudToggleListener = toggleHandler;
  }

  /**
   * Toggle dell'HUD
   */
  private toggleHud(): void {
    if (this.playerHUD.isExpanded()) {
      this.hideExpandedHud();
    } else {
      this.showExpandedHud();
    }
  }

  /**
   * Crea l'elemento nickname del giocatore
   */
  createPlayerNicknameElement(nickname: string): void {
    if (this.playerNicknameElement) return;

    this.playerNicknameElement = document.createElement('div');
    this.playerNicknameElement.id = 'player-nickname';
    this.playerNicknameElement.style.cssText = `
      position: absolute;
      color: #60a5fa;
      font-size: 12px;
      font-family: 'Courier New', monospace;
      text-shadow: 0 0 3px rgba(96, 165, 250, 0.5);
      pointer-events: none;
      z-index: 1000;
      user-select: none;
    `;

    this.updatePlayerNicknameContent(nickname);
    document.body.appendChild(this.playerNicknameElement);
  }

  /**
   * Aggiorna il contenuto del nickname
   */
  updatePlayerNicknameContent(nickname: string): void {
    if (this.playerNicknameElement) {
      this.playerNicknameElement.textContent = nickname;
    }
  }

  /**
   * Aggiorna la posizione del nickname del giocatore basata sulla posizione world
   */
  updatePlayerNicknamePosition(worldX: number, worldY: number, camera: any, canvasSize: any): void {
    if (!this.playerNicknameElement) return;

    // Converte coordinate mondo in coordinate schermo
    const screenPos = camera.worldToScreen(worldX, worldY, canvasSize.width, canvasSize.height);

    // Posiziona il nickname sotto la nave
    const nicknameX = screenPos.x - this.playerNicknameElement.offsetWidth / 2;
    const nicknameY = screenPos.y + 45;

    this.playerNicknameElement.style.left = `${nicknameX}px`;
    this.playerNicknameElement.style.top = `${nicknameY}px`;
  }

  /**
   * Rimuove l'elemento nickname
   */
  removePlayerNicknameElement(): void {
    if (this.playerNicknameElement) {
      document.body.removeChild(this.playerNicknameElement);
      this.playerNicknameElement = null;
    }
  }

  /**
   * Nasconde il titolo principale
   */
  hideMainTitle(): void {
    this.mainTitleElement = document.getElementById('main-title');
    if (this.mainTitleElement) {
      this.mainTitleElement.style.display = 'none';
    }
  }

  /**
   * Mostra il titolo principale
   */
  showMainTitle(): void {
    if (this.mainTitleElement) {
      this.mainTitleElement.style.display = 'block';
    }
  }

  /**
   * Aggiorna tutti i pannelli UI
   */
  updatePanels(): void {
    const questData = this.questSystem.getQuestUIData();
    if (questData) {
      // Trigger update event
      const event = new CustomEvent('updateQuestPanel', { detail: questData });
      document.dispatchEvent(event);
    }
  }

  /**
   * Restituisce l'UIManager
   */
  getUIManager(): UIManager {
    return this.uiManager;
  }

  /**
   * Restituisce il PlayerHUD
   */
  getPlayerHUD(): PlayerHUD {
    return this.playerHUD;
  }

  update(deltaTime: number): void {
    // Aggiornamenti periodici dell'UI se necessari
    // Per ora delega agli altri sistemi
  }

  /**
   * Cleanup delle risorse UI
   */
  destroy(): void {
    this.removePlayerNicknameElement();
    this.showMainTitle();

    // Rimuovi event listeners
    if ((this as any).hudToggleListener) {
      document.removeEventListener('keydown', (this as any).hudToggleListener);
    }
  }
}
