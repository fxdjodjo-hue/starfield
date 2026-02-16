import { BasePanel } from './FloatingIcon';
import type { PanelConfig } from './PanelConfig';
import type { PanelData } from './UIManager';
import { ECS } from '../../infrastructure/ecs/ECS';
import { PlayerSystem } from '../../systems/player/PlayerSystem';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { PlayerUpgrades } from '../../entities/player/PlayerUpgrades';
import { Inventory } from '../../entities/player/Inventory';
import { getPlayerDefinition } from '../../config/PlayerConfig';
import { ITEM_REGISTRY, ItemSlot, getItem } from '../../config/ItemConfig';
import { NumberFormatter } from '../../core/utils/ui/NumberFormatter';

/**
 * InventoryPanel - Pannello per la gestione dell'inventario e dell'equipaggiamento
 * Layout a tre colonne: Stats, Ship Visualization, Cargo
 */
export class InventoryPanel extends BasePanel {
  private ecs!: ECS;
  private playerSystem: PlayerSystem | null = null;
  private statsElements!: { [key: string]: HTMLElement };
  private shipVisual!: HTMLElement;
  private animationTime: number = 0;
  private currentFrame: number = -1;
  private animationRequestId: number | null = null;
  private lastTimestamp: number = 0;
  private isShipHorizontalControlActive: boolean = false;
  private isShipHorizontalDragActive: boolean = false;
  private lastShipDragClientX: number | null = null;
  private shipDragFrameAccumulator: number = 0;
  private networkSystem: any = null;
  private activePopup: HTMLElement | null = null;
  private lastInventoryHash: string = '';
  private lastInventoryLayoutSignature: string = '';

  constructor(config: PanelConfig, ecs: ECS, playerSystem?: PlayerSystem) {
    super(config);
    this.ecs = ecs;
    this.playerSystem = playerSystem || null;

    // Inizializzazione esplicita stati post-super
    this.animationTime = 0;
    this.currentFrame = -1;
    this.animationRequestId = null;
    this.lastTimestamp = 0;
    this.isShipHorizontalControlActive = false;
    this.isShipHorizontalDragActive = false;
    this.lastShipDragClientX = null;
    this.shipDragFrameAccumulator = 0;

    // Recupero forzato riferimenti se persi durante la costruzione
    this.recoverElements();
  }

  /**
   * Recupera i riferimenti agli elementi DOM se non sono correttamente assegnati
   */
  private recoverElements(): void {
    if (!this.shipVisual) {
      this.shipVisual = this.container.querySelector('#inventory-ship-visual') as HTMLElement;
    }

    // Recupera anche stats se necessario (anche se solitamente rimangono)
    if (!this.statsElements || Object.keys(this.statsElements).length === 0) {
      this.statsElements = {};
      const stats = ['hp', 'shield', 'damage', 'missile', 'speed', 'total'];
      stats.forEach(id => {
        const val = this.container.querySelector(`.stat-value-${id}`) as HTMLElement;
        const bar = this.container.querySelector(`.stat-bar-${id}`) as HTMLElement;
        if (val) this.statsElements[id] = val;
        if (bar) (this.statsElements as any)[`${id}_bar`] = bar;
      });
    }
  }

  /**
   * Crea il contenuto del pannello dell'inventario
   */
  protected createPanelContent(): HTMLElement {
    this.statsElements = {};

    const content = document.createElement('div');
    content.className = 'inventory-panel-content';
    content.style.cssText = `
      padding: 30px;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
      font-family: 'Segoe UI', Tahoma, sans-serif;
      background:
        radial-gradient(circle at 30% 35%, rgba(255, 255, 255, 0.08), transparent 42%),
        rgba(0, 0, 0, 0.36);
    `;

    // Header Section
    const headerSection = document.createElement('div');
    headerSection.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    `;

    const titleGroup = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'SHIP SYSTEMS';
    title.style.cssText = `
      margin: 0;
      color: #ffffff;
      font-size: 30px;
      font-weight: 900;
      letter-spacing: 5.5px;
      text-shadow: 0 0 24px rgba(255, 255, 255, 0.28);
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'MODULES MANAGEMENT';
    subtitle.style.cssText = `
      margin: 4px 0 0 0;
      color: rgba(255, 255, 255, 0.72);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 2px;
    `;

    titleGroup.appendChild(title);
    titleGroup.appendChild(subtitle);

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.6);
      font-size: 24px;
      cursor: pointer;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    `;
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(239, 68, 68, 0.2)';
      closeButton.style.color = '#ef4444';
      closeButton.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.05)';
      closeButton.style.color = 'rgba(255, 255, 255, 0.6)';
      closeButton.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    });
    closeButton.addEventListener('click', () => this.hide());

    headerSection.appendChild(titleGroup);
    headerSection.appendChild(closeButton);
    content.appendChild(headerSection);

    // Custom Scrollbar Style
    const style = document.createElement('style');
    style.textContent = `
      .inventory-grid::-webkit-scrollbar {
        width: 6px;
      }
      .inventory-grid::-webkit-scrollbar-track {
        background: transparent;
      }
      .inventory-grid::-webkit-scrollbar-thumb {
        background: transparent;
        border-radius: 3px;
      }
      .inventory-grid:hover::-webkit-scrollbar-thumb,
      .inventory-grid.is-scrolling::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
      }
    `;
    content.appendChild(style);

    // Three Column Layout
    const mainLayout = document.createElement('div');
    mainLayout.style.cssText = `
      display: grid;
      grid-template-columns: 320px 1fr 320px;
      gap: 30px;
      flex: 1;
      height: calc(100% - 100px);
      min-height: 0;
      overflow: hidden;
      margin-top: 10px;
      width: 100%;
      box-sizing: border-box;
    `;

    // --- COLUMN 1: SHIP STATUS (Stats) ---
    const statsColumn = document.createElement('div');
    statsColumn.className = 'inventory-column stats-column';
    statsColumn.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: rgba(11, 14, 22, 0.58);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 2px;
      padding: 24px;
      box-sizing: border-box;
      min-height: 0;
    `;

    const statsHeader = document.createElement('h3');
    statsHeader.textContent = 'TELEMETRY DATA';
    statsHeader.style.cssText = `
      margin: 0;
      color: rgba(255, 255, 255, 0.82);
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 2px;
      line-height: 1;
    `;

    statsColumn.appendChild(statsHeader);

    const statsList = document.createElement('div');
    statsList.style.cssText = `
      display: grid;
      grid-template-rows: repeat(5, minmax(0, 1fr));
      gap: 10px;
      flex: 1;
      min-height: 0;
    `;

    const createStatRow = (label: string, id: string, icon: string) => {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 10px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 2px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        min-height: 0;
        box-sizing: border-box;
      `;
      row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: rgba(255, 255, 255, 0.78); font-size: 11px; font-weight: 800; letter-spacing: 1.1px;">${icon} ${label}</span>
          <span class="stat-value-${id}" style="color: #ffffff; font-size: 19px; font-weight: 900; font-variant-numeric: tabular-nums; text-shadow: 0 0 10px rgba(255,255,255,0.2);">--</span>
        </div>
        <div style="height: 5px; background: rgba(255, 255, 255, 0.16); border-radius: 2px; overflow: hidden;">
          <div class="stat-bar-${id}" style="height: 100%; width: 0%; background: #ffffff; opacity: 0.95; transition: width 0.5s ease;"></div>
        </div>
      `;
      this.statsElements[id] = row.querySelector(`.stat-value-${id}`) as HTMLElement;
      (this.statsElements as any)[`${id}_bar`] = row.querySelector(`.stat-bar-${id}`) as HTMLElement;
      return row;
    };

    statsList.appendChild(createStatRow('HULL INTEGRITY', 'hp', ''));
    statsList.appendChild(createStatRow('SHIELD INTEGRITY', 'shield', ''));
    statsList.appendChild(createStatRow('LASER POWER', 'damage', ''));
    statsList.appendChild(createStatRow('MISSILE POWER', 'missile', ''));
    statsList.appendChild(createStatRow('ENGINE THRUST', 'speed', ''));

    statsColumn.appendChild(statsList);

    // --- COLUMN 2: SHIP VISUALIZATION & SLOTS ---
    const visualColumn = document.createElement('div');
    visualColumn.className = 'inventory-column visual-column';
    visualColumn.style.cssText = `
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 20px;
      padding: 0;
      box-sizing: border-box;
      min-height: 0;
    `;

    // Overall Power focal point - moved header INSIDE to align top edge with side columns
    const powerBox = document.createElement('div');
    powerBox.style.cssText = `
      width: 100%;
      max-width: 420px;
      padding: 24px;
      background: rgba(12, 16, 24, 0.62);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 2px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
      box-sizing: border-box;
      backdrop-filter: blur(6px);
    `;
    powerBox.innerHTML = `
      <div style="color: rgba(255, 255, 255, 0.82); font-size: 13px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin: 0; line-height: 1; align-self: center;">Combat Power</div>
      <div class="stat-value-total" style="color: #ffffff; font-size: 37px; font-weight: 900; text-shadow: 0 0 24px rgba(255, 255, 255, 0.28); line-height: 1;">--</div>
    `;
    this.statsElements['total'] = powerBox.querySelector('.stat-value-total') as HTMLElement;

    visualColumn.appendChild(powerBox);

    // Ship Container and Image
    const shipContainer = document.createElement('div');
    shipContainer.style.cssText = `
      position: relative;
      width: 400px;
      height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const shipDisplay = document.createElement('div');
    shipDisplay.id = 'inventory-ship-visual';
    shipDisplay.style.cssText = `
      width: 189px;
      height: 189px;
      position: relative;
      overflow: hidden;
      transform: scale(0.95);
      filter: drop-shadow(0 0 50px rgba(255, 255, 255, 0.15));
      background-image: url('assets/ships/ship106/ship106.png');
      background-size: 1914px 1532px;
      background-position: -2px -2px;
      background-repeat: no-repeat;
      image-rendering: pixelated;
      cursor: ew-resize;
      user-select: none;
      touch-action: none;
    `;
    const pixelsPerFrame = 3;

    const beginShipHorizontalDrag = (clientX: number) => {
      this.isShipHorizontalDragActive = true;
      this.isShipHorizontalControlActive = true;
      this.lastShipDragClientX = clientX;
      this.shipDragFrameAccumulator = this.currentFrame >= 0 ? this.currentFrame : 0;
    };

    const updateShipFrameFromHorizontalDrag = (clientX: number) => {
      if (!this.isShipHorizontalDragActive) return;

      if (this.lastShipDragClientX === null) {
        this.lastShipDragClientX = clientX;
        return;
      }

      const deltaX = clientX - this.lastShipDragClientX;
      this.lastShipDragClientX = clientX;
      if (deltaX === 0) return;

      this.shipDragFrameAccumulator += deltaX / pixelsPerFrame;
      this.applyShipAnimationFrame(this.shipDragFrameAccumulator);
    };

    shipDisplay.addEventListener('pointerleave', () => {
      if (!this.isShipHorizontalDragActive) {
        this.isShipHorizontalControlActive = false;
        this.lastShipDragClientX = null;
      }
    });

    shipDisplay.addEventListener('pointerdown', (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      beginShipHorizontalDrag(event.clientX);
      if (shipDisplay.setPointerCapture) shipDisplay.setPointerCapture(event.pointerId);
    });

    shipDisplay.addEventListener('pointermove', (event: PointerEvent) => {
      updateShipFrameFromHorizontalDrag(event.clientX);
    });

    const stopShipHorizontalControl = (event?: PointerEvent) => {
      this.isShipHorizontalDragActive = false;
      this.isShipHorizontalControlActive = false;
      this.lastShipDragClientX = null;
      this.shipDragFrameAccumulator = this.currentFrame >= 0 ? this.currentFrame : 0;
      if (event && shipDisplay.hasPointerCapture && shipDisplay.hasPointerCapture(event.pointerId)) {
        shipDisplay.releasePointerCapture(event.pointerId);
      }
    };

    shipDisplay.addEventListener('pointerup', stopShipHorizontalControl);
    shipDisplay.addEventListener('pointercancel', stopShipHorizontalControl);
    shipDisplay.addEventListener('lostpointercapture', () => {
      this.isShipHorizontalDragActive = false;
      this.isShipHorizontalControlActive = false;
      this.lastShipDragClientX = null;
      this.shipDragFrameAccumulator = this.currentFrame >= 0 ? this.currentFrame : 0;
    });

    this.shipVisual = shipDisplay;
    shipContainer.appendChild(shipDisplay);

    // Equipment Slots
    const createEquipmentSlot = (label: string, position: { top?: string, bottom?: string, left?: string, right?: string }) => {
      const wrapper = document.createElement('div');
      const posStyle = Object.entries(position).map(([k, v]) => {
        if (k === 'dataSlot') return ''; // Metadata non CSS
        return `${k}:${v}`;
      }).join(';');

      wrapper.style.cssText = `
        position: absolute;
        ${posStyle};
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        z-index: 2;
      `;

      const slot = document.createElement('div');
      slot.style.cssText = `
        width: 80px;
        height: 80px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        backdrop-filter: blur(10px);
      `;
      slot.className = 'equipment-slot';
      slot.setAttribute('data-slot', (position as any).dataSlot || label.toUpperCase());
      slot.innerHTML = `<div style="font-size: 20px; opacity: 0.1;">+</div>`;

      const labelEl = document.createElement('div');
      labelEl.style.cssText = `
        font-size: 10px;
        font-weight: 800;
        color: rgba(255, 255, 255, 0.75);
        text-transform: uppercase;
        letter-spacing: 1px;
        text-align: center;
      `;
      labelEl.textContent = label;

      wrapper.appendChild(slot);
      wrapper.appendChild(labelEl);

      return wrapper;
    };

    shipContainer.appendChild(createEquipmentSlot('Hull', { top: '0', left: '160px', dataSlot: ItemSlot.HULL } as any));
    shipContainer.appendChild(createEquipmentSlot('Shield', { top: '160px', left: '0', dataSlot: ItemSlot.SHIELD } as any));
    shipContainer.appendChild(createEquipmentSlot('Laser', { top: '160px', right: '0', dataSlot: ItemSlot.LASER } as any));
    shipContainer.appendChild(createEquipmentSlot('Engine', { bottom: '0', left: '60px', dataSlot: ItemSlot.ENGINE } as any));
    shipContainer.appendChild(createEquipmentSlot('Missile', { bottom: '0', right: '60px', dataSlot: ItemSlot.MISSILE } as any));

    visualColumn.appendChild(shipContainer);

    // --- COLUMN 3: CARGO HOLD (Grid) ---
    const cargoColumn = document.createElement('div');
    cargoColumn.className = 'inventory-column cargo-column';
    cargoColumn.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: rgba(11, 14, 22, 0.58);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 2px;
      padding: 24px 18px 24px 24px;
      box-sizing: border-box;
      min-height: 0;
      overflow: hidden;
    `;

    const cargoHeader = document.createElement('h3');
    cargoHeader.textContent = 'INVENTORY';
    cargoHeader.style.cssText = `
      margin: 0;
      color: rgba(255, 255, 255, 0.82);
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 2px;
      line-height: 1;
    `;
    cargoColumn.appendChild(cargoHeader);

    const cargoGrid = document.createElement('div');
    cargoGrid.className = 'inventory-grid';
    cargoGrid.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      overflow-x: hidden;
      padding-right: 6px;
      flex: 1;
      min-height: 0;
      width: 100%;
      box-sizing: border-box;
      align-content: flex-start;
    `;

    for (let i = 0; i < 30; i++) {
      const slot = document.createElement('div');
      slot.style.cssText = `
          aspect-ratio: 1/1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        `;
      cargoGrid.appendChild(slot);
    }

    let scrollTimeout: any;
    cargoGrid.addEventListener('scroll', () => {
      cargoGrid.classList.add('is-scrolling');
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        cargoGrid.classList.remove('is-scrolling');
      }, 1000);
    });

    cargoColumn.appendChild(cargoGrid);

    mainLayout.appendChild(statsColumn);
    mainLayout.appendChild(visualColumn);
    mainLayout.appendChild(cargoColumn);
    content.appendChild(mainLayout);

    return content;
  }

  /**
   * Helper per renderizzare icone (supporta sia emoji che path immagini)
   */
  private renderIcon(icon: string, size: string = '24px', filter: string = ''): string {
    if (icon.includes('/') || icon.includes('.')) {
      // È un'immagine
      return `<img src="${icon}" style="width: ${size}; height: ${size}; object-fit: contain; ${filter ? `filter: ${filter};` : ''}">`;
    } else {
      // È un'emoji
      return `<div style="font-size: ${size}; line-height: 1;">${icon}</div>`;
    }
  }

  /**
   * Aggiorna i dati del pannello
   */
  update(): void {
    if (!this.playerSystem || !this.statsElements) return;

    let playerEntity = this.playerSystem.getPlayerEntity() || this.ecs.getPlayerEntity();
    if (!playerEntity) return;

    const health = this.ecs.getComponent(playerEntity, Health);
    const shield = this.ecs.getComponent(playerEntity, Shield);
    const damage = this.ecs.getComponent(playerEntity, Damage);
    const upgrades = this.ecs.getComponent(playerEntity, PlayerUpgrades);
    const inventory = this.ecs.getComponent(playerEntity, Inventory);
    const playerDef = getPlayerDefinition();

    if (this.statsElements.hp) {
      this.statsElements.hp.textContent = NumberFormatter.format(health ? health.max : playerDef.stats.health);
      const percent = health ? (health.current / health.max) * 100 : 100;
      const bar = (this.statsElements as any).hp_bar;
      if (bar) bar.style.width = `${percent}%`;
    }

    if (this.statsElements.shield) {
      const maxShield = shield ? shield.max : (playerDef.stats.shield || 0);
      this.statsElements.shield.textContent = NumberFormatter.format(maxShield);
      const percent = shield && shield.max > 0 ? (shield.current / shield.max) * 100 : 100;
      const bar = (this.statsElements as any).shield_bar;
      if (bar) bar.style.width = `${percent}%`;
    }

    if (this.statsElements.damage) {
      this.statsElements.damage.textContent = NumberFormatter.format(damage ? damage.damage : playerDef.stats.damage);
      const bonus = upgrades ? upgrades.getDamageBonus(inventory) : 1;
      const bar = (this.statsElements as any).damage_bar;
      if (bar) bar.style.width = `${Math.min(100, (bonus - 1) * 20 + 20)}%`;
    }

    if (this.statsElements.missile) {
      const bonus = upgrades ? upgrades.getMissileDamageBonus(inventory) : 1;
      this.statsElements.missile.textContent = NumberFormatter.format(Math.floor((playerDef.stats.missileDamage || 100) * bonus));
      const bar = (this.statsElements as any).missile_bar;
      if (bar) bar.style.width = `${Math.min(100, (bonus - 1) * 20 + 20)}%`;
    }

    if (this.statsElements.speed) {
      const bonus = upgrades ? upgrades.getSpeedBonus(inventory) : 1;
      this.statsElements.speed.textContent = `${Math.floor(playerDef.stats.speed * bonus)} u/s`;
      const bar = (this.statsElements as any).speed_bar;
      if (bar) bar.style.width = `${Math.min(100, (bonus - 1) * 20 + 20)}%`;
    }

    // Update equipment slots and cargo grid
    if (inventory) {
      this.renderInventory(inventory);
    }

    // Calculate overall power (average of raw values)
    const hpVal = health ? health.max : playerDef.stats.health;
    const shieldVal = shield ? shield.max : (playerDef.stats.shield || 0);
    const damageVal = damage ? damage.damage : playerDef.stats.damage;
    const missileVal = (playerDef.stats.missileDamage || 100) * (upgrades ? upgrades.getMissileDamageBonus(inventory) : 1);
    const speedVal = playerDef.stats.speed * (upgrades ? upgrades.getSpeedBonus(inventory) : 1);

    // Media dei valori numerici
    const overallPowerValue = (hpVal + shieldVal + damageVal + missileVal + speedVal) / 5;

    if (this.statsElements.total) {
      this.statsElements.total.textContent = Math.round(overallPowerValue).toString();
    }
  }

  /**
   * Renderizza l'inventario e gli slot equipaggiamento
   */
  private renderInventory(inventory: Inventory): void {
    const cargoGrid = this.container.querySelector('.inventory-grid') as HTMLElement | null;
    if (!cargoGrid) return;

    // 🚀 OPTIMIZATION: Check if inventory actually changed before destroying DOM
    const layoutSignature = `${cargoGrid.clientWidth}x${cargoGrid.clientHeight}`;
    const currentHash = JSON.stringify(inventory.items.map(i => ({ id: i.id, instanceId: i.instanceId }))) +
      JSON.stringify(inventory.equipped);
    if (this.lastInventoryHash === currentHash && this.lastInventoryLayoutSignature === layoutSignature) {
      // Still update visual slots (they are cheaper and might need updates even if items are same)
      this.updateVisualSlots(inventory);
      return;
    }
    this.lastInventoryHash = currentHash;
    this.lastInventoryLayoutSignature = layoutSignature;

    // Svuota e ripopola la griglia cargo (solo per item non equipaggiati)
    cargoGrid.innerHTML = '';

    // Mostra gli item nell'inventario (FILTRATI: solo quelli non equipaggiati)
    const equippedInstanceIds = new Set(Object.values(inventory.equipped));
    const unequippedItems = inventory.items.filter(itemInfo => !equippedInstanceIds.has(itemInfo.instanceId));
    const stackedItems = new Map<string, { itemId: string; instanceId: string; count: number }>();

    unequippedItems.forEach(itemInfo => {
      const itemDef = ITEM_REGISTRY[itemInfo.id];
      if (!itemDef) return;

      const existingStack = stackedItems.get(itemInfo.id);
      if (existingStack) {
        existingStack.count += 1;
        return;
      }

      stackedItems.set(itemInfo.id, {
        itemId: itemInfo.id,
        instanceId: itemInfo.instanceId,
        count: 1
      });
    });

    stackedItems.forEach(stackedItem => {
      const itemDef = ITEM_REGISTRY[stackedItem.itemId];
      if (!itemDef) return;

      const slot = document.createElement('div');
      // Rarity style
      let rarityColor = 'rgba(255, 255, 255, 0.05)';
      if (itemDef.rarity === 'UNCOMMON') rarityColor = 'rgba(34, 197, 94, 0.1)';
      if (itemDef.rarity === 'RARE') rarityColor = 'rgba(59, 130, 246, 0.1)';
      if (itemDef.rarity === 'EPIC') rarityColor = 'rgba(168, 85, 247, 0.1)';

      let rarityBorder = 'rgba(203, 213, 225, 0.28)';
      if (itemDef.rarity === 'UNCOMMON') rarityBorder = 'rgba(34, 197, 94, 0.3)';
      if (itemDef.rarity === 'RARE') rarityBorder = 'rgba(59, 130, 246, 0.3)';
      if (itemDef.rarity === 'EPIC') rarityBorder = 'rgba(168, 85, 247, 0.3)';

      const baseBackground = (itemDef.rarity === 'COMMON') ? 'rgba(30, 41, 59, 0.24)' : rarityColor;
      slot.style.cssText = `
        min-height: 78px;
        background: linear-gradient(135deg, ${baseBackground}, rgba(8, 12, 20, 0.78));
        border: 1px solid ${rarityBorder};
        border-radius: 2px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        box-sizing: border-box;
        cursor: pointer;
        transition: filter 0.2s ease, border-color 0.2s ease;
        flex-shrink: 0;
      `;

      slot.innerHTML = `
        <div style="width: 52px; display: flex; justify-content: center;">${this.renderIcon(itemDef.icon, '40px', itemDef.rarity !== 'COMMON' ? `drop-shadow(0 0 6px ${rarityBorder})` : '')}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="color: ${itemDef.rarity !== 'COMMON' ? rarityBorder.replace('0.3', '1.0') : '#ffffff'}; font-size: 15px; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; letter-spacing: 0.95px;">${itemDef.name}</div>
          <div style="color: rgba(255, 255, 255, 0.75); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px;">${itemDef.rarity} ${itemDef.slot}  •  x${stackedItem.count}</div>
        </div>
      `;
      slot.onmouseenter = () => {
        slot.style.filter = 'brightness(1.08)';
        slot.style.borderColor = itemDef.rarity === 'COMMON' ? 'rgba(226, 232, 240, 0.48)' : rarityBorder.replace('0.3', '0.55');
      };
      slot.onmouseleave = () => {
        slot.style.filter = 'none';
        slot.style.borderColor = rarityBorder;
      };

      slot.title = `${itemDef.name} x${stackedItem.count}\n${itemDef.description}\n(Click to Equip)`;

      slot.onclick = (e) => {
        e.stopPropagation();
        this.showItemDetails(itemDef, stackedItem.instanceId, false, inventory, stackedItem.count);
      };

      cargoGrid.appendChild(slot);
    });

    // Riempi con slot vuoti in base allo spazio disponibile della colonna
    const emptySlots = this.getInventoryPlaceholderCount(cargoGrid, stackedItems.size);
    for (let i = 0; i < emptySlots; i++) {
      const slot = document.createElement('div');
      slot.style.cssText = `
        min-height: 78px;
        background: linear-gradient(135deg, rgba(148, 163, 184, 0.06), rgba(15, 23, 42, 0.32));
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 2px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: rgba(203, 213, 225, 0.52);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
      `;
      slot.textContent = 'Empty Slot';
      cargoGrid.appendChild(slot);
    }

    // Aggiorna gli slot visuali della nave (quelli intorno alla nave)
    this.updateVisualSlots(inventory);
  }

  private getInventoryPlaceholderCount(cargoGrid: HTMLElement, usedRows: number): number {
    const fallbackRows = 10;
    const minRows = 8;
    const maxRows = 16;
    const rowHeight = 78;
    const rowGap = 10;

    const availableHeight = Number(cargoGrid.clientHeight || 0);
    const dynamicRows = availableHeight > 0
      ? Math.floor((availableHeight + rowGap) / (rowHeight + rowGap))
      : fallbackRows;

    const targetRows = Math.max(minRows, Math.min(maxRows, dynamicRows));
    return Math.max(0, targetRows - usedRows);
  }

  /**
   * Aggiorna gli slot di equipaggiamento visuali
   */
  private updateVisualSlots(inventory: Inventory): void {
    const slots = [
      { slot: ItemSlot.HULL, label: 'Hull' },
      { slot: ItemSlot.SHIELD, label: 'Shield' },
      { slot: ItemSlot.LASER, label: 'Laser' },
      { slot: ItemSlot.ENGINE, label: 'Engine' },
      { slot: ItemSlot.MISSILE, label: 'Missile' }
    ];

    slots.forEach(s => {
      const slotElement = Array.from(this.container.querySelectorAll('.equipment-slot'))
        .find(el => (el as HTMLElement).getAttribute('data-slot') === s.slot) as HTMLElement;

      if (slotElement) {
        const equippedId = inventory.getEquippedItemId(s.slot);
        const instanceId = Object.entries(inventory.equipped).find(([slot, id]) => slot === s.slot)?.[1] || '';

        if (equippedId) {
          const item = ITEM_REGISTRY[equippedId];
          const isImage = item.icon.includes('/') || item.icon.includes('.');

          // Rarity style for slot
          let rarityColor = 'rgba(255, 255, 255, 0.15)';
          let borderColor = 'rgba(255, 255, 255, 0.4)';
          if (item.rarity === 'UNCOMMON') { rarityColor = 'rgba(34, 197, 94, 0.15)'; borderColor = 'rgba(34, 197, 94, 0.6)'; }
          if (item.rarity === 'RARE') { rarityColor = 'rgba(59, 130, 246, 0.15)'; borderColor = 'rgba(59, 130, 246, 0.6)'; }
          if (item.rarity === 'EPIC') { rarityColor = 'rgba(168, 85, 247, 0.15)'; borderColor = 'rgba(168, 85, 247, 0.6)'; }

          slotElement.innerHTML = isImage ? this.renderIcon(item.icon, '72px', item.rarity !== 'COMMON' ? `drop-shadow(0 0 15px ${borderColor})` : '') : '';
          slotElement.style.background = rarityColor;
          slotElement.style.borderColor = borderColor;
          slotElement.style.boxShadow = item.rarity !== 'COMMON' ? `inset 0 0 20px ${borderColor}33` : 'none';

          // Add details click
          slotElement.onclick = (e) => {
            e.stopPropagation();
            this.showItemDetails(item, instanceId, true, inventory);
          };
        } else {
          slotElement.innerHTML = `<div style="font-size: 20px; opacity: 0.1;">+</div>`;
          slotElement.style.background = 'rgba(255, 255, 255, 0.08)';
          slotElement.style.borderColor = 'rgba(255, 255, 255, 0.18)';
          slotElement.onclick = null;
        }
      }
    });
  }

  /**
   * Avvia l'animazione della nave tramite setInterval (più affidabile per sprite-loop UI)
   */
  private startShipAnimation(): void {
    this.stopShipAnimation();
    this.recoverElements();

    this.currentFrame = -1;

    this.animationRequestId = setInterval(() => {
      // Recupero forzato se null (safety check estremo)
      if (!this.shipVisual) this.recoverElements();

      if (!this.shipVisual || !document.body.contains(this.shipVisual)) {
        return;
      }

      if (!this.isVisible) return;

      if (!this.isShipHorizontalControlActive) {
        // Senso orario: decrementiamo il frame
        const nextFrame = this.currentFrame <= 0 ? 71 : this.currentFrame - 1;
        this.applyShipAnimationFrame(nextFrame);
      }

      // Aggiorna dati ogni 10 step
      if (this.currentFrame % 10 === 0) {
        try { this.update(); } catch (e) { }
      }
    }, 50) as any;
  }

  private applyShipAnimationFrame(frame: number): void {
    const totalFrames = 72;
    const normalized = ((Math.floor(frame) % totalFrames) + totalFrames) % totalFrames;
    this.currentFrame = normalized;

    const row = Math.floor(normalized / 10);
    const col = normalized % 10;
    const spacing = 191;

    const posX = -(col * spacing + 2);
    const posY = -(row * spacing + 2);

    if (this.shipVisual) {
      this.shipVisual.style.backgroundPosition = `${posX}px ${posY}px`;
    }
  }

  private stopShipAnimation(): void {
    if (this.animationRequestId) {
      clearInterval(this.animationRequestId as any);
      this.animationRequestId = null;
    }
  }

  public setPlayerSystem(playerSystem: PlayerSystem): void {
    this.playerSystem = playerSystem;
    if (this.isVisible) this.update();
  }

  public setClientNetworkSystem(networkSystem: any): void {
    this.networkSystem = networkSystem;
  }

  protected onShow(): void {
    this.recoverElements();
    this.lastInventoryHash = ''; // Force fresh render on first show
    this.lastInventoryLayoutSignature = '';
    this.isShipHorizontalControlActive = false;
    this.isShipHorizontalDragActive = false;
    this.lastShipDragClientX = null;
    this.shipDragFrameAccumulator = this.currentFrame >= 0 ? this.currentFrame : 0;
    this.update();
    setTimeout(() => {
      if (this.isVisible) this.startShipAnimation();
    }, 150);
  }

  protected onHide(): void {
    this.stopShipAnimation();
    this.isShipHorizontalControlActive = false;
    this.isShipHorizontalDragActive = false;
    this.lastShipDragClientX = null;
    this.shipDragFrameAccumulator = this.currentFrame >= 0 ? this.currentFrame : 0;
    if (this.activePopup) {
      this.activePopup.remove();
      this.activePopup = null;
    }
  }

  public invalidateInventoryCache(): void {
    this.lastInventoryHash = '';
    this.lastInventoryLayoutSignature = '';
  }

  private getSellValue(item: any): number {
    const explicitSellValue = Number(item?.sellValue);
    if (Number.isFinite(explicitSellValue) && explicitSellValue > 0) {
      return Math.floor(explicitSellValue);
    }

    const rarity = String(item?.rarity || 'COMMON').toUpperCase();
    if (rarity === 'UNCOMMON') return 300;
    if (rarity === 'RARE') return 900;
    if (rarity === 'EPIC') return 2500;
    return 120;
  }

  private showItemDetails(item: any, instanceId: string, isEquipped: boolean, inventory: Inventory, stackCount: number = 1): void {
    if (this.activePopup) {
      this.activePopup.remove();
    }

    const popup = document.createElement('div');
    popup.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(5px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      width: 380px;
      background: rgba(20, 20, 25, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 0 50px rgba(0, 0, 0, 0.5);
      border-radius: 4px;
      padding: 0;
      overflow: hidden;
      transform: scale(0.9);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;

    // Rarity Color
    let rarityColor = '#ffffff';
    if (item.rarity === 'UNCOMMON') rarityColor = '#22c55e'; // Green
    if (item.rarity === 'RARE') rarityColor = '#3b82f6'; // Blue
    if (item.rarity === 'EPIC') rarityColor = '#a855f7'; // Purple

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      background: linear-gradient(to right, ${rarityColor}22, transparent);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      gap: 15px;
    `;

    header.innerHTML = `
      ${this.renderIcon(item.icon, '32px', `drop-shadow(0 0 10px ${rarityColor}88)`)}
      <div>
        <div style="color: ${rarityColor}; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">${item.name}</div>
        <div style="color: rgba(255, 255, 255, 0.4); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${item.rarity} ${item.slot} MODULE  •  x${Math.max(1, stackCount)}</div>
      </div>
    `;

    // Body
    const body = document.createElement('div');
    body.style.cssText = `padding: 24px; display: flex; flex-direction: column; gap: 20px;`;

    // Description
    const desc = document.createElement('div');
    desc.style.cssText = `color: rgba(255, 255, 255, 0.7); font-size: 13px; line-height: 1.5; font-style: italic;`;
    desc.textContent = item.description;

    // Stats Grid
    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = `display: grid; grid-template-columns: 1fr 1fr; gap: 10px;`;

    const createStat = (label: string, value: string, isBonus: boolean = true) => {
      return `
        <div style="background: rgba(255, 255, 255, 0.03); padding: 10px; border-radius: 2px;">
          <div style="color: rgba(255, 255, 255, 0.4); font-size: 10px; font-weight: 700; text-transform: uppercase;">${label}</div>
          <div style="color: ${isBonus ? '#22c55e' : '#ffffff'}; font-size: 14px; font-weight: 700; margin-top: 4px;">${value}</div>
        </div>
      `;
    };

    let statsHtml = '';
    if (item.stats) {
      if (item.stats.hpBonus) statsHtml += createStat('Hull Integrity', `+${item.stats.hpBonus * 100}%`);
      if (item.stats.shieldBonus) statsHtml += createStat('Shield Capacity', `+${item.stats.shieldBonus * 100}%`);
      if (item.stats.damageBonus) statsHtml += createStat('Laser Damage', `+${item.stats.damageBonus * 100}%`);
      if (item.stats.missileBonus) statsHtml += createStat('Missile Damage', `+${item.stats.missileBonus * 100}%`);
      if (item.stats.speedBonus) statsHtml += createStat('Engine Thrust', `+${item.stats.speedBonus * 100}%`);
    }
    statsGrid.innerHTML = statsHtml;

    // Actions
    const actions = document.createElement('div');
    actions.style.cssText = `display: flex; gap: 10px; margin-top: 10px;`;

    const actionBtn = document.createElement('button');
    const isEquipAction = !isEquipped;

    actionBtn.style.cssText = `
      flex: 1;
      padding: 14px;
      background: ${isEquipAction ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
      border: 1px solid ${isEquipAction ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'};
      color: ${isEquipAction ? '#4ade80' : '#f87171'};
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 2px;
      cursor: pointer;
      transition: all 0.2s ease;
      border-radius: 2px;
    `;
    actionBtn.textContent = isEquipAction ? 'EQUIP MODULE' : 'UNEQUIP MODULE';

    actionBtn.onmouseenter = () => {
      actionBtn.style.background = isEquipAction ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
    };
    actionBtn.onmouseleave = () => {
      actionBtn.style.background = isEquipAction ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';
    };

    actionBtn.onclick = () => {
      if (isEquipped) {
        inventory.unequipSlot(item.slot);
        if (this.networkSystem?.sendEquipItemRequest) {
          this.networkSystem.sendEquipItemRequest(null, item.slot);
        }
      } else {
        inventory.equipItem(instanceId, item.slot);
        if (this.networkSystem?.sendEquipItemRequest) {
          this.networkSystem.sendEquipItemRequest(instanceId, item.slot);
        }
      }

      if (this.playerSystem) {
        this.playerSystem.refreshPlayerStats();
      }

      // Chiudi popup e aggiorna
      popup.style.opacity = '0';
      setTimeout(() => popup.remove(), 200);
      this.activePopup = null;
      this.update();
    };

    let sellBtn: HTMLButtonElement | null = null;
    let quantityControls: HTMLDivElement | null = null;
    if (!isEquipped) {
      sellBtn = document.createElement('button');
      let sellRequestInFlight = false;
      const unitSellValue = this.getSellValue(item);
      const maxSellQuantity = Math.max(1, stackCount);
      let selectedSellQuantity = 1;
      sellBtn.style.cssText = `
        flex: 1;
        padding: 14px;
        background: rgba(245, 158, 11, 0.2);
        border: 1px solid rgba(245, 158, 11, 0.45);
        color: #fbbf24;
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
        border-radius: 2px;
      `;
      const updateSellButtonLabel = () => {
        const totalSellValue = unitSellValue * selectedSellQuantity;
        sellBtn!.textContent = `SELL ${selectedSellQuantity} (+${NumberFormatter.format(totalSellValue)}c)`;
      };

      if (maxSellQuantity > 1) {
        quantityControls = document.createElement('div');
        quantityControls.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          border-radius: 2px;
          margin-top: 6px;
        `;

        const quantityLabel = document.createElement('div');
        quantityLabel.style.cssText = `
          color: rgba(255, 255, 255, 0.65);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
        `;
        quantityLabel.textContent = 'Sell quantity';

        const controls = document.createElement('div');
        controls.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        const qtyValue = document.createElement('div');
        qtyValue.style.cssText = `
          min-width: 72px;
          text-align: center;
          color: #f8fafc;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.5px;
        `;

        const createQtyButton = (label: string) => {
          const button = document.createElement('button');
          button.style.cssText = `
            width: 30px;
            height: 30px;
            border: 1px solid rgba(245, 158, 11, 0.4);
            background: rgba(245, 158, 11, 0.14);
            color: #fbbf24;
            font-size: 14px;
            font-weight: 800;
            cursor: pointer;
            border-radius: 2px;
          `;
          button.textContent = label;
          return button;
        };

        const minusBtn = createQtyButton('-');
        const plusBtn = createQtyButton('+');
        const maxBtn = document.createElement('button');
        maxBtn.style.cssText = `
          height: 30px;
          padding: 0 10px;
          border: 1px solid rgba(245, 158, 11, 0.4);
          background: rgba(245, 158, 11, 0.14);
          color: #fbbf24;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          border-radius: 2px;
          letter-spacing: 0.8px;
        `;
        maxBtn.textContent = 'MAX';

        const updateQuantityControls = () => {
          qtyValue.textContent = `${selectedSellQuantity} / ${maxSellQuantity}`;
          minusBtn.disabled = selectedSellQuantity <= 1;
          plusBtn.disabled = selectedSellQuantity >= maxSellQuantity;
          minusBtn.style.opacity = minusBtn.disabled ? '0.4' : '1';
          plusBtn.style.opacity = plusBtn.disabled ? '0.4' : '1';
          updateSellButtonLabel();
        };

        minusBtn.onclick = () => {
          selectedSellQuantity = Math.max(1, selectedSellQuantity - 1);
          updateQuantityControls();
        };
        plusBtn.onclick = () => {
          selectedSellQuantity = Math.min(maxSellQuantity, selectedSellQuantity + 1);
          updateQuantityControls();
        };
        maxBtn.onclick = () => {
          selectedSellQuantity = maxSellQuantity;
          updateQuantityControls();
        };

        controls.appendChild(minusBtn);
        controls.appendChild(qtyValue);
        controls.appendChild(plusBtn);
        controls.appendChild(maxBtn);
        quantityControls.appendChild(quantityLabel);
        quantityControls.appendChild(controls);
        updateQuantityControls();
      } else {
        updateSellButtonLabel();
      }

      sellBtn.onmouseenter = () => {
        sellBtn!.style.background = 'rgba(245, 158, 11, 0.3)';
      };
      sellBtn.onmouseleave = () => {
        sellBtn!.style.background = 'rgba(245, 158, 11, 0.2)';
      };
      sellBtn.onclick = () => {
        if (sellRequestInFlight) {
          return;
        }
        sellRequestInFlight = true;
        sellBtn!.style.pointerEvents = 'none';
        sellBtn!.style.opacity = '0.6';

        if (this.networkSystem?.sendSellItemRequest) {
          this.networkSystem.sendSellItemRequest(instanceId, item.id, selectedSellQuantity);
        } else if (this.networkSystem?.sendMessage) {
          this.networkSystem.sendMessage({
            type: 'sell_item',
            instanceId: instanceId,
            itemId: item.id,
            quantity: selectedSellQuantity,
            timestamp: Date.now()
          });
        }

        popup.style.opacity = '0';
        setTimeout(() => popup.remove(), 200);
        this.activePopup = null;
      };
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = `
      padding: 14px 18px;
      min-width: 96px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.6);
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
      transition: all 0.2s ease;
      border-radius: 2px;
    `;
    cancelBtn.textContent = 'CANCEL';
    cancelBtn.onclick = () => {
      popup.style.opacity = '0';
      setTimeout(() => popup.remove(), 200);
      this.activePopup = null;
    };
    cancelBtn.onmouseenter = () => {
      cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      cancelBtn.style.color = '#ffffff';
    };
    cancelBtn.onmouseleave = () => {
      cancelBtn.style.background = 'rgba(255, 255, 255, 0.05)';
      cancelBtn.style.color = 'rgba(255, 255, 255, 0.6)';
    };

    actions.appendChild(actionBtn);
    if (sellBtn) {
      actions.appendChild(sellBtn);
    }
    actions.appendChild(cancelBtn);

    body.appendChild(desc);
    body.appendChild(statsGrid);
    if (quantityControls) {
      body.appendChild(quantityControls);
    }
    body.appendChild(actions);

    card.appendChild(header);
    card.appendChild(body);
    popup.appendChild(card);

    // Click outside to close
    popup.onclick = (e) => {
      if (e.target === popup) {
        cancelBtn.click();
      }
    };

    this.container.appendChild(popup);
    this.activePopup = popup;

    // Animation in
    requestAnimationFrame(() => {
      popup.style.opacity = '1';
      card.style.transform = 'scale(1)';
    });
  }
}
