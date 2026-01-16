import { BasePanel } from './UIManager';
import type { PanelConfig } from './PanelConfig';
import { ECS } from '../../infrastructure/ecs/ECS';
import { PlayerSystem } from '../../systems/player/PlayerSystem';
import { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import type { PanelData } from './UIManager';

// Modular architecture managers
import { UpgradeValidationManager } from './managers/upgrade/UpgradeValidationManager';
import { UpgradeTooltipManager } from './managers/upgrade/UpgradeTooltipManager';
import { UpgradeStatsManager } from './managers/upgrade/UpgradeStatsManager';
import { UpgradeRenderer } from './managers/upgrade/UpgradeRenderer';
import { UpgradeInitializationManager } from './managers/upgrade/UpgradeInitializationManager';
import { UpgradeActionManager } from './managers/upgrade/UpgradeActionManager';

/**
 * UpgradePanel - Panel to display player statistics and manage upgrades
 * Uses modular architecture with separate managers for different responsibilities
 */
export class UpgradePanel extends BasePanel {
  private ecs: ECS;
  private playerSystem: PlayerSystem | null = null;
  private clientNetworkSystem: ClientNetworkSystem | null = null;

  // Modular architecture managers (lazy initialization due to BasePanel calling createPanelContent in constructor)
  private validationManager!: UpgradeValidationManager;
  private tooltipManager!: UpgradeTooltipManager;
  private statsManager!: UpgradeStatsManager;
  private renderer!: UpgradeRenderer;
  private initManager!: UpgradeInitializationManager;
  private actionManager!: UpgradeActionManager;
  private managersInitialized: boolean = false;

  constructor(config: PanelConfig, ecs: ECS, playerSystem?: PlayerSystem, clientNetworkSystem?: ClientNetworkSystem) {
    super(config);
    this.ecs = ecs;
    this.playerSystem = playerSystem || null;
    this.clientNetworkSystem = clientNetworkSystem || null;
  }

  /**
   * Initializes managers (lazy initialization)
   * Called when needed, after container is available
   */
  private initializeManagers(): void {
    if (this.managersInitialized) return;

    // Initialize managers with dependency injection
    this.validationManager = new UpgradeValidationManager(this.ecs, this.playerSystem);
    
    // Initialize managers that need container (available after super call)
    this.tooltipManager = new UpgradeTooltipManager(this.container);
    this.statsManager = new UpgradeStatsManager(
      this.ecs,
      this.playerSystem,
      this.container,
      (statType, level) => this.validationManager.calculateUpgradeCost(statType, level)
    );

    // Initialize action manager first (needed by renderer)
    this.actionManager = new UpgradeActionManager(
      this.ecs,
      this.playerSystem,
      this.clientNetworkSystem,
      (statType) => this.validationManager.isUpgradeInProgress(statType),
      (statType, inProgress) => this.validationManager.setUpgradeInProgress(statType, inProgress)
    );

    // Initialize renderer with dependency injection (avoids circular dependencies)
    this.renderer = new UpgradeRenderer(
      this.ecs,
      this.playerSystem,
      (statType, level) => this.validationManager.calculateUpgradeCost(statType, level),
      (statType) => this.statsManager.getInitialStatValue(statType),
      (statType) => this.tooltipManager.getStatDescription(statType),
      (upgradeType) => this.actionManager.requestUpgrade(upgradeType),
      (statName, statType, buttonElement) => this.tooltipManager.showStatExplanation(statName, statType, buttonElement)
    );

    // Initialize initialization manager (orchestrates renderer and stats)
    this.initManager = new UpgradeInitializationManager(
      this.renderer,
      this.statsManager,
      this.container,
      () => this.isPanelVisible()
    );

    this.managersInitialized = true;
  }

  update(data: PanelData): void {
    this.initializeManagers();
    this.statsManager.updateStats();
  }

  /**
   * Sets the reference to PlayerSystem
   */
  setPlayerSystem(playerSystem: PlayerSystem): void {
    this.playerSystem = playerSystem;
    this.initializeManagers();
    // Update manager references
    (this.validationManager as any).playerSystem = playerSystem;
    (this.statsManager as any).playerSystem = playerSystem;
    (this.renderer as any).playerSystem = playerSystem;
    (this.actionManager as any).playerSystem = playerSystem;
    // Update statistics immediately when we receive the reference
    this.statsManager.updateStats();
  }

  /**
   * Sets the reference to ClientNetworkSystem
   */
  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem): void {
    this.clientNetworkSystem = clientNetworkSystem;
    this.initializeManagers();
    (this.actionManager as any).clientNetworkSystem = clientNetworkSystem;
  }

  /**
   * Creates the upgrade panel content
   */
  protected createPanelContent(): HTMLElement {
    // Initialize managers if not already done (lazy initialization)
    this.initializeManagers();
    
    const content = this.initManager.createPanelContent();
    // Set close button callback
    const closeButton = content.querySelector('button') as HTMLElement;
    if (closeButton) {
      this.initManager.setCloseButtonCallback(closeButton, () => this.hide());
    }
    return content;
  }

  /**
   * Updates statistics from the player
   */
  public updatePlayerStats(): void {
    this.initializeManagers();
    this.statsManager.updateStats();
  }

  /**
   * Resets all upgrade progress states (called when we receive response from server)
   */
  public resetUpgradeProgress(): void {
    this.initializeManagers();
    this.validationManager.resetUpgradeProgress();
  }

  /**
   * Shows a popup when there are insufficient resources
   */
  public showInsufficientResourcesPopup(message: string): void {
    this.initializeManagers();
    this.tooltipManager.showInsufficientResourcesPopup(message);
  }

  /**
   * Hides the insufficient resources popup
   */
  public hideInsufficientResourcesPopup(): void {
    this.initializeManagers();
    this.tooltipManager.hideInsufficientResourcesPopup();
  }

  /**
   * Callback when the panel is shown
   */
  protected onShow(): void {
    this.initializeManagers();
    this.initManager.onShow(() => this.tooltipManager.hideTooltip());
  }

  /**
   * Callback when the panel is hidden
   */
  protected onHide(): void {
    this.initializeManagers();
    this.initManager.onHide(() => this.tooltipManager.hideTooltip());
  }

  /**
   * Update method called by the ECS system every frame
   */
  updateECS(deltaTime: number): void {
    this.initializeManagers();
    this.initManager.update(deltaTime);
  }

  // ========== REMOVED METHODS - Now in managers ==========
  // All private methods have been extracted to managers:
  // - createStatsSection() -> UpgradeRenderer.createStatsSection()
  // - calculateUpgradeCost() -> UpgradeValidationManager.calculateUpgradeCost()
  // - createUpgradeSection() -> UpgradeRenderer.createUpgradeSection()
  // - createUpgradeCard() -> UpgradeRenderer.createUpgradeCard()
  // - getStatDescription() -> UpgradeTooltipManager.getStatDescription()
  // - createStatUpgradeButton() -> UpgradeRenderer.createStatUpgradeButton() [deprecated]
  // - getInitialStatValue() -> UpgradeStatsManager.getInitialStatValue()
  // - updateUpgradeButtons() -> UpgradeStatsManager.updateButtons()
  // - resetUpgradeCards() -> UpgradeInitializationManager.resetCards()
  // - upgradeStat() -> UpgradeActionManager.requestUpgrade()
  // - updatePlayerPhysicalStats() -> UpgradeStatsManager.updatePlayerPhysicalStats() [deprecated]
  // - showStatExplanation() -> UpgradeTooltipManager.showStatExplanation()
  // - hideTooltip() -> UpgradeTooltipManager.hideTooltip()
  // - isUpgradeInProgress() -> UpgradeValidationManager.isUpgradeInProgress()
  // - setUpgradeInProgress() -> UpgradeValidationManager.setUpgradeInProgress()
  // - rollbackUpgrade() -> UpgradeValidationManager.rollbackUpgrade()
  // - startRealtimeUpdates() -> UpgradeInitializationManager.startUpdates()
  // - stopRealtimeUpdates() -> UpgradeInitializationManager.stopUpdates()
}
