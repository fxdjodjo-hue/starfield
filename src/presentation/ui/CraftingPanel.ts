import { BasePanel } from './FloatingIcon';
import type { PanelConfig } from './PanelConfig';
import { getResourceDefinition, listResourceDefinitions } from '../../config/ResourceConfig';
import { listCraftingRecipes, type CraftingRecipe } from '../../config/CraftingConfig';

const RESOURCE_SLOT_CAPACITY = 8;
const RESOURCE_DESCRIPTIONS: Record<string, string> = {
  cuprite: 'Raw crystal ore used for crafting modules and ship components.'
};

interface CraftingPetSnapshot {
  hasPetUnlocked: boolean;
  ownedPetModuleIds: Set<string>;
}

export class CraftingPanel extends BasePanel {
  private readonly resourceInventoryProvider: (() => Record<string, number> | null) | null;
  private readonly craftRequestSubmitter: ((recipeId: string) => boolean) | null;
  private readonly petStateProvider: (() => unknown) | null;
  private resourceTooltip!: HTMLElement | null;
  private hoveredResourceSlot!: HTMLElement | null;
  private recipeButtonsById!: Map<string, HTMLButtonElement>;
  private recipeStatusById!: Map<string, HTMLElement>;
  private recipeCardById!: Map<string, HTMLElement>;
  private latestResourceInventory!: Record<string, number>;
  private latestPetSnapshot!: CraftingPetSnapshot | null;

  constructor(
    config: PanelConfig,
    resourceInventoryProvider?: (() => Record<string, number> | null),
    craftRequestSubmitter?: ((recipeId: string) => boolean),
    petStateProvider?: (() => unknown)
  ) {
    const normalizedProvider = typeof resourceInventoryProvider === 'function'
      ? resourceInventoryProvider
      : null;
    const normalizedSubmitter = typeof craftRequestSubmitter === 'function'
      ? craftRequestSubmitter
      : null;
    const normalizedPetStateProvider = typeof petStateProvider === 'function'
      ? petStateProvider
      : null;
    super(config);
    this.resourceInventoryProvider = normalizedProvider;
    this.craftRequestSubmitter = normalizedSubmitter;
    this.petStateProvider = normalizedPetStateProvider;
  }

  protected createPanelContent(): HTMLElement {
    this.initializeRuntimeState();

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

  private initializeRuntimeState(): void {
    if (!this.recipeButtonsById) this.recipeButtonsById = new Map<string, HTMLButtonElement>();
    if (!this.recipeStatusById) this.recipeStatusById = new Map<string, HTMLElement>();
    if (!this.recipeCardById) this.recipeCardById = new Map<string, HTMLElement>();
    if (!this.latestResourceInventory) this.latestResourceInventory = {};
    if (this.latestPetSnapshot === undefined) this.latestPetSnapshot = null;
    if (this.resourceTooltip === undefined) this.resourceTooltip = null;
    if (this.hoveredResourceSlot === undefined) this.hoveredResourceSlot = null;
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
    closeButton.textContent = 'x';
    closeButton.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: none;
      color: rgba(255, 255, 255, 0.6);
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      text-transform: uppercase;
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
      display: flex;
      flex-direction: column;
      padding: 40px 14px 12px 14px;
      gap: 10px;
      box-sizing: border-box;
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

    const recipeList = document.createElement('div');
    recipeList.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      overflow-y: auto;
      padding-right: 2px;
      min-height: 0;
      flex: 1;
    `;

    const recipes = listCraftingRecipes();
    if (recipes.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.textContent = 'No recipes available.';
      emptyState.style.cssText = `
        grid-column: 1 / -1;
        border: 1px dashed rgba(255, 255, 255, 0.16);
        border-radius: 10px;
        color: rgba(255, 255, 255, 0.48);
        padding: 16px;
        font-size: 12px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      `;
      recipeList.appendChild(emptyState);
    } else {
      for (const recipe of recipes) {
        recipeList.appendChild(this.createRecipeCard(recipe));
      }
    }

    pane.appendChild(recipeList);
    return pane;
  }

  private createRecipeCard(recipe: CraftingRecipe): HTMLElement {
    const card = document.createElement('article');
    card.dataset.recipeCardId = recipe.id;
    card.style.cssText = `
      border: 1px solid rgba(125, 211, 252, 0.24);
      border-radius: 10px;
      background: linear-gradient(160deg, rgba(14, 116, 144, 0.2), rgba(2, 6, 23, 0.56));
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 145px;
      box-sizing: border-box;
      transition: border-color 0.16s ease, background 0.16s ease, opacity 0.16s ease;
    `;
    this.recipeCardById.set(recipe.id, card);

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    `;

    const title = document.createElement('div');
    title.textContent = recipe.displayName;
    title.style.cssText = `
      font-size: 13px;
      font-weight: 800;
      color: rgba(255, 255, 255, 0.96);
      letter-spacing: 0.4px;
      text-transform: uppercase;
      line-height: 1.2;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;

    const badge = document.createElement('div');
    badge.textContent = recipe.category.replace(/_/g, ' ');
    badge.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 9px;
      font-weight: 800;
      color: rgba(186, 230, 253, 0.92);
      letter-spacing: 0.7px;
      text-transform: uppercase;
      white-space: nowrap;
      flex-shrink: 0;
    `;

    header.appendChild(title);
    header.appendChild(badge);
    card.appendChild(header);

    const description = document.createElement('p');
    description.textContent = recipe.description || 'Crafting recipe';
    description.style.cssText = `
      margin: 0;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.72);
      line-height: 1.35;
      min-height: 30px;
    `;
    card.appendChild(description);

    const requirementsLabel = document.createElement('div');
    requirementsLabel.textContent = 'Recipe Requirements';
    requirementsLabel.style.cssText = `
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: rgba(186, 230, 253, 0.84);
      line-height: 1;
    `;
    card.appendChild(requirementsLabel);

    const costWrap = document.createElement('div');
    costWrap.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      min-height: 0;
    `;

    const costEntries = Object.entries(recipe.cost || {});
    for (const [resourceType, quantity] of costEntries) {
      const chip = document.createElement('div');
      chip.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 6px;
      `;
      const normalizedResourceType = String(resourceType || '').trim().toLowerCase();
      const definition = getResourceDefinition(normalizedResourceType);
      const label = definition?.displayName || normalizedResourceType || 'Resource';
      const safeQuantity = Math.max(0, Math.floor(Number(quantity || 0)));
      chip.title = `${label} x${safeQuantity}`;

      const previewPath = this.getResourcePreviewPath(normalizedResourceType);
      if (previewPath) {
        const icon = document.createElement('img');
        icon.src = previewPath;
        icon.alt = label;
        icon.style.cssText = `
          width: 18px;
          height: 18px;
          object-fit: contain;
          filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.58));
        `;
        chip.appendChild(icon);
      } else {
        const fallback = document.createElement('span');
        fallback.textContent = '?';
        fallback.style.cssText = `
          color: rgba(203, 213, 225, 0.9);
          font-size: 14px;
          font-weight: 700;
          line-height: 1;
        `;
        chip.appendChild(fallback);
      }

      const quantityLabel = document.createElement('span');
      quantityLabel.textContent = `x${safeQuantity}`;
      quantityLabel.style.cssText = `
        font-size: 12px;
        font-weight: 800;
        color: rgba(226, 232, 240, 0.97);
        letter-spacing: 0.3px;
        font-family: 'Consolas', 'Courier New', monospace;
      `;
      chip.appendChild(quantityLabel);
      costWrap.appendChild(chip);
    }
    card.appendChild(costWrap);

    const footer = document.createElement('div');
    footer.style.cssText = `
      margin-top: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    `;

    const status = document.createElement('div');
    status.dataset.recipeStatusId = recipe.id;
    status.style.cssText = `
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: rgba(186, 230, 253, 0.92);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    status.textContent = 'Checking';
    this.recipeStatusById.set(recipe.id, status);

    const craftButton = document.createElement('button');
    craftButton.type = 'button';
    craftButton.dataset.recipeButtonId = recipe.id;
    craftButton.style.cssText = `
      border: 1px solid rgba(56, 189, 248, 0.5);
      border-radius: 7px;
      background: linear-gradient(130deg, rgba(14, 116, 144, 0.46), rgba(2, 132, 199, 0.24));
      color: rgba(224, 242, 254, 0.98);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.7px;
      text-transform: uppercase;
      min-width: 72px;
      height: 30px;
      padding: 0 10px;
      cursor: pointer;
      transition: border-color 0.16s ease, opacity 0.16s ease, transform 0.16s ease;
      white-space: nowrap;
      flex-shrink: 0;
    `;
    craftButton.textContent = 'Craft';
    craftButton.addEventListener('mouseenter', () => {
      if (craftButton.disabled) return;
      craftButton.style.borderColor = 'rgba(125, 211, 252, 0.84)';
      craftButton.style.transform = 'translateY(-1px)';
    });
    craftButton.addEventListener('mouseleave', () => {
      craftButton.style.borderColor = craftButton.disabled
        ? 'rgba(148, 163, 184, 0.35)'
        : 'rgba(56, 189, 248, 0.5)';
      craftButton.style.transform = 'translateY(0)';
    });
    craftButton.addEventListener('click', () => this.handleCraftRequest(recipe));
    this.recipeButtonsById.set(recipe.id, craftButton);

    footer.appendChild(status);
    footer.appendChild(craftButton);
    card.appendChild(footer);

    return card;
  }

  private handleCraftRequest(recipe: CraftingRecipe): void {
    const lockReason = this.getOneTimeCraftLockReason(recipe);
    if (lockReason) {
      this.setRecipeStatus(recipe.id, lockReason, 'neutral');
      return;
    }

    const canCraft = this.canCraftRecipe(recipe, this.latestResourceInventory);
    if (!canCraft) {
      this.setRecipeStatus(recipe.id, this.buildMissingResourceLabel(recipe, this.latestResourceInventory), 'error');
      return;
    }

    if (!this.craftRequestSubmitter) {
      this.setRecipeStatus(recipe.id, 'Network unavailable', 'error');
      return;
    }

    const requestSent = this.craftRequestSubmitter(recipe.id);
    if (!requestSent) {
      this.setRecipeStatus(recipe.id, 'Request failed', 'error');
      return;
    }

    this.setRecipeStatus(recipe.id, 'Craft request sent', 'success');
  }

  private setRecipeStatus(recipeId: string, text: string, tone: 'error' | 'success' | 'neutral'): void {
    this.ensureRecipeElementMaps();
    const status = this.recipeStatusById.get(recipeId);
    if (!status) return;
    status.textContent = text;
    if (tone === 'error') {
      status.style.color = 'rgba(248, 113, 113, 0.96)';
      return;
    }
    if (tone === 'success') {
      status.style.color = 'rgba(109, 255, 138, 0.96)';
      return;
    }
    status.style.color = 'rgba(203, 213, 225, 0.95)';
  }

  private refreshRecipeStates(): void {
    this.ensureRecipeElementMaps();
    this.resolveLatestPetSnapshot();
    const recipes = listCraftingRecipes();
    for (const recipe of recipes) {
      const button = this.recipeButtonsById.get(recipe.id);
      const card = this.recipeCardById.get(recipe.id);
      const status = this.recipeStatusById.get(recipe.id);
      if (!button || !card || !status) continue;

      const lockReason = this.getOneTimeCraftLockReason(recipe);
      const canCraftByResources = this.canCraftRecipe(recipe, this.latestResourceInventory);
      const canCraft = !lockReason && canCraftByResources;
      button.disabled = !canCraft;
      button.style.opacity = canCraft ? '1' : '0.5';
      button.style.cursor = canCraft ? 'pointer' : 'not-allowed';
      button.style.borderColor = canCraft
        ? 'rgba(56, 189, 248, 0.5)'
        : 'rgba(148, 163, 184, 0.35)';
      button.textContent = canCraft
        ? 'Craft'
        : (lockReason ? 'Owned' : 'Missing');

      card.style.opacity = canCraft ? '1' : '0.72';
      card.style.borderColor = canCraft
        ? 'rgba(125, 211, 252, 0.24)'
        : 'rgba(148, 163, 184, 0.2)';

      const statusText = canCraft
        ? 'Ready'
        : (lockReason ? lockReason : this.buildMissingResourceLabel(recipe, this.latestResourceInventory));
      status.textContent = statusText;
      if (canCraft) {
        status.style.color = 'rgba(186, 230, 253, 0.92)';
      } else if (lockReason) {
        status.style.color = 'rgba(203, 213, 225, 0.9)';
      } else {
        status.style.color = 'rgba(248, 113, 113, 0.92)';
      }
    }
  }

  private ensureRecipeElementMaps(): void {
    this.initializeRuntimeState();

    const root = this.content;
    if (!root || typeof root.querySelectorAll !== 'function') return;

    const expectedRecipeCount = listCraftingRecipes().length;
    const hasAllMaps =
      this.recipeButtonsById.size >= expectedRecipeCount
      && this.recipeStatusById.size >= expectedRecipeCount
      && this.recipeCardById.size >= expectedRecipeCount;
    if (hasAllMaps) return;

    this.recipeButtonsById.clear();
    this.recipeStatusById.clear();
    this.recipeCardById.clear();

    const cardElements = root.querySelectorAll<HTMLElement>('[data-recipe-card-id]');
    for (const cardElement of cardElements) {
      const recipeId = String(cardElement.dataset.recipeCardId || '').trim();
      if (!recipeId) continue;
      this.recipeCardById.set(recipeId, cardElement);
    }

    const statusElements = root.querySelectorAll<HTMLElement>('[data-recipe-status-id]');
    for (const statusElement of statusElements) {
      const recipeId = String(statusElement.dataset.recipeStatusId || '').trim();
      if (!recipeId) continue;
      this.recipeStatusById.set(recipeId, statusElement);
    }

    const buttonElements = root.querySelectorAll<HTMLButtonElement>('[data-recipe-button-id]');
    for (const buttonElement of buttonElements) {
      const recipeId = String(buttonElement.dataset.recipeButtonId || '').trim();
      if (!recipeId) continue;
      this.recipeButtonsById.set(recipeId, buttonElement);
    }
  }

  private getOneTimeCraftLockReason(recipe: CraftingRecipe): string | null {
    const effectType = String(recipe?.effect?.type || '').trim().toLowerCase();
    if (!effectType) return null;

    const petSnapshot = this.latestPetSnapshot;
    if (!petSnapshot) return null;

    if (effectType === 'unlock_pet') {
      return petSnapshot.hasPetUnlocked
        ? 'Already unlocked'
        : null;
    }

    if (effectType !== 'add_pet_module') return null;

    const moduleItemId = this.resolveRecipePetModuleId(recipe);
    if (!moduleItemId) return null;

    return petSnapshot.ownedPetModuleIds.has(moduleItemId)
      ? 'Already crafted'
      : null;
  }

  private resolveRecipePetModuleId(recipe: CraftingRecipe): string {
    const fromEffect = String(recipe?.effect?.module?.itemId || '').trim().toLowerCase();
    if (fromEffect) return fromEffect;
    return String(recipe?.itemId || '').trim().toLowerCase();
  }

  private canCraftRecipe(recipe: CraftingRecipe, resourceInventory: Record<string, number>): boolean {
    const costEntries = Object.entries(recipe.cost || {});
    if (costEntries.length === 0) return false;

    for (const [resourceType, requiredQuantity] of costEntries) {
      const ownedQuantity = this.getOwnedResourceQuantity(resourceType, resourceInventory);
      if (ownedQuantity < Math.max(0, Math.floor(Number(requiredQuantity || 0)))) {
        return false;
      }
    }

    return true;
  }

  private buildMissingResourceLabel(recipe: CraftingRecipe, resourceInventory: Record<string, number>): string {
    const missing: string[] = [];
    for (const [resourceType, requiredQuantityRaw] of Object.entries(recipe.cost || {})) {
      const requiredQuantity = Math.max(0, Math.floor(Number(requiredQuantityRaw || 0)));
      const ownedQuantity = this.getOwnedResourceQuantity(resourceType, resourceInventory);
      if (ownedQuantity >= requiredQuantity) continue;
      const missingQuantity = requiredQuantity - ownedQuantity;
      missing.push(`${resourceType} ${missingQuantity}`);
    }

    if (missing.length === 0) return 'Missing resources';
    return `Need ${missing.join(', ')}`;
  }

  private getOwnedResourceQuantity(resourceType: string, resourceInventory: Record<string, number>): number {
    const normalizedType = String(resourceType || '').trim().toLowerCase();
    if (!normalizedType) return 0;

    const directCandidates: unknown[] = [
      resourceInventory[normalizedType],
      resourceInventory[resourceType]
    ];
    for (const candidate of directCandidates) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.floor(parsed));
      }
    }

    for (const [rawType, rawQuantity] of Object.entries(resourceInventory || {})) {
      const key = String(rawType || '').trim().toLowerCase();
      if (!key || key !== normalizedType) continue;
      const parsed = Number(rawQuantity);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.floor(parsed));
      }
    }

    const panelRoot = this.content;
    if (!panelRoot || typeof panelRoot.querySelector !== 'function') {
      return 0;
    }

    const valueElement = panelRoot.querySelector<HTMLElement>(
      `[data-resource-value="${normalizedType}"]`
    );
    if (valueElement) {
      const parsed = Number(String(valueElement.textContent || '').trim());
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.floor(parsed));
      }
    }

    return 0;
  }

  private resolveLatestPetSnapshot(): CraftingPetSnapshot | null {
    if (!this.petStateProvider) {
      return this.latestPetSnapshot;
    }

    let rawProviderPetState: unknown = undefined;
    try {
      rawProviderPetState = this.petStateProvider();
    } catch (_error) {
      return this.latestPetSnapshot;
    }

    const providerSnapshot = this.normalizePetSnapshot(rawProviderPetState);
    if (providerSnapshot !== undefined) {
      this.latestPetSnapshot = providerSnapshot;
    }

    return this.latestPetSnapshot;
  }

  private readProvidedPetState(): unknown {
    if (!this.petStateProvider) return undefined;

    try {
      return this.petStateProvider();
    } catch (_error) {
      return undefined;
    }
  }

  private normalizePetSnapshot(rawPetState: unknown): CraftingPetSnapshot | null | undefined {
    if (rawPetState === undefined) return undefined;
    if (!rawPetState || typeof rawPetState !== 'object') return null;

    const source = rawPetState as Record<string, unknown>;
    const petId = String(source.petId ?? source.pet_id ?? '').trim();
    const hasPetUnlocked = petId.length > 0;

    const ownedPetModuleIds = new Set<string>();
    const moduleSlotId = this.readPetModuleIdFromSlot(
      source.moduleSlot ?? source.petModuleSlot ?? source.module ?? source.module_slot
    );
    if (moduleSlotId) {
      ownedPetModuleIds.add(moduleSlotId);
    }

    for (const item of this.readPetInventory(
      source.inventory ?? source.petInventory ?? source.pet_inventory ?? source.cargo
    )) {
      const itemId = String(
        item?.itemId
        ?? item?.item_id
        ?? item?.moduleId
        ?? item?.module_id
        ?? item?.id
        ?? ''
      ).trim().toLowerCase();
      const quantity = Math.max(0, Math.floor(Number(item?.quantity ?? item?.count ?? item?.qty ?? 1)));
      if (!itemId || quantity <= 0) continue;
      if (!itemId.startsWith('pet_module_')) continue;
      ownedPetModuleIds.add(itemId);
    }

    return {
      hasPetUnlocked,
      ownedPetModuleIds
    };
  }

  private readPetModuleIdFromSlot(rawModuleSlot: unknown): string {
    if (!rawModuleSlot || typeof rawModuleSlot !== 'object') return '';

    const source = rawModuleSlot as Record<string, unknown>;
    return String(
      source.itemId
      ?? source.item_id
      ?? source.id
      ?? source.moduleId
      ?? source.module_id
      ?? ''
    )
      .trim()
      .toLowerCase();
  }

  private readPetInventory(rawInventory: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(rawInventory)) return [];
    return rawInventory
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
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
    const normalizedResourceType = String(resourceType || '').trim().toLowerCase();
    if (!normalizedResourceType) return null;

    // Prefer dedicated preview sprites for compact UI chips.
    if (normalizedResourceType === 'cuprite') {
      return 'assets/resources/previews/resource_2.png';
    }

    const definition = getResourceDefinition(normalizedResourceType);
    const assetBasePath = String(definition?.assetBasePath || '').trim();
    if (assetBasePath) {
      const normalizedPath = assetBasePath.replace(/^\//, '');
      return normalizedPath.toLowerCase().endsWith('.png')
        ? normalizedPath
        : `${normalizedPath}.png`;
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
    this.initializeRuntimeState();

    const payload = data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : null;

    const rawPetState = payload
      ? (payload.petState ?? payload.playerPetState)
      : undefined;
    const normalizedPetSnapshot = this.normalizePetSnapshot(rawPetState);
    if (normalizedPetSnapshot !== undefined) {
      this.latestPetSnapshot = normalizedPetSnapshot;
    }
    this.resolveLatestPetSnapshot();

    const rawInventory = payload
      ? (payload.resourceInventory || null)
      : null;
    if (rawInventory && typeof rawInventory === 'object') {
      const normalizedInventory: Record<string, number> = {};
      for (const [rawType, rawQuantity] of Object.entries(rawInventory as Record<string, unknown>)) {
        const normalizedType = String(rawType || '').trim().toLowerCase();
        if (!normalizedType) continue;
        const quantity = Number(rawQuantity);
        normalizedInventory[normalizedType] = Number.isFinite(quantity)
          ? Math.max(0, Math.floor(quantity))
          : 0;
      }
      this.latestResourceInventory = normalizedInventory;

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

    this.refreshRecipeStates();
  }

  protected override onShow(): void {
    this.initializeRuntimeState();

    const providedPetState = this.readProvidedPetState();
    const resourceInventory = this.resourceInventoryProvider
      ? this.resourceInventoryProvider()
      : null;

    if (resourceInventory && typeof resourceInventory === 'object') {
      this.update({
        resourceInventory,
        petState: providedPetState
      });
      return;
    }

    if (providedPetState !== undefined) {
      this.update({ petState: providedPetState });
      return;
    }

    if (!this.resourceInventoryProvider) {
      this.refreshRecipeStates();
      return;
    }

    this.refreshRecipeStates();
  }

  protected override onHide(): void {
    this.initializeRuntimeState();
    this.hoveredResourceSlot = null;
    this.hideResourceTooltip();
  }

  override destroy(): void {
    this.initializeRuntimeState();
    this.hoveredResourceSlot = null;
    this.removeResourceTooltip();
    super.destroy();
  }
}
