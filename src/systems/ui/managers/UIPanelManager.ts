import { UIManager } from '../../../presentation/ui/UIManager';
import { LeaderboardPanel } from '../../../presentation/ui/LeaderboardPanel';
import { QuestPanel } from '../../../presentation/ui/QuestPanel';
import { UpgradePanel } from '../../../presentation/ui/UpgradePanel';
import { SettingsPanel } from '../../../presentation/ui/SettingsPanel';
import { InventoryPanel } from '../../../presentation/ui/InventoryPanel';
import { CraftingPanel } from '../../../presentation/ui/CraftingPanel';
import { PetPanel } from '../../../presentation/ui/PetPanel';
import { LogPanel } from '../../../presentation/ui/LogPanel';
import { getPanelConfig } from '../../../presentation/ui/PanelConfig';
import type { QuestSystem } from '../../quest/QuestSystem';
import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { PlayerSystem } from '../../player/PlayerSystem';
import type { ClientNetworkSystem } from '../../../multiplayer/client/ClientNetworkSystem';
import type { PetStatePayload, AmmoTier, MissileTier } from '../../../config/NetworkConfig';
import { LogSystem, type LogHistoryEntry } from '../../rendering/LogSystem';

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
  private lastCraftingResourceInventorySignature: string = '';
  private cachedCraftingResourceInventory: Record<string, number> = {};
  private lastPetStateSignature: string = '';
  private cachedPetState: PetStatePayload | null = null;
  private resourceInventoryUpdateListener: ((event: Event) => void) | null = null;
  private petStateUpdateListener: ((event: Event) => void) | null = null;
  private panelVisibilityListener: ((event: Event) => void) | null = null;
  private ammoShortcutListener: ((event: Event) => void) | null = null;
  private lastCraftingDataRefreshRequestAt: number = 0;
  private lastPetDataRefreshRequestAt: number = 0;
  private cachedLogSystem: LogSystem | null = null;

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
    this.setupResourceInventorySyncListener();
    this.setupPetStateSyncListener();
    this.setupCraftingPanelVisibilityListener();
    this.setupAmmoShortcutListener();
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

    // Crea e registra il pannello settings
    const settingsConfig = getPanelConfig('settings');
    const settingsPanel = new SettingsPanel(settingsConfig);
    this.uiManager.registerPanel(settingsPanel);

    // Crea e registra il pannello inventario
    const inventoryConfig = getPanelConfig('inventory');
    const inventoryPanel = new InventoryPanel(inventoryConfig, this.ecs, this.playerSystem || undefined);
    if (this.clientNetworkSystem) {
      inventoryPanel.setClientNetworkSystem(this.clientNetworkSystem);
    }
    this.uiManager.registerPanel(inventoryPanel);

    // Crea e registra il pannello crafting
    const craftingConfig = getPanelConfig('crafting');
    const craftingPanel = new CraftingPanel(
      craftingConfig,
      () => this.resolveCraftingResourceInventory(),
      (recipeId: string, quantity?: number) => this.submitCraftItemRequest(recipeId, quantity),
      () => this.resolvePetState()
    );
    this.uiManager.registerPanel(craftingPanel);
    this.syncCraftingPanelResourceInventory(true);

    const petConfig = getPanelConfig('pet');
    const petPanel = new PetPanel(
      petConfig,
      () => this.resolvePetState(),
      (petNickname: string) => this.submitPetNicknameUpdate(petNickname),
      (isActive: boolean) => this.submitPetActiveToggle(isActive),
      (moduleItemId: string | null) => this.submitPetModuleUpdate(moduleItemId)
    );
    this.uiManager.registerPanel(petPanel);
    this.syncPetPanelState(true);

    const logConfig = getPanelConfig('logs');
    const logPanel = new LogPanel(
      logConfig,
      () => this.resolveLogSystemHistory()
    );
    this.uiManager.registerPanel(logPanel);

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

    const craftingPanel = this.uiManager.getPanel('crafting-panel');
    if (craftingPanel && craftingPanel.isPanelVisible()) {
      this.syncCraftingPanelResourceInventory();
    }

    const petPanel = this.uiManager.getPanel('pet-panel');
    if (petPanel && petPanel.isPanelVisible()) {
      this.syncPetPanelState();
    }
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

    // Aggiorna anche il pannello inventario
    const inventoryPanel = this.uiManager.getPanel('inventory-panel');
    if (inventoryPanel && typeof (inventoryPanel as any).setPlayerSystem === 'function') {
      (inventoryPanel as any).setPlayerSystem(playerSystem);
    }
  }

  /**
   * Imposta il ClientNetworkSystem
   */
  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem): void {
    this.clientNetworkSystem = clientNetworkSystem;
    const normalizedNetworkInventory = this.normalizeResourceInventory(
      clientNetworkSystem?.gameContext?.playerResourceInventory
    );
    const normalizedPetState = this.normalizePetState(
      clientNetworkSystem?.gameContext?.playerPetState
    );
    if (normalizedNetworkInventory) {
      this.cachedCraftingResourceInventory = normalizedNetworkInventory;
    }
    if (normalizedPetState) {
      this.cachedPetState = normalizedPetState;
    }

    // Aggiorna anche i pannelli che ne hanno bisogno
    if (this.upgradePanel) {
      this.upgradePanel.setClientNetworkSystem(clientNetworkSystem);
    }

    // Aggiorna leaderboard panel se esiste
    const leaderboardPanel = this.uiManager.getPanel('leaderboard');
    if (leaderboardPanel && typeof (leaderboardPanel as any).setClientNetworkSystem === 'function') {
      (leaderboardPanel as any).setClientNetworkSystem(clientNetworkSystem);
    }

    // Aggiorna inventory panel se esiste
    const inventoryPanel = this.uiManager.getPanel('inventory-panel');
    if (inventoryPanel && typeof (inventoryPanel as any).setClientNetworkSystem === 'function') {
      (inventoryPanel as any).setClientNetworkSystem(clientNetworkSystem);
    }

    this.syncCraftingPanelResourceInventory(true);
    this.syncPetPanelState(true);
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
   * Imposta la visibilità delle icone UI
   */
  setIconsVisibility(visible: boolean): void {
    if (visible) {
      this.uiManager.showUI();
    } else {
      this.uiManager.hideUI();
    }
  }

  /**
   * Restituisce l'UIManager
   */
  getUIManager(): UIManager {
    return this.uiManager;
  }

  destroy(): void {
    this.teardownResourceInventorySyncListener();
    this.teardownPetStateSyncListener();
    this.teardownCraftingPanelVisibilityListener();
    this.teardownAmmoShortcutListener();
    this.uiManager.destroy();
  }

  private setupAmmoShortcutListener(): void {
    if (this.ammoShortcutListener || typeof document === 'undefined') return;

    this.ammoShortcutListener = (event: Event) => {
      const customEvent = event as CustomEvent<{ slot?: number }>;
      const slot = Math.floor(Number(customEvent?.detail?.slot || 0));

      const ammoTier = this.resolveAmmoTierFromSlot(slot);
      if (ammoTier) {
        this.submitAmmoTierUpdate(ammoTier);
        return;
      }

      const missileTier = this.resolveMissileTierFromSlot(slot);
      if (missileTier) {
        this.submitMissileTierUpdate(missileTier);
        return;
      }
    };

    document.addEventListener('skillbar:activate', this.ammoShortcutListener as EventListener);
  }

  private teardownAmmoShortcutListener(): void {
    if (!this.ammoShortcutListener || typeof document === 'undefined') return;
    document.removeEventListener('skillbar:activate', this.ammoShortcutListener as EventListener);
    this.ammoShortcutListener = null;
  }

  private resolveAmmoTierFromSlot(slot: number): AmmoTier | null {
    if (slot === 1) return 'x1';
    if (slot === 2) return 'x2';
    if (slot === 3) return 'x3';
    return null;
  }

  private resolveMissileTierFromSlot(slot: number): MissileTier | null {
    if (slot === 4) return 'm1';
    if (slot === 5) return 'm2';
    if (slot === 6) return 'm3';
    return null;
  }

  private submitAmmoTierUpdate(ammoTier: AmmoTier): void {
    const networkSystem = this.clientNetworkSystem;
    if (!networkSystem) return;
    networkSystem.sendAmmoTierUpdateRequest(ammoTier);
  }

  private submitMissileTierUpdate(missileTier: MissileTier): void {
    const networkSystem = this.clientNetworkSystem;
    if (!networkSystem) return;
    // Check if method exists (it should now, but for safety/TS check)
    if (typeof networkSystem.sendMissileTierUpdateRequest === 'function') {
      networkSystem.sendMissileTierUpdateRequest(missileTier);
    }
  }

  private syncCraftingPanelResourceInventory(force: boolean = false): void {
    const craftingPanel = this.uiManager.getPanel('crafting-panel');
    if (!craftingPanel || typeof (craftingPanel as any).update !== 'function') return;

    const resourceInventory = this.resolveCraftingResourceInventory();
    if (!resourceInventory) return;
    const petState = this.resolvePetState();

    const signature = this.buildCraftingResourceInventorySignature(resourceInventory);
    if (!force && signature === this.lastCraftingResourceInventorySignature) {
      return;
    }
    this.lastCraftingResourceInventorySignature = signature;

    (craftingPanel as any).update({ resourceInventory, petState });
  }

  private syncPetPanelState(force: boolean = false): void {
    const petPanel = this.uiManager.getPanel('pet-panel');
    if (!petPanel || typeof (petPanel as any).update !== 'function') return;

    const petState = this.resolvePetState();
    if (!petState) return;

    const signature = this.buildPetStateSignature(petState);
    if (!force && signature === this.lastPetStateSignature) {
      return;
    }
    this.lastPetStateSignature = signature;

    (petPanel as any).update({ petState });
  }

  private buildCraftingResourceInventorySignature(resourceInventory: Record<string, number>): string {
    const entries = Object.entries(resourceInventory)
      .map(([resourceType, quantity]) => [
        String(resourceType || '').trim(),
        Math.max(0, Math.floor(Number(quantity || 0)))
      ] as [string, number])
      .filter(([resourceType]) => resourceType.length > 0)
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

    return JSON.stringify(entries);
  }

  private buildPetStateSignature(petState: PetStatePayload): string {
    return JSON.stringify([
      petState.petId,
      petState.level,
      petState.experience,
      petState.maxLevel,
      petState.currentHealth,
      petState.maxHealth,
      petState.currentShield,
      petState.maxShield,
      petState.isActive,
      String(petState.petNickname || '').trim(),
      JSON.stringify(petState.moduleSlot || null),
      JSON.stringify(petState.inventory || []),
      Math.max(0, Math.floor(Number(petState.inventoryCapacity || 0)))
    ]);
  }

  private setupResourceInventorySyncListener(): void {
    if (typeof document === 'undefined' || this.resourceInventoryUpdateListener) return;

    this.resourceInventoryUpdateListener = (event: Event) => {
      const customEvent = event as CustomEvent<{ resourceInventory?: Record<string, number> }>;
      const normalizedInventory = this.normalizeResourceInventory(customEvent?.detail?.resourceInventory);
      if (!normalizedInventory) return;

      this.cachedCraftingResourceInventory = normalizedInventory;
      this.syncCraftingPanelResourceInventory(true);
    };

    document.addEventListener('playerResourceInventoryUpdated', this.resourceInventoryUpdateListener);
  }

  private setupPetStateSyncListener(): void {
    if (typeof document === 'undefined' || this.petStateUpdateListener) return;

    this.petStateUpdateListener = (event: Event) => {
      const customEvent = event as CustomEvent<{ petState?: PetStatePayload }>;
      const normalizedPetState = this.normalizePetState(customEvent?.detail?.petState);
      if (!normalizedPetState) return;

      this.cachedPetState = normalizedPetState;
      this.syncPetPanelState(true);
      this.syncCraftingPanelResourceInventory(true);
    };

    document.addEventListener('playerPetStateUpdated', this.petStateUpdateListener);
  }

  private teardownResourceInventorySyncListener(): void {
    if (typeof document === 'undefined' || !this.resourceInventoryUpdateListener) return;
    document.removeEventListener('playerResourceInventoryUpdated', this.resourceInventoryUpdateListener);
    this.resourceInventoryUpdateListener = null;
  }

  private teardownPetStateSyncListener(): void {
    if (typeof document === 'undefined' || !this.petStateUpdateListener) return;
    document.removeEventListener('playerPetStateUpdated', this.petStateUpdateListener);
    this.petStateUpdateListener = null;
  }

  private resolveCraftingResourceInventory(): Record<string, number> | null {
    const networkInventory = this.normalizeResourceInventory(
      this.clientNetworkSystem?.gameContext?.playerResourceInventory
    );
    const cachedInventory = this.normalizeResourceInventory(this.cachedCraftingResourceInventory);

    const hasNetworkData = this.hasInventoryEntries(networkInventory);
    const hasCachedData = this.hasInventoryEntries(cachedInventory);

    if (hasNetworkData) return networkInventory;
    if (hasCachedData) return cachedInventory;
    if (networkInventory) return networkInventory;
    if (cachedInventory) return cachedInventory;
    return null;
  }

  private resolvePetState(): PetStatePayload | null {
    const networkPetState = this.normalizePetState(
      this.clientNetworkSystem?.gameContext?.playerPetState
    );
    const cachedPetState = this.normalizePetState(this.cachedPetState);

    if (networkPetState) return networkPetState;
    if (cachedPetState) return cachedPetState;
    return null;
  }

  private resolveLogSystem(): LogSystem | null {
    if (this.cachedLogSystem && this.ecs.getSystems().includes(this.cachedLogSystem)) {
      return this.cachedLogSystem;
    }

    const systems = this.ecs.getSystems();
    const typed = systems.find((candidate): candidate is LogSystem => candidate instanceof LogSystem);
    if (typed) {
      this.cachedLogSystem = typed;
      return typed;
    }

    // Fallback difensivo per build/transpilazioni dove instanceof potrebbe non essere affidabile.
    const structural = systems.find((candidate: any) => {
      return !!candidate
        && typeof candidate.getHistoryEntries === 'function'
        && typeof candidate.clearHistory === 'function'
        && typeof candidate.addLogMessage === 'function';
    }) as LogSystem | undefined;

    this.cachedLogSystem = structural || null;
    return this.cachedLogSystem;
  }

  private resolveLogSystemHistory(): LogHistoryEntry[] {
    const logSystem = this.resolveLogSystem();
    if (!logSystem || typeof logSystem.getHistoryEntries !== 'function') {
      return [];
    }

    return logSystem.getHistoryEntries();
  }

  private hasInventoryEntries(resourceInventory: Record<string, number> | null): boolean {
    return !!resourceInventory && Object.keys(resourceInventory).length > 0;
  }

  private normalizeResourceInventory(rawInventory: unknown): Record<string, number> | null {
    if (!rawInventory || typeof rawInventory !== 'object') return null;

    const normalizedInventory: Record<string, number> = {};
    for (const [rawType, rawQuantity] of Object.entries(rawInventory as Record<string, unknown>)) {
      const resourceType = String(rawType || '').trim();
      if (!resourceType) continue;

      const parsedQuantity = Number(rawQuantity);
      normalizedInventory[resourceType] = Number.isFinite(parsedQuantity)
        ? Math.max(0, Math.floor(parsedQuantity))
        : 0;
    }

    return normalizedInventory;
  }

  private normalizePetState(rawPetState: unknown): PetStatePayload | null {
    if (!rawPetState || typeof rawPetState !== 'object') return null;

    const source = rawPetState as Record<string, unknown>;
    const petId = String(source.petId || '').trim();
    if (!petId) return null;

    const level = Math.max(1, Math.floor(Number(source.level || 1)));
    const maxLevel = Math.max(level, Math.floor(Number(source.maxLevel || level)));
    const experience = Math.max(0, Math.floor(Number(source.experience || 0)));
    const maxHealth = Math.max(1, Math.floor(Number(source.maxHealth || 1)));
    const maxShield = Math.max(0, Math.floor(Number(source.maxShield || 0)));
    const currentHealth = Math.max(0, Math.min(maxHealth, Math.floor(Number(source.currentHealth ?? maxHealth))));
    const currentShield = Math.max(0, Math.min(maxShield, Math.floor(Number(source.currentShield ?? maxShield))));
    const petNickname = String(source.petNickname ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24)
      .trim();

    const moduleSlot = this.normalizePetModuleSlot(
      source.moduleSlot ?? source.petModuleSlot ?? source.module ?? source.module_slot
    );
    const inventory = this.normalizePetInventory(
      source.inventory ?? source.petInventory ?? source.cargo ?? source.pet_inventory
    );
    const inventoryCapacity = Math.max(
      inventory.length,
      Math.floor(Number(source.inventoryCapacity ?? source.petInventoryCapacity ?? 8))
    );

    return {
      petId,
      petNickname: petNickname || petId,
      level,
      experience,
      maxLevel,
      currentHealth,
      maxHealth,
      currentShield,
      maxShield,
      isActive: source.isActive === undefined ? true : Boolean(source.isActive),
      moduleSlot,
      inventory,
      inventoryCapacity
    };
  }

  private normalizePetModuleSlot(rawSlot: unknown): PetStatePayload['moduleSlot'] {
    if (!rawSlot || typeof rawSlot !== 'object') return undefined;
    const source = rawSlot as Record<string, unknown>;
    const itemId = String(source.itemId ?? source.id ?? source.moduleId ?? '').trim();
    const itemName = String(source.itemName ?? source.name ?? '').trim();
    if (!itemId && !itemName) return undefined;

    const rarity = String(source.rarity ?? source.grade ?? 'common').trim().toLowerCase();
    const level = Math.max(1, Math.floor(Number(source.level ?? source.tier ?? 1)));

    return {
      itemId: itemId || itemName.toLowerCase().replace(/\s+/g, '_'),
      itemName: itemName || itemId,
      rarity,
      level
    };
  }

  private normalizePetInventory(rawInventory: unknown): Array<{
    itemId?: string;
    itemName?: string;
    quantity?: number;
    rarity?: string;
  }> {
    if (!Array.isArray(rawInventory)) return [];

    const normalizedItems: Array<{
      itemId?: string;
      itemName?: string;
      quantity?: number;
      rarity?: string;
    }> = [];

    for (const rawItem of rawInventory) {
      if (!rawItem || typeof rawItem !== 'object') continue;
      const source = rawItem as Record<string, unknown>;
      const itemId = String(source.itemId ?? source.id ?? '').trim();
      const itemName = String(source.itemName ?? source.name ?? '').trim();
      if (!itemId && !itemName) continue;

      const quantity = Math.max(1, Math.floor(Number(source.quantity ?? source.count ?? 1)));
      const rarity = String(source.rarity ?? source.grade ?? 'common').trim().toLowerCase();

      normalizedItems.push({
        itemId: itemId || itemName.toLowerCase().replace(/\s+/g, '_'),
        itemName: itemName || itemId,
        quantity,
        rarity
      });
    }

    return normalizedItems;
  }

  private submitPetNicknameUpdate(petNickname: string): boolean {
    const networkSystem = this.clientNetworkSystem;
    if (!networkSystem || typeof networkSystem.sendPetNicknameUpdateRequest !== 'function') {
      return false;
    }

    return networkSystem.sendPetNicknameUpdateRequest(petNickname);
  }

  private submitPetActiveToggle(isActive: boolean): boolean {
    const networkSystem = this.clientNetworkSystem;
    if (!networkSystem || typeof networkSystem.sendPetActiveUpdateRequest !== 'function') {
      return false;
    }

    const sent = networkSystem.sendPetActiveUpdateRequest(isActive);
    if (!sent) {
      return false;
    }

    const currentPetState = this.resolvePetState();
    if (currentPetState) {
      const optimisticPetState: PetStatePayload = {
        ...currentPetState,
        isActive
      };
      this.cachedPetState = optimisticPetState;
      if (networkSystem.gameContext) {
        networkSystem.gameContext.playerPetState = optimisticPetState;
      }
      this.syncPetPanelState(true);
    }

    return true;
  }

  private submitPetModuleUpdate(moduleItemId: string | null): boolean {
    const networkSystem = this.clientNetworkSystem;
    if (!networkSystem || typeof networkSystem.sendPetModuleUpdateRequest !== 'function') {
      return false;
    }

    const sent = networkSystem.sendPetModuleUpdateRequest(moduleItemId);
    if (!sent) {
      return false;
    }

    const currentPetState = this.resolvePetState();
    if (currentPetState) {
      const normalizedModuleItemId = typeof moduleItemId === 'string'
        ? moduleItemId.trim().toLowerCase()
        : '';

      let nextModuleSlot = currentPetState.moduleSlot;
      if (!normalizedModuleItemId) {
        nextModuleSlot = undefined;
      } else {
        const inventoryEntry = Array.isArray(currentPetState.inventory)
          ? currentPetState.inventory.find((item) => {
            const itemId = String(item?.itemId || '').trim().toLowerCase();
            const quantity = Math.max(0, Math.floor(Number(item?.quantity || 0)));
            return itemId === normalizedModuleItemId && quantity > 0;
          })
          : undefined;

        if (inventoryEntry) {
          const previousModuleItemId = String(currentPetState.moduleSlot?.itemId || '').trim().toLowerCase();
          const previousModuleLevel = Math.max(1, Math.floor(Number(currentPetState.moduleSlot?.level || 1)));
          nextModuleSlot = {
            itemId: String(inventoryEntry.itemId || normalizedModuleItemId).trim(),
            itemName: String(inventoryEntry.itemName || inventoryEntry.itemId || normalizedModuleItemId).trim(),
            rarity: String(inventoryEntry.rarity || 'common').trim().toLowerCase(),
            level: previousModuleItemId === normalizedModuleItemId ? previousModuleLevel : 1
          };
        }
      }

      const optimisticPetState: PetStatePayload = {
        ...currentPetState,
        moduleSlot: nextModuleSlot
      };
      this.cachedPetState = optimisticPetState;
      if (networkSystem.gameContext) {
        networkSystem.gameContext.playerPetState = optimisticPetState;
      }
      this.syncPetPanelState(true);
    }

    return true;
  }

  private submitCraftItemRequest(recipeId: string, quantity?: number): boolean {
    const networkSystem = this.clientNetworkSystem;
    if (!networkSystem || typeof networkSystem.sendCraftItemRequest !== 'function') {
      return false;
    }

    return networkSystem.sendCraftItemRequest(recipeId, quantity);
  }

  private setupCraftingPanelVisibilityListener(): void {
    if (typeof document === 'undefined' || this.panelVisibilityListener) return;

    this.panelVisibilityListener = (event: Event) => {
      const customEvent = event as CustomEvent<{ panelId?: string; isVisible?: boolean }>;
      const panelId = String(customEvent?.detail?.panelId || '');
      const isVisible = Boolean(customEvent?.detail?.isVisible);
      if (!isVisible) return;

      if (panelId === 'crafting-panel') {
        this.syncCraftingPanelResourceInventory(true);
        this.requestCraftingDataRefreshFromServer();
      } else if (panelId === 'pet-panel') {
        this.syncPetPanelState(true);
        this.requestPetDataRefreshFromServer();
      }
    };

    document.addEventListener('panelVisibilityChanged', this.panelVisibilityListener);
  }

  private teardownCraftingPanelVisibilityListener(): void {
    if (typeof document === 'undefined' || !this.panelVisibilityListener) return;
    document.removeEventListener('panelVisibilityChanged', this.panelVisibilityListener);
    this.panelVisibilityListener = null;
  }

  private requestCraftingDataRefreshFromServer(): void {
    const now = Date.now();
    if (now - this.lastCraftingDataRefreshRequestAt < 1500) return;

    const networkSystem = this.clientNetworkSystem;
    if (!networkSystem || typeof networkSystem.requestPlayerData !== 'function') return;

    const authId = String(networkSystem.gameContext?.authId || '').trim();
    if (!authId) return;

    this.lastCraftingDataRefreshRequestAt = now;
    networkSystem.requestPlayerData(authId as any);
  }

  private requestPetDataRefreshFromServer(): void {
    const now = Date.now();
    if (now - this.lastPetDataRefreshRequestAt < 1500) return;

    const networkSystem = this.clientNetworkSystem;
    if (!networkSystem || typeof networkSystem.requestPlayerData !== 'function') return;

    const authId = String(networkSystem.gameContext?.authId || '').trim();
    if (!authId) return;

    this.lastPetDataRefreshRequestAt = now;
    networkSystem.requestPlayerData(authId as any);
  }
}
