import { BasePanel } from './FloatingIcon';
import type { PanelConfig } from './PanelConfig';
import { getResourceDefinition, listResourceDefinitions } from '../../config/ResourceConfig';

const RESOURCE_SLOT_CAPACITY = 8;
const RESOURCE_DESCRIPTIONS: Record<string, string> = {
  cuprite: 'Raw crystal ore used for crafting modules and ship components.'
};

export class CraftingPanel extends BasePanel {
  private readonly resourceInventoryProvider: (() => Record<string, number> | null) | null;
  private resourceTooltip: HTMLElement | null = null;
  private hoveredResourceSlot: HTMLElement | null = null;

  constructor(config: PanelConfig, resourceInventoryProvider?: (() => Record<string, number> | null)) {
    const normalizedProvider = typeof resourceInventoryProvider === 'function'
      ? resourceInventoryProvider
      : null;
    super(config);
    this.resourceInventoryProvider = normalizedProvider;
  }

  protected createPanelContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'crafting-panel-content';
    content.style.cssText = `
      padding: 24px;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(20px) saturate(160%);
      -webkit-backdrop-filter: blur(20px) saturate(160%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 25px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: rgba(255, 255, 255, 0.92);
    `;

    const header = this.createHeader();
    const body = this.createBodyLayout();

    content.appendChild(header);
    content.appendChild(body);

    return content;
  }

  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2px;
    `;

    const titleGroup = document.createElement('div');

    const title = document.createElement('h2');
    title.textContent = 'CRAFTING';
    title.style.cssText = `
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 3px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'PROTOTYPE WORKBENCH';
    subtitle.style.cssText = `
      margin: 4px 0 0 0;
      color: rgba(255, 255, 255, 0.58);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
    `;

    titleGroup.appendChild(title);
    titleGroup.appendChild(subtitle);

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
    closeButton.addEventListener('click', () => this.hide());

    header.appendChild(titleGroup);
    header.appendChild(closeButton);
    return header;
  }

  private createBodyLayout(): HTMLElement {
    const body = document.createElement('div');
    body.style.cssText = `
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 14px;
      min-height: 0;
      flex: 1;
    `;

    body.appendChild(this.createWorkbenchPane());
    body.appendChild(this.createResourceInventoryPane());
    return body;
  }

  private createWorkbenchPane(): HTMLElement {
    const pane = document.createElement('section');
    pane.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      background: linear-gradient(145deg, rgba(2, 6, 23, 0.5), rgba(0, 0, 0, 0.25));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
      min-height: 0;
      position: relative;
      overflow: hidden;
    `;

    const label = document.createElement('div');
    label.textContent = 'WORK AREA';
    label.style.cssText = `
      position: absolute;
      top: 12px;
      left: 14px;
      font-size: 10px;
      letter-spacing: 1.1px;
      text-transform: uppercase;
      color: rgba(186, 230, 253, 0.72);
      font-weight: 700;
    `;

    pane.appendChild(label);
    return pane;
  }

  private createResourceInventoryPane(): HTMLElement {
    const block = document.createElement('section');
    block.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Resource Inventory';
    title.style.cssText = `
      margin: 0;
      font-size: 13px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.92);
      font-weight: 700;
    `;

    const cards = document.createElement('div');
    cards.style.cssText = `
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      align-items: stretch;
      overflow-y: auto;
      padding-right: 2px;
    `;

    const resourceTypes = listResourceDefinitions().map((resource) => resource.id);
    for (let slotIndex = 0; slotIndex < RESOURCE_SLOT_CAPACITY; slotIndex++) {
      const resourceType = slotIndex < resourceTypes.length ? resourceTypes[slotIndex] : null;
      cards.appendChild(this.createResourceSlot(resourceType));
    }

    block.appendChild(title);
    block.appendChild(cards);

    return block;
  }

  private createResourceSlot(resourceType: string | null): HTMLElement {
    const slot = document.createElement('div');
    slot.style.cssText = `
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      gap: 4px;
      width: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 7px;
      padding: 6px 5px;
      box-sizing: border-box;
      transition: border-color 0.18s ease, background 0.18s ease;
    `;

    if (!resourceType) {
      slot.style.background = 'rgba(255, 255, 255, 0.02)';
      slot.style.border = '1px dashed rgba(255, 255, 255, 0.14)';
      const empty = document.createElement('div');
      empty.textContent = 'Empty Slot';
      empty.style.cssText = `
        margin-top: auto;
        margin-bottom: auto;
        font-size: 8px;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.36);
        font-weight: 700;
        line-height: 1.1;
        text-align: center;
      `;
      slot.appendChild(empty);
      return slot;
    }

    const normalizedResourceType = String(resourceType || '').trim().toLowerCase();
    const definition = getResourceDefinition(normalizedResourceType);
    const label = definition?.displayName || normalizedResourceType;
    slot.dataset.resourceType = normalizedResourceType;
    slot.style.cursor = 'help';
    slot.dataset.resourceTooltip = this.buildResourceTooltip(normalizedResourceType, 0);
    slot.style.background = 'linear-gradient(160deg, rgba(14, 116, 144, 0.24), rgba(2, 6, 23, 0.46))';
    slot.style.border = '1px solid rgba(125, 211, 252, 0.24)';
    slot.onmouseenter = (event: MouseEvent) => {
      slot.style.borderColor = 'rgba(186, 230, 253, 0.45)';
      slot.style.background = 'linear-gradient(160deg, rgba(14, 116, 144, 0.3), rgba(2, 6, 23, 0.5))';
      this.hoveredResourceSlot = slot;
      this.showResourceTooltip(slot.dataset.resourceTooltip || '', event);
    };
    slot.onmousemove = (event: MouseEvent) => {
      if (this.hoveredResourceSlot === slot) {
        this.positionResourceTooltip(event);
      }
    };
    slot.onmouseleave = () => {
      slot.style.borderColor = 'rgba(125, 211, 252, 0.24)';
      slot.style.background = 'linear-gradient(160deg, rgba(14, 116, 144, 0.24), rgba(2, 6, 23, 0.46))';
      if (this.hoveredResourceSlot === slot) {
        this.hoveredResourceSlot = null;
      }
      this.hideResourceTooltip();
    };

    const previewPath = this.getResourcePreviewPath(normalizedResourceType);
    if (previewPath) {
      const preview = document.createElement('img');
      preview.src = previewPath;
      preview.alt = `${label} preview`;
      preview.style.cssText = `
        width: 19px;
        height: 19px;
        object-fit: contain;
        filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.55));
        margin-top: 1px;
      `;
      slot.appendChild(preview);
    }

    const name = document.createElement('div');
    name.style.cssText = `
      font-size: 9px;
      color: rgba(255, 255, 255, 0.95);
      font-weight: 700;
      letter-spacing: 0.2px;
      text-align: center;
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    name.textContent = label;
    slot.appendChild(name);

    const value = document.createElement('div');
    value.style.cssText = `
      margin-top: auto;
      min-width: 0;
      text-align: center;
      padding: 0;
      border: none;
      background: transparent;
      font-size: 11px;
      color: rgba(186, 230, 253, 0.96);
      font-weight: 700;
      font-family: 'Consolas', 'Courier New', monospace;
      line-height: 1;
      text-shadow: none;
    `;
    value.dataset.resourceValue = normalizedResourceType;
    value.textContent = '0';

    slot.appendChild(value);
    return slot;
  }

  private getResourcePreviewPath(resourceType: string): string | null {
    if (resourceType === 'cuprite') {
      return 'assets/resources/previews/resource_2.png';
    }
    return null;
  }

  private getResourceDescription(resourceType: string): string {
    const normalized = String(resourceType || '').trim().toLowerCase();
    return RESOURCE_DESCRIPTIONS[normalized] || 'Crafting resource';
  }

  private buildResourceTooltip(resourceType: string, quantity: number): string {
    const definition = getResourceDefinition(resourceType);
    const label = definition?.displayName || resourceType;
    const description = this.getResourceDescription(resourceType);
    return `${label}\n${description}\nOwned: ${Math.max(0, Math.floor(Number(quantity) || 0))}`;
  }

  private ensureResourceTooltipElement(): HTMLElement {
    if (this.resourceTooltip && document.body.contains(this.resourceTooltip)) {
      return this.resourceTooltip;
    }

    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      max-width: 280px;
      padding: 9px 11px;
      background: rgba(0, 0, 0, 0.75);
      border: 1px solid rgba(125, 211, 252, 0.36);
      border-radius: 8px;
      color: rgba(255, 255, 255, 0.95);
      font-size: 12px;
      line-height: 1.45;
      letter-spacing: 0.25px;
      white-space: pre-line;
      pointer-events: none;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.12s ease, transform 0.12s ease;
      z-index: 2600;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
      box-sizing: border-box;
    `;

    document.body.appendChild(tooltip);
    this.resourceTooltip = tooltip;
    return tooltip;
  }

  private showResourceTooltip(text: string, event: MouseEvent): void {
    const tooltipText = String(text || '').trim();
    if (!tooltipText) return;

    const tooltip = this.ensureResourceTooltipElement();
    tooltip.textContent = tooltipText;
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'translateY(0)';
    this.positionResourceTooltip(event);
  }

  private positionResourceTooltip(event: MouseEvent): void {
    if (!this.resourceTooltip) return;

    const offsetX = 14;
    const offsetY = 18;
    const margin = 10;
    let left = event.clientX + offsetX;
    let top = event.clientY + offsetY;

    const rect = this.resourceTooltip.getBoundingClientRect();
    if (left + rect.width + margin > window.innerWidth) {
      left = event.clientX - rect.width - offsetX;
    }
    if (top + rect.height + margin > window.innerHeight) {
      top = window.innerHeight - rect.height - margin;
    }

    left = Math.max(margin, left);
    top = Math.max(margin, top);

    this.resourceTooltip.style.left = `${Math.round(left)}px`;
    this.resourceTooltip.style.top = `${Math.round(top)}px`;
  }

  private hideResourceTooltip(): void {
    if (!this.resourceTooltip) return;
    this.resourceTooltip.style.opacity = '0';
    this.resourceTooltip.style.transform = 'translateY(4px)';
  }

  private removeResourceTooltip(): void {
    if (!this.resourceTooltip) return;
    if (this.resourceTooltip.parentNode) {
      this.resourceTooltip.parentNode.removeChild(this.resourceTooltip);
    }
    this.resourceTooltip = null;
  }

  override update(data: any): void {
    const rawInventory = data && typeof data === 'object'
      ? (data.resourceInventory || null)
      : null;
    if (!rawInventory || typeof rawInventory !== 'object') return;

    const normalizedInventory: Record<string, number> = {};
    for (const [rawType, rawQuantity] of Object.entries(rawInventory as Record<string, unknown>)) {
      const normalizedType = String(rawType || '').trim().toLowerCase();
      if (!normalizedType) continue;
      const quantity = Number(rawQuantity);
      normalizedInventory[normalizedType] = Number.isFinite(quantity)
        ? Math.max(0, Math.floor(quantity))
        : 0;
    }

    const valueElements = this.content.querySelectorAll<HTMLElement>('[data-resource-value]');
    for (const valueElement of valueElements) {
      const normalizedType = String(valueElement.dataset.resourceValue || '').trim().toLowerCase();
      if (!normalizedType) continue;
      const quantity = Math.max(0, Math.floor(Number(normalizedInventory[normalizedType] || 0)));
      valueElement.textContent = String(quantity);
      const slot = valueElement.closest<HTMLElement>('[data-resource-type]');
      if (slot) {
        const tooltipText = this.buildResourceTooltip(normalizedType, quantity);
        slot.dataset.resourceTooltip = tooltipText;
        if (this.hoveredResourceSlot === slot && this.resourceTooltip) {
          this.resourceTooltip.textContent = tooltipText;
        }
      }
    }
  }

  protected override onShow(): void {
    if (!this.resourceInventoryProvider) return;
    const resourceInventory = this.resourceInventoryProvider();
    if (!resourceInventory || typeof resourceInventory !== 'object') return;
    this.update({ resourceInventory });
  }

  protected override onHide(): void {
    this.hoveredResourceSlot = null;
    this.hideResourceTooltip();
  }

  override destroy(): void {
    this.hoveredResourceSlot = null;
    this.removeResourceTooltip();
    super.destroy();
  }
}
