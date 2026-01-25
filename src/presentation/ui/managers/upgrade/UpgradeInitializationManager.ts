import { UpgradeRenderer } from './UpgradeRenderer';
import { UpgradeStatsManager } from './UpgradeStatsManager';

/**
 * Manages panel initialization and lifecycle
 */
export class UpgradeInitializationManager {
  private realtimeUpdateActive: boolean = false;

  constructor(
    private readonly renderer: UpgradeRenderer,
    private readonly statsManager: UpgradeStatsManager,
    private readonly container: HTMLElement | null,
    private readonly isPanelVisible: () => boolean
  ) { }

  /**
   * Creates the upgrade panel content
   */
  createPanelContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'skills-content';
    content.style.cssText = `
      padding: 24px;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 16px;
      position: relative;
      overflow: hidden;
    `;
    // Hide scrollbar for webkit browsers
    const style = document.createElement('style');
    style.textContent = `.skills-content::-webkit-scrollbar { display: none; }`;
    content.appendChild(style);

    // Close button "X" in the top right corner
    const closeButton = document.createElement('button');
    closeButton.textContent = 'X';
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

    // Note: hide() callback will be set by UpgradePanel
    content.appendChild(closeButton);

    // Header con gradiente
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
    title.textContent = 'Upgrade';
    title.style.cssText = `
      margin: 0;
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Upgrade system';
    subtitle.style.cssText = `
      margin: 4px 0 8px 0;
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      font-weight: 400;
    `;

    header.appendChild(title);
    header.appendChild(subtitle);
    content.appendChild(header);

    // Contenitore principale per le statistiche
    const statsContainer = document.createElement('div');
    statsContainer.style.cssText = `
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // Sezione Upgrade con statistiche integrate
    const upgradeSection = this.renderer.createUpgradeSection();

    statsContainer.appendChild(upgradeSection);

    content.appendChild(statsContainer);

    return content;
  }

  /**
   * Callback when the panel is shown
   */
  onShow(hideTooltip: () => void): void {
    // Reset all cards to normal state
    this.resetCards();

    // Update immediately when shown
    this.statsManager.updateStats();

    // And continue updating every frame while visible
    this.startUpdates();
  }

  /**
   * Callback when the panel is hidden
   */
  onHide(hideTooltip: () => void): void {
    // Closes any open tooltips
    hideTooltip();
    // Stop real-time updates when hidden to save resources
    this.stopUpdates();
  }

  /**
   * Resets all upgrade cards to normal state (not description)
   */
  resetCards(): void {
    if (!this.container) return;

    const cards = this.container.querySelectorAll('.upgrade-card-container');
    cards.forEach((card) => {
      const htmlCard = card as HTMLElement;
      htmlCard.dataset.showingDesc = 'false';
      const normalContent = htmlCard.querySelector('.card-normal-content') as HTMLElement;
      const descContent = htmlCard.querySelector('.card-desc-content') as HTMLElement;
      const costLabel = htmlCard.querySelector('.upgrade-cost-label') as HTMLElement;
      const upgradeBtn = htmlCard.querySelector('.ui-upgrade-btn') as HTMLElement;
      if (normalContent) normalContent.style.display = 'flex';
      if (descContent) descContent.style.display = 'none';
      if (costLabel) costLabel.style.display = 'block';
      if (upgradeBtn) upgradeBtn.style.display = 'block';
    });
  }

  /**
   * Starts real-time updates when the panel is visible
   */
  startUpdates(): void {
    this.realtimeUpdateActive = true;
  }

  /**
   * Stops real-time updates when the panel is hidden
   */
  stopUpdates(): void {
    this.realtimeUpdateActive = false;
  }

  /**
   * Update method called by the ECS system every frame
   */
  update(deltaTime: number): void {
    // Update statistics only if panel is active (visible or has active real-time updates)
    if (this.container && (this.isPanelVisible() || this.realtimeUpdateActive)) {
      this.statsManager.updateStats();
    }
  }

  /**
   * Sets the close button callback
   */
  setCloseButtonCallback(closeButton: HTMLElement, onClose: () => void): void {
    closeButton.addEventListener('click', onClose);
  }
}
