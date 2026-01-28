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
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(20px) saturate(160%);
      -webkit-backdrop-filter: blur(20px) saturate(160%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 25px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    // Hide scrollbar for webkit browsers
    const style = document.createElement('style');
    style.textContent = `.skills-content::-webkit-scrollbar { display: none; }`;
    content.appendChild(style);

    // Header Section (Title + Subtitle + Close)
    const headerSection = document.createElement('div');
    headerSection.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    `;

    const titleGroup = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'UPGRADE STATION';
    title.style.cssText = `
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 3px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'ENHANCE SHIP CAPABILITIES';
    subtitle.style.cssText = `
      margin: 4px 0 8px 0;
      color: rgba(255, 255, 255, 0.6);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
    `;

    titleGroup.appendChild(title);
    titleGroup.appendChild(subtitle);

    // Unified Close Button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: none;
      color: rgba(255, 255, 255, 0.6);
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(239, 68, 68, 0.2)';
      closeButton.style.color = '#ef4444';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.05)';
      closeButton.style.color = 'rgba(255, 255, 255, 0.6)';
    });

    // Note: hide() callback will be set by UpgradePanel

    headerSection.appendChild(titleGroup);
    headerSection.appendChild(closeButton);
    content.appendChild(headerSection);

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
