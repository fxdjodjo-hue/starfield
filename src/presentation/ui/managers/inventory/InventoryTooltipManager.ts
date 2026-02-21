import { ItemSlot, type Item } from '../../../../config/ItemConfig';


/**
 * Manages custom tooltips for the ship/inventory panel
 */
export class InventoryTooltipManager {
  private tooltipElement: HTMLElement | null = null;

  constructor(private readonly container: HTMLElement) { }

  /**
   * Shows a custom tooltip for a generic inventory item
   */
  showItemTooltip(item: Item, count: number, targetElement: HTMLElement): void {
    const statsHtml = this.formatItemStats(item);
    const content = `
      <div style="display: flex; flex-direction: column; gap: 4px; text-align: center; align-items: center;">
        <div style="color: #ffffff; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">
          ${item.name}
        </div>
        <div style="color: ${this.getRarityColor(item.rarity)}; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
          ${item.rarity}
        </div>
        ${statsHtml ? `<div style="margin-top: 2px;">${statsHtml}</div>` : ''}
        <div style="margin-top: 2px; color: rgba(255, 255, 255, 0.5); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
          Click to Equip
        </div>
      </div>
    `;

    this.showTooltip(content, targetElement);
  }


  /**
   * Shows a custom tooltip for ammo or missiles
   */
  showTierTooltip(type: 'Ammo' | 'Missile', tier: string, count: number, targetElement: HTMLElement, isSelected: boolean = false): void {
    const color = type === 'Missile' ? '#f472b6' : (isSelected ? '#7dd3fc' : '#e2e8f0');
    const content = `
      <div style="display: flex; flex-direction: column; gap: 4px; text-align: center; align-items: center;">
        <div style="color: ${color}; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px;">
          ${type} ${tier.toUpperCase()}
        </div>
        <div style="color: rgba(255, 255, 255, 0.6); font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
          ${type === 'Missile' ? 'Ordnance' : (isSelected ? 'Active Tier' : 'Reserve')}
        </div>
        <div style="margin-top: 2px; color: rgba(255, 255, 255, 0.5); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
          Details
        </div>
      </div>
    `;

    this.showTooltip(content, targetElement);
  }


  private formatItemStats(item: Item): string {
    if (!item.stats) return '';
    const stats: string[] = [];
    if (item.stats.hpBonus) stats.push(`<span style="color: #4ade80;">+${Math.round(item.stats.hpBonus * 100)}% Hull</span>`);
    if (item.stats.shieldBonus) stats.push(`<span style="color: #60a5fa;">+${Math.round(item.stats.shieldBonus * 100)}% Shield</span>`);
    if (item.stats.damageBonus) stats.push(`<span style="color: #fb923c;">+${Math.round(item.stats.damageBonus * 100)}% Laser</span>`);
    if (item.stats.missileBonus) stats.push(`<span style="color: #f472b6;">+${Math.round(item.stats.missileBonus * 100)}% Missile</span>`);
    if (item.stats.speedBonus) stats.push(`<span style="color: #e879f9;">+${Math.round(item.stats.speedBonus * 100)}% Speed</span>`);

    return stats.length > 0 ? `<div style="display: flex; flex-direction: column; gap: 2px; font-size: 9px; font-weight: 800;">${stats.join('')}</div>` : '';
  }


  private getRarityColor(rarity: string): string {
    switch (rarity) {
      case 'UNCOMMON': return '#4ade80';
      case 'RARE': return '#3b82f6';
      case 'EPIC': return '#a855f7';
      default: return 'rgba(255, 255, 255, 0.5)';
    }
  }

  private showTooltip(contentHtml: string, targetElement: HTMLElement): void {
    this.hideTooltip();

    // Ensure target element is a positioning parent
    if (targetElement.style.position !== 'relative' && targetElement.style.position !== 'absolute') {
      targetElement.style.position = 'relative';
    }
    targetElement.style.overflow = 'hidden';

    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'inventory-tooltip-overlay';
    this.tooltipElement.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(11, 14, 22, 0.96);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      padding: 8px 12px;
      z-index: 100;
      pointer-events: none;
      opacity: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      transition: opacity 0.2s ease;
      border-radius: inherit;
    `;

    this.tooltipElement.innerHTML = contentHtml;
    targetElement.appendChild(this.tooltipElement);

    // Trigger animation
    requestAnimationFrame(() => {
      if (this.tooltipElement) {
        this.tooltipElement.style.opacity = '1';
      }
    });
  }

  hideTooltip(): void {
    if (this.tooltipElement) {
      const el = this.tooltipElement;
      el.style.opacity = '0';
      this.tooltipElement = null;
      setTimeout(() => el.remove(), 200);
    }
  }
}
