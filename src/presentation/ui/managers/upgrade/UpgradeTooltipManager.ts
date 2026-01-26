/**
 * Manages tooltips and informational popups for the upgrade panel
 */
export class UpgradeTooltipManager {
  private tooltipElement: HTMLElement | null = null;

  constructor(private readonly container: HTMLElement) { }

  /**
   * Gets the short description of a statistic
   */
  getStatDescription(statType: string): string {
    switch (statType) {
      case 'hp': return 'Hull integrity. More HP = more survival.';
      case 'shield': return 'Energy barrier. Recharges over time.';
      case 'speed': return 'Movement velocity. Better evasion.';
      case 'damage': return 'Laser power. Faster kills.';
      case 'missileDamage': return 'Missile impact. Massive burst damage.';
      default: return '';
    }
  }

  /**
   * Shows an explanation of the selected statistic
   */
  showStatExplanation(statName: string, statType: string, buttonElement: HTMLElement): void {
    // Hide existing tooltip if present
    this.hideTooltip();

    let title = '';
    let description = '';

    switch (statType) {
      case 'hp':
        title = 'HULL (HP)';
        description = 'Represents your ship\'s structural integrity. When it reaches 0, the ship is destroyed. Upgrades increase maximum hull points. More HP = more survival chances.';
        break;
      case 'shield':
        title = 'ENERGY SHIELD';
        description = 'Protects the ship from damage before HP is affected. Recharges automatically over time. Upgrades increase maximum capacity. More shields = better protection.';
        break;
      case 'speed':
        title = 'MOVEMENT SPEED';
        description = 'Determines how fast the ship moves. Affects maneuverability in combat. Upgrades improve maximum velocity. More speed = better evasion.';
        break;
      case 'damage':
        title = 'LASER DAMAGE';
        description = 'Increases weapon damage output. Each upgrade boosts damage dealt to enemies, allowing faster combat resolution.';
        break;
      case 'missileDamage':
        title = 'MISSILE DAMAGE';
        description = 'Increases the explosive power of your auto-firing missiles. Upgrades boost impact damage, perfect for taking down larger ships.';
        break;
    }

    // Crea il tooltip - sfondo scuro con glass effect
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'stat-tooltip';
    this.tooltipElement.style.cssText = `
      position: absolute;
      background: rgba(15, 20, 30, 0.9);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 15px;
      padding: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      z-index: 1000;
      max-width: 280px;
      font-size: 14px;
      line-height: 1.5;
      pointer-events: auto;
    `;

    // Contenuto del tooltip
    this.tooltipElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
        <h4 style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
          ${title}
        </h4>
        <button class="tooltip-close" style="
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          cursor: pointer;
          font-size: 14px;
          padding: 0;
          line-height: 1;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s ease;
        ">×</button>
      </div>
      <p style="margin: 0; color: rgba(200, 210, 230, 0.95); font-size: 12px; line-height: 1.6;">
        ${description}
      </p>
    `;

    // Position tooltip near the button
    const buttonRect = buttonElement.getBoundingClientRect();
    const panelRect = this.container.getBoundingClientRect();

    // Position above button if there's space, otherwise below
    const spaceAbove = buttonRect.top - panelRect.top;
    const tooltipHeight = 120; // Approximate height

    if (spaceAbove > tooltipHeight) {
      // Position above
      this.tooltipElement.style.top = `${buttonRect.top - panelRect.top - tooltipHeight - 10}px`;
    } else {
      // Position below
      this.tooltipElement.style.top = `${buttonRect.bottom - panelRect.top + 10}px`;
    }

    this.tooltipElement.style.left = `${buttonRect.left - panelRect.left}px`;

    // Add tooltip to container
    this.container.appendChild(this.tooltipElement);

    // Event listener to close
    const closeButton = this.tooltipElement.querySelector('.tooltip-close') as HTMLElement;
    closeButton.addEventListener('click', () => this.hideTooltip());

    // Chiudi automaticamente dopo 8 secondi
    setTimeout(() => this.hideTooltip(), 8000);

    // Chiudi quando si clicca fuori
    const handleOutsideClick = (e: MouseEvent) => {
      if ((!this.tooltipElement || !this.tooltipElement.contains(e.target as Node)) && !buttonElement.contains(e.target as Node)) {
        this.hideTooltip();
        document.removeEventListener('click', handleOutsideClick);
      }
    };

    // Wait a bit before adding event listener to avoid immediate closing
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 10);
  }

  /**
   * Hides the tooltip if present
   */
  hideTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }
  }

  /**
   * Shows a popup when there are insufficient resources
   */
  showInsufficientResourcesPopup(message: string): void {
    // Check if panel is still valid and visible
    if (!this.container || !document.body.contains(this.container)) {
      return;
    }

    // Remove existing popup if present
    this.hideInsufficientResourcesPopup();

    // Create the popup
    const popup = document.createElement('div');
    popup.id = 'insufficient-resources-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 25px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      z-index: 2000;
      max-width: 400px;
      font-family: 'Courier New', monospace;
    `;

    // Titolo
    const title = document.createElement('h3');
    title.textContent = 'INSUFFICIENT RESOURCES';
    title.style.cssText = `
      margin: 0 0 16px 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 18px;
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;

    // Messaggio
    const messageElement = document.createElement('p');
    messageElement.style.cssText = `
      margin: 0 0 20px 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      line-height: 1.5;
      text-align: center;
      font-weight: 400;
    `;

    messageElement.textContent = message;

    // OK button
    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.style.cssText = `
      display: block;
      margin: 0 auto;
      padding: 10px 24px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    okButton.addEventListener('mouseenter', () => {
      okButton.style.background = 'rgba(255, 255, 255, 0.2)';
      okButton.style.borderColor = 'rgba(255, 255, 255, 0.4)';
      okButton.style.transform = 'translateY(-1px)';
    });

    okButton.addEventListener('mouseleave', () => {
      okButton.style.background = 'rgba(255, 255, 255, 0.1)';
      okButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      okButton.style.transform = 'translateY(0)';
    });

    okButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideInsufficientResourcesPopup();
    });

    // Assemble the popup
    popup.appendChild(title);
    popup.appendChild(messageElement);
    popup.appendChild(okButton);

    // Add overlay
    const overlay = document.createElement('div');
    overlay.id = 'insufficient-resources-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      z-index: 1999;
    `;

    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideInsufficientResourcesPopup();
    });

    // Add to DOM
    document.body.appendChild(overlay);
    document.body.appendChild(popup);

    // Auto-hide after 8 seconds
    setTimeout(() => {
      this.hideInsufficientResourcesPopup();
    }, 8000);
  }

  /**
   * Hides the insufficient resources popup
   */
  hideInsufficientResourcesPopup(): void {
    const popup = document.getElementById('insufficient-resources-popup');
    const overlay = document.getElementById('insufficient-resources-overlay');

    if (popup) popup.remove();
    if (overlay) overlay.remove();
  }
}
