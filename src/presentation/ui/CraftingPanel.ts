import { BasePanel } from './FloatingIcon';
import type { PanelConfig } from './PanelConfig';

export class CraftingPanel extends BasePanel {
  private readonly resourceInventoryProvider: (() => Record<string, number> | null) | null;

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
    const statusCard = this.createStatusCard();
    const resourcesBlock = this.createResourceBlock();
    const recipesBlock = this.createRecipesBlock();

    content.appendChild(header);
    content.appendChild(statusCard);
    content.appendChild(resourcesBlock);
    content.appendChild(recipesBlock);

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

  private createStatusCard(): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = `
      border: 1px solid rgba(56, 189, 248, 0.35);
      background: linear-gradient(135deg, rgba(14, 116, 144, 0.35), rgba(2, 6, 23, 0.3));
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    `;

    const label = document.createElement('div');
    label.style.cssText = `
      font-size: 12px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: rgba(186, 230, 253, 0.95);
      font-weight: 700;
    `;
    label.textContent = 'Crafting system ready for recipes wiring';

    const state = document.createElement('div');
    state.style.cssText = `
      font-size: 11px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 6px 10px;
      border-radius: 999px;
      white-space: nowrap;
    `;
    state.textContent = 'WIP';

    card.appendChild(label);
    card.appendChild(state);
    return card;
  }

  private createResourceBlock(): HTMLElement {
    const block = document.createElement('section');
    block.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Resource Bank';
    title.style.cssText = `
      margin: 0;
      font-size: 13px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.92);
      font-weight: 700;
    `;

    block.appendChild(title);
    block.appendChild(this.createResourceRow('cuprite', 'Cuprite'));

    return block;
  }

  private createResourceRow(resourceType: string, label: string): HTMLElement {
    const normalizedResourceType = String(resourceType || '').trim().toLowerCase();
    const row = document.createElement('div');
    row.dataset.resourceType = normalizedResourceType;
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 10px 12px;
    `;

    const name = document.createElement('div');
    name.style.cssText = `
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 600;
      letter-spacing: 0.3px;
    `;
    name.textContent = label;

    const value = document.createElement('div');
    value.style.cssText = `
      font-size: 15px;
      color: #ffffff;
      font-weight: 800;
      font-family: 'Consolas', 'Courier New', monospace;
    `;
    value.dataset.resourceValue = normalizedResourceType;
    value.textContent = '0';

    row.appendChild(name);
    row.appendChild(value);
    return row;
  }

  private createRecipesBlock(): HTMLElement {
    const block = document.createElement('section');
    block.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.2);
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      flex: 1;
      min-height: 0;
    `;

    block.appendChild(this.createRecipeCard('Hull Plating Mk1', 'Need recipe data'));
    block.appendChild(this.createRecipeCard('Shield Core Mk1', 'Need recipe data'));
    block.appendChild(this.createRecipeCard('Engine Coil Mk1', 'Need recipe data'));

    return block;
  }

  private createRecipeCard(titleText: string, helperText: string): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 10px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.03);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 10px;
      min-height: 130px;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 13px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.92);
      line-height: 1.3;
    `;
    title.textContent = titleText;

    const helper = document.createElement('div');
    helper.style.cssText = `
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.35;
    `;
    helper.textContent = helperText;

    const button = document.createElement('button');
    button.textContent = 'Unavailable';
    button.disabled = true;
    button.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.55);
      border-radius: 8px;
      height: 32px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      cursor: not-allowed;
    `;

    card.appendChild(title);
    card.appendChild(helper);
    card.appendChild(button);

    return card;
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

    const resourceRows = this.content.querySelectorAll<HTMLElement>('[data-resource-type]');
    for (const row of resourceRows) {
      const normalizedType = String(row.dataset.resourceType || '').trim().toLowerCase();
      if (!normalizedType) continue;

      const quantity = Math.max(0, Math.floor(Number(normalizedInventory[normalizedType] || 0)));
      const valueElement = row.querySelector<HTMLElement>('[data-resource-value]');
      if (!valueElement) continue;

      valueElement.textContent = String(quantity);
    }
  }

  protected override onShow(): void {
    if (!this.resourceInventoryProvider) return;
    const resourceInventory = this.resourceInventoryProvider();
    if (!resourceInventory || typeof resourceInventory !== 'object') return;
    this.update({ resourceInventory });
  }
}
