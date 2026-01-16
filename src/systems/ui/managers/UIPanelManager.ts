import { UIManager } from '../../../presentation/ui/UIManager';
import { LeaderboardPanel } from '../../../presentation/ui/LeaderboardPanel';
import { QuestPanel } from '../../../presentation/ui/QuestPanel';
import { UpgradePanel } from '../../../presentation/ui/UpgradePanel';
import { getPanelConfig } from '../../../presentation/ui/PanelConfig';
import type { QuestSystem } from '../../quest/QuestSystem';
import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { PlayerSystem } from '../../player/PlayerSystem';
import type { ClientNetworkSystem } from '../../../multiplayer/client/ClientNetworkSystem';

/**
 * Manages UI panels (opening, closing, layering, content updates)
 */
export class UIPanelManager {
  private uiManager: UIManager;
  private upgradePanel: UpgradePanel | null = null;
  private questSystem: QuestSystem;
  private ecs: ECS;
  private playerSystem: PlayerSystem | null = null;
  private clientNetworkSystem: ClientNetworkSystem | null = null;

  constructor(
    ecs: ECS,
    questSystem: QuestSystem,
    playerSystem: PlayerSystem | null,
    clientNetworkSystem: ClientNetworkSystem | null
  ) {
    this.uiManager = new UIManager();
    this.questSystem = questSystem;
    this.ecs = ecs;
    this.playerSystem = playerSystem;
    this.clientNetworkSystem = clientNetworkSystem;
  }

  /**
   * Inizializza i pannelli UI
   */
  initializePanels(): void {
    // Crea e registra il pannello leaderboard
    const statsConfig = getPanelConfig('stats');
    const leaderboardPanel = new LeaderboardPanel(statsConfig, this.clientNetworkSystem || null);
    this.uiManager.registerPanel(leaderboardPanel);

    // Crea e registra il pannello delle quest
    const questConfig = getPanelConfig('quest');
    const questPanel = new QuestPanel(questConfig);
    this.uiManager.registerPanel(questPanel);

    // Crea e registra il pannello delle skills
    const upgradeConfig = getPanelConfig('upgrade');
    this.upgradePanel = new UpgradePanel(upgradeConfig, this.ecs, this.playerSystem || undefined, this.clientNetworkSystem || undefined);
    this.uiManager.registerPanel(this.upgradePanel);

    // Collega il pannello quest al sistema quest
    this.questSystem.setQuestPanel(questPanel);
  }

  /**
   * Imposta l'integrazione tra pannello quest e sistema quest
   */
  setupQuestPanelIntegration(updatePanelsCallback: () => void): void {
    const questPanel = this.uiManager.getPanel('quest-panel') as QuestPanel;
    if (questPanel) {
      // Sovrascrivi il metodo show per aggiornare dati prima di mostrare
      const originalShow = questPanel.show.bind(questPanel);
      questPanel.show = () => {
        originalShow();
        // Aggiorna l'UI con i dati attuali delle quest
        setTimeout(() => updatePanelsCallback(), 100);
      };
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
   * Aggiorna i pannelli che supportano aggiornamenti real-time
   */
  updateRealtimePanels(deltaTime: number): void {
    // Aggiorna pannello Upgrade se ha il metodo updateECS
    const upgradePanel = this.uiManager.getPanel('upgrade-panel');
    if (upgradePanel && typeof (upgradePanel as any).updateECS === 'function') {
      (upgradePanel as any).updateECS(deltaTime);
    }

    // Altri pannelli possono essere aggiunti qui se necessario
  }

  /**
   * Imposta il PlayerSystem
   */
  setPlayerSystem(playerSystem: PlayerSystem): void {
    this.playerSystem = playerSystem;
    // Aggiorna anche i pannelli che ne hanno bisogno
    if (this.upgradePanel) {
      this.upgradePanel.setPlayerSystem(playerSystem);
      if (this.clientNetworkSystem) {
        this.upgradePanel.setClientNetworkSystem(this.clientNetworkSystem);
      }
    }
  }

  /**
   * Imposta il ClientNetworkSystem
   */
  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem): void {
    this.clientNetworkSystem = clientNetworkSystem;

    // Aggiorna anche i pannelli che ne hanno bisogno
    if (this.upgradePanel) {
      this.upgradePanel.setClientNetworkSystem(clientNetworkSystem);
    }

    // Aggiorna leaderboard panel se esiste
    const leaderboardPanel = this.uiManager.getPanel('leaderboard');
    if (leaderboardPanel && typeof (leaderboardPanel as any).setClientNetworkSystem === 'function') {
      (leaderboardPanel as any).setClientNetworkSystem(clientNetworkSystem);
    }
  }

  /**
   * Resetta tutti gli stati di progresso degli upgrade nel UpgradePanel
   */
  resetAllUpgradeProgress(): void {
    if (this.upgradePanel && typeof this.upgradePanel.resetUpgradeProgress === 'function') {
      this.upgradePanel.resetUpgradeProgress();
    }
  }

  /**
   * Ottiene il pannello Upgrade
   */
  getUpgradePanel(): UpgradePanel | null {
    return this.uiManager.getPanel('upgrade-panel') as UpgradePanel;
  }

  /**
   * Restituisce l'UIManager
   */
  getUIManager(): UIManager {
    return this.uiManager;
  }
}
