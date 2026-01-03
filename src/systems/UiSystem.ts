import { System } from '../infrastructure/ecs/System';
import { ECS } from '../infrastructure/ecs/ECS';
import { UIManager } from '../presentation/ui/UIManager';
import { PlayerHUD } from '../presentation/ui/PlayerHUD';
import { PlayerStatsPanel } from '../presentation/ui/PlayerStatsPanel';
import { QuestPanel } from '../presentation/ui/QuestPanel';
import { SkillsPanel } from '../presentation/ui/SkillsPanel';
import { getPanelConfig } from '../presentation/ui/PanelConfig';
import { QuestSystem } from './QuestSystem';

/**
 * Sistema di orchestrazione per la gestione dell'interfaccia utente
 * Coordina UIManager, HUD e pannelli UI
 */
export class UiSystem extends System {
  private uiManager: UIManager;
  private playerHUD: PlayerHUD;
  private questSystem: QuestSystem;
  private economySystem: any = null;
  private playerNicknameElement: HTMLElement | null = null;
  private mainTitleElement: HTMLElement | null = null;

  constructor(ecs: ECS, questSystem: QuestSystem) {
    super(ecs);
    this.uiManager = new UIManager();
    this.playerHUD = new PlayerHUD();
    this.questSystem = questSystem;
  }

  /**
   * Imposta il riferimento all'EconomySystem
   */
  setEconomySystem(economySystem: any): void {
    this.economySystem = economySystem;
  }

  /**
   * Inizializza il sistema UI
   */
  initialize(): void {
    this.initializePanels();
    this.setupQuestPanelIntegration();
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

    // Crea e registra il pannello delle abilità
    const skillsConfig = getPanelConfig('skills');
    const skillsPanel = new SkillsPanel(skillsConfig);
    this.uiManager.registerPanel(skillsPanel);

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
    // Ottieni i dati economici dal sistema
    const economyData = this.economySystem?.getPlayerEconomyStatus();

    if (economyData) {
      // Prepara i dati per l'HUD
      const hudData = {
        level: economyData.level,
        credits: economyData.credits,
        cosmos: economyData.cosmos,
        experience: economyData.experience,
        expForNextLevel: economyData.expForNextLevel,
        honor: economyData.honor
      };

      // Aggiorna e mostra l'HUD
      this.playerHUD.updateData(hudData);
      this.playerHUD.show();
    } else {
      // Mostra comunque l'HUD con valori di default
      const defaultData = {
        level: 1,
        credits: 0,
        cosmos: 0,
        experience: 0,
        expForNextLevel: 100,
        honor: 0
      };
      this.playerHUD.updateData(defaultData);
      this.playerHUD.show();
    }
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
    this.playerNicknameElement.id = 'player-nickname-uisystem';
    this.playerNicknameElement.style.cssText = `
      position: fixed;
      color: rgba(255, 255, 255, 0.9);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-weight: 500;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      user-select: none;
      z-index: 50;
      text-align: center;
      line-height: 1.4;
      white-space: nowrap;
      border-radius: 5px;
    `;

    this.updatePlayerNicknameContent(nickname);
    document.body.appendChild(this.playerNicknameElement);

  }

  /**
   * Aggiorna il contenuto del nickname
   */
  updatePlayerNicknameContent(nickname: string): void {
    if (this.playerNicknameElement) {
      // Formatta il nickname su due righe: nome sopra, rank sotto
      const parts = nickname.split('\n');
      this.playerNicknameElement.innerHTML = `
        <div style="font-size: 14px; font-weight: 600;">${parts[0] || 'Commander'}</div>
        <div style="font-size: 12px; font-weight: 400; opacity: 0.8;">${parts[1] || '[Recruit]'}</div>
      `;
    }
  }

  /**
   * Aggiorna la posizione del nickname del giocatore basata sulla posizione world
   */
  updatePlayerNicknamePosition(worldX: number, worldY: number, camera: any, canvasSize: any): void {
    if (!this.playerNicknameElement) return;

    // Converte coordinate mondo in coordinate schermo
    const screenPos = camera.worldToScreen(worldX, worldY, canvasSize.width, canvasSize.height);

    // Forza la visibilità e ricalcola dimensioni
    this.playerNicknameElement.style.display = 'block';

    // Posiziona il nickname centrato orizzontalmente sotto la nave (10px sotto per essere visibile)
    const nicknameX = screenPos.x - this.playerNicknameElement.offsetWidth / 2;
    const nicknameY = screenPos.y + 60; // Sotto la nave

    this.playerNicknameElement.style.left = `${nicknameX}px`;
    this.playerNicknameElement.style.top = `${nicknameY}px`;
    this.playerNicknameElement.style.transform = 'none';
    this.playerNicknameElement.style.display = 'block';


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
