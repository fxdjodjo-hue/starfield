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
import { ITEM_REGISTRY, ItemSlot } from '../../config/ItemConfig';
import { NumberFormatter } from '../../core/utils/ui/NumberFormatter';
import {
  normalizeAmmoInventory,
  getAmmoCountForTier
} from '../../core/utils/ammo/AmmoInventory';
import {
  normalizeMissileInventory,
  getMissileCountForTier,
  MISSILE_TIERS
} from '../../core/utils/ammo/MissileInventory';
import {
  getPlayerShipSkinById,
  getSelectedPlayerShipSkinId,
  listPlayerShipSkins,
  getUnlockedPlayerShipSkinIds,
  type PlayerShipSkinDefinition
} from '../../config/ShipSkinConfig';
import type { MissileTier } from '../../config/NetworkConfig';

type ShipSkinCurrency = 'credits' | 'cosmos';
type AmmoTierSlot = 'x1' | 'x2' | 'x3';
const AMMO_TIERS: AmmoTierSlot[] = ['x1', 'x2', 'x3'];
const AMMO_ICON_BY_TIER: Record<AmmoTierSlot, string> = {
  x1: 'assets/actionbar/x1.png',
  x2: 'assets/actionbar/x2.png',
  x3: 'assets/actionbar/x3.png'
};
const AMMO_MULTIPLIER_BY_TIER: Record<AmmoTierSlot, number> = {
  x1: 1,
  x2: 2,
  x3: 3
};
const AMMO_DESCRIPTION_BY_TIER: Record<AmmoTierSlot, string> = {
  x1: 'Standard rounds for balanced ship weapon output.',
  x2: 'Enhanced rounds that double weapon impact at a higher tactical cost.',
  x3: 'Overcharged rounds with maximum impact for high-priority targets.'
};

const MISSILE_ICON_BY_TIER: Record<MissileTier, string> = {
  m1: 'assets/actionbar/missile1.png',
  m2: 'assets/actionbar/missile2.png',
  m3: 'assets/actionbar/missile3.png'
};

const MISSILE_DESCRIPTION_BY_TIER: Record<MissileTier, string> = {
  m1: 'Standard missiles for reliable kinetic area damage.',
  m2: 'Advanced missiles with larger blast radius and enhanced tracking.',
  m3: 'Heavy ordnance with maximum destructive payload.'
};

interface ShipSkinPriceInfo {
  currency: ShipSkinCurrency;
  amount: number;
}

/**
 * InventoryPanel - Pannello per la gestione dell'inventario e dell'equipaggiamento
 * Layout a tre colonne: Stats, Ship Visualization, Cargo
 */
export class InventoryPanel extends BasePanel {
  private static readonly SHIP_VISUAL_FIXED_WIDTH = 220;
  private static readonly SHIP_VISUAL_FIXED_HEIGHT = 220;
  private static readonly SHIP_VISUAL_FILL_RATIO = 0.82;
  private static readonly SHIP_VISUAL_ROTATION_DEGREES_PER_SECOND = 180;
  private static readonly SHIP_VISUAL_TICK_MS = 50;
  private static readonly SHIP_VISUAL_AUTO_ROTATION_SLOW_TICK_MS = 85;
  private static readonly SHIP_VISUAL_AUTO_ROTATION_SLOW_TICK_LIMIT = 8;
  private static readonly SHIP_VISUAL_DRAG_DEGREES_PER_PIXEL = 1.8;
  private static readonly SHIP_VISUAL_DRAG_CLICK_TOLERANCE_PX = 4;

  private ecs!: ECS;
  private playerSystem: PlayerSystem | null = null;
  private statsElements!: { [key: string]: HTMLElement };
  private shipVisual!: HTMLElement;
  private animationTime: number = 0;
  private currentFrame: number = -1;
  private animationRequestId: number | null = null;
  private lastTimestamp: number = 0;
  private autoRotationSlowTickCount: number = 0;
  private autoRotationDisabledForSession: boolean = false;
  private isShipHorizontalControlActive: boolean = false;
  private isShipHorizontalDragActive: boolean = false;
  private lastShipDragClientX: number | null = null;
  private shipDragDistancePx: number = 0;
  private shipDragFrameAccumulator: number = 0;
  private shipDragMoved: boolean = false;
  private networkSystem: any = null;
  private activePopup: HTMLElement | null = null;
  private shipSkinPopup: HTMLElement | null = null;
  private selectedShipSkinId: string = '';
  private currentShipSkin: PlayerShipSkinDefinition | null = null;
  private renderedShipVisualSkinId: string = '';
  private availableShipSkins: PlayerShipSkinDefinition[] = [];
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
    this.autoRotationSlowTickCount = 0;
    this.autoRotationDisabledForSession = false;
    this.isShipHorizontalControlActive = false;
    this.isShipHorizontalDragActive = false;
    this.lastShipDragClientX = null;
    this.shipDragDistancePx = 0;
    this.shipDragFrameAccumulator = 0;
    this.shipDragMoved = false;
    this.selectedShipSkinId = getSelectedPlayerShipSkinId();
    this.currentShipSkin = getPlayerShipSkinById(this.selectedShipSkinId);
    this.renderedShipVisualSkinId = this.currentShipSkin.id;
    this.availableShipSkins = listPlayerShipSkins();

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
      position: relative;
      overflow: hidden;
      border-radius: 2px;
      filter: drop-shadow(0 0 50px rgba(255, 255, 255, 0.15));
      background-repeat: no-repeat;
      image-rendering: pixelated;
      cursor: pointer;
      user-select: none;
      touch-action: none;
      transition: box-shadow 0.2s ease, transform 0.2s ease;
    `;
    const beginShipHorizontalDrag = (clientX: number) => {
      this.isShipHorizontalDragActive = true;
      this.isShipHorizontalControlActive = true;
      this.lastShipDragClientX = clientX;
      this.shipDragDistancePx = 0;
      this.shipDragFrameAccumulator = this.currentFrame >= 0 ? this.currentFrame : 0;
      this.shipDragMoved = false;
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
      this.shipDragDistancePx += Math.abs(deltaX);
      if (this.shipDragDistancePx >= InventoryPanel.SHIP_VISUAL_DRAG_CLICK_TOLERANCE_PX) {
        this.shipDragMoved = true;
      }

      const totalFrames = Math.max(1, this.getActiveShipSkin().preview.totalFrames || 1);
      const deltaFrames =
        (deltaX * InventoryPanel.SHIP_VISUAL_DRAG_DEGREES_PER_PIXEL / 360) * totalFrames;
      this.shipDragFrameAccumulator += deltaFrames;
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
      this.shipDragDistancePx = 0;
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
      this.shipDragDistancePx = 0;
      this.shipDragFrameAccumulator = this.currentFrame >= 0 ? this.currentFrame : 0;
    });
    shipDisplay.addEventListener('click', () => {
      if (this.shipDragMoved) {
        this.shipDragMoved = false;
        return;
      }
      this.openShipSkinSelector();
    });

    this.shipVisual = shipDisplay;
    this.updateShipVisualStyle();
    this.applyShipAnimationFrame(0);
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

    const shipHint = document.createElement('div');
    shipHint.textContent = 'Drag to rotate - click to change skin';
    shipHint.style.cssText = `
      color: rgba(255, 255, 255, 0.6);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      margin-top: -4px;
    `;
    visualColumn.appendChild(shipHint);

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

    // Keep ship visual sprite/style synchronized with server-selected skin.
    // This is required when purchase/equip responses arrive while panel is already open.
    const skinVisualUpdated = this.syncShipVisualSkinStyle();
    if (skinVisualUpdated) {
      this.applyShipAnimationFrame(this.shipDragFrameAccumulator);
    }

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

    const ammoInventory = this.getAmmoInventoryForUi();

    // Update equipment slots and cargo grid
    if (inventory) {
      this.renderInventory(inventory, ammoInventory);
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

  private getAmmoInventoryForUi() {
    const contextState = this.networkSystem?.gameContext;
    return normalizeAmmoInventory(
      contextState?.playerAmmoInventory ?? contextState?.playerInventory?.ammo,
      contextState?.playerAmmo
    );
  }

  private getMissileInventoryForUi() {
    const contextState = this.networkSystem?.gameContext;
    return normalizeMissileInventory(
      contextState?.playerMissileInventory ?? contextState?.playerInventory?.missileAmmo
    );
  }

  /**
   * Renderizza l'inventario e gli slot equipaggiamento
   */
  private renderInventory(inventory: Inventory, ammoInventory = this.getAmmoInventoryForUi(), missileInventory = this.getMissileInventoryForUi()): void {
    const cargoGrid = this.container.querySelector('.inventory-grid') as HTMLElement | null;
    if (!cargoGrid) return;

    // 🚀 OPTIMIZATION: Check if inventory actually changed before destroying DOM
    const layoutSignature = `${cargoGrid.clientWidth}x${cargoGrid.clientHeight}`;
    const ammoSignature = `${ammoInventory.selectedTier}:${AMMO_TIERS.map(tier => getAmmoCountForTier(ammoInventory, tier)).join(',')}`;
    const missileSignature = `${missileInventory.selectedTier}:${MISSILE_TIERS.map(tier => getMissileCountForTier(missileInventory, tier)).join(',')}`;
    const currentHash = JSON.stringify(inventory.items.map(i => ({ id: i.id, instanceId: i.instanceId }))) +
      JSON.stringify(inventory.equipped) +
      ammoSignature +
      missileSignature;
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

    const selectedAmmoTier = ammoInventory.selectedTier as AmmoTierSlot;
    let renderedAmmoCardsCount = 0;
    for (const tier of AMMO_TIERS) {
      const ammoCount = getAmmoCountForTier(ammoInventory, tier);
      if (ammoCount <= 0) {
        continue;
      }
      renderedAmmoCardsCount += 1;
      const isSelectedTier = tier === selectedAmmoTier;
      const ammoBorder = isSelectedTier ? 'rgba(56, 189, 248, 0.6)' : 'rgba(148, 163, 184, 0.35)';
      const ammoLabelColor = isSelectedTier ? '#7dd3fc' : '#e2e8f0';

      const ammoSlot = document.createElement('div');
      ammoSlot.style.cssText = `
        min-height: 78px;
        background: linear-gradient(135deg, ${isSelectedTier ? 'rgba(14, 116, 144, 0.25)' : 'rgba(30, 41, 59, 0.22)'}, rgba(8, 12, 20, 0.78));
        border: 1px solid ${ammoBorder};
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

      ammoSlot.innerHTML = `
        <div style="width: 52px; display: flex; justify-content: center;">${this.renderIcon(AMMO_ICON_BY_TIER[tier], '36px')}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="color: ${ammoLabelColor}; font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.95px;">Ammo ${tier.toUpperCase()}</div>
          <div style="color: rgba(255, 255, 255, 0.78); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px;">${isSelectedTier ? 'Active Tier  •  ' : ''}x${NumberFormatter.format(ammoCount)}  •  Not Equippable</div>
        </div>
      `;

      ammoSlot.onmouseenter = () => {
        ammoSlot.style.filter = 'brightness(1.08)';
        ammoSlot.style.borderColor = isSelectedTier ? 'rgba(56, 189, 248, 0.78)' : 'rgba(148, 163, 184, 0.55)';
      };
      ammoSlot.onmouseleave = () => {
        ammoSlot.style.filter = 'none';
        ammoSlot.style.borderColor = ammoBorder;
      };

      ammoSlot.title = `Ammo ${tier.toUpperCase()} x${NumberFormatter.format(ammoCount)}\nNot equippable\nClick for details`;
      ammoSlot.onclick = (event) => {
        event.stopPropagation();
        this.showAmmoDetails(tier, ammoCount);
      };
      cargoGrid.appendChild(ammoSlot);
    }

    // Render Missile Cards
    for (const tier of MISSILE_TIERS) {
      const missileCount = getMissileCountForTier(missileInventory, tier as MissileTier);
      if (missileCount <= 0) {
        continue;
      }

      const missileBorder = 'rgba(236, 72, 153, 0.45)'; // Distinct pinkish color for missiles
      const missileSlot = document.createElement('div');
      missileSlot.style.cssText = `
        min-height: 78px;
        background: linear-gradient(135deg, rgba(83, 21, 55, 0.22), rgba(8, 12, 20, 0.78));
        border: 1px solid ${missileBorder};
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

      missileSlot.innerHTML = `
        <div style="width: 52px; display: flex; justify-content: center;">${this.renderIcon(MISSILE_ICON_BY_TIER[tier as MissileTier], '36px')}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="color: #f472b6; font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.95px;">Missile ${tier.toUpperCase()}</div>
          <div style="color: rgba(255, 255, 255, 0.78); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px;">x${NumberFormatter.format(missileCount)}  •  Ordnance</div>
        </div>
      `;

      missileSlot.onmouseenter = () => {
        missileSlot.style.filter = 'brightness(1.15)';
        missileSlot.style.borderColor = 'rgba(236, 72, 153, 0.75)';
      };
      missileSlot.onmouseleave = () => {
        missileSlot.style.filter = 'none';
        missileSlot.style.borderColor = missileBorder;
      };

      missileSlot.title = `Missile ${tier.toUpperCase()} x${NumberFormatter.format(missileCount)}\nNot equippable\nClick for details`;
      missileSlot.onclick = (event) => {
        event.stopPropagation();
        this.showMissileDetails(tier as MissileTier, missileCount);
      };
      cargoGrid.appendChild(missileSlot);
    }

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
    const emptySlots = this.getInventoryPlaceholderCount(cargoGrid, stackedItems.size + renderedAmmoCardsCount);
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

  private getServerShipSkinState(preferredSkinId?: string | null): {
    selectedSkinId: string;
    unlockedSkinIds: string[];
  } {
    const contextState = this.networkSystem?.gameContext;
    const selectedSkinId = getSelectedPlayerShipSkinId(
      preferredSkinId ||
      contextState?.playerShipSkinId ||
      this.selectedShipSkinId ||
      null
    );
    const unlockedSkinIds = getUnlockedPlayerShipSkinIds(
      contextState?.unlockedPlayerShipSkinIds || [],
      selectedSkinId
    );

    if (contextState) {
      contextState.playerShipSkinId = selectedSkinId;
      contextState.unlockedPlayerShipSkinIds = unlockedSkinIds;
    }

    return { selectedSkinId, unlockedSkinIds };
  }

  private ensureShipSkinState(preferredSkinId?: string | null): void {
    const { selectedSkinId } = this.getServerShipSkinState(preferredSkinId);
    this.selectedShipSkinId = selectedSkinId;

    if (!this.currentShipSkin || !this.currentShipSkin.preview || this.currentShipSkin.id !== selectedSkinId) {
      this.currentShipSkin = getPlayerShipSkinById(selectedSkinId);
    }

    if (!Array.isArray(this.availableShipSkins) || this.availableShipSkins.length === 0) {
      this.availableShipSkins = listPlayerShipSkins();
    }
  }

  private getActiveShipSkin(): PlayerShipSkinDefinition {
    this.ensureShipSkinState();
    return this.currentShipSkin!;
  }

  private getPlayerCurrencyBalance(currency: ShipSkinCurrency): number {
    const inventory = this.networkSystem?.gameContext?.playerInventory;
    if (!inventory) return 0;
    const rawValue = Number(currency === 'cosmos' ? inventory.cosmos : inventory.credits);
    return Number.isFinite(rawValue) ? Math.max(0, Math.floor(rawValue)) : 0;
  }

  private resolveShipSkinPrice(skin: PlayerShipSkinDefinition): ShipSkinPriceInfo {
    const cosmosAmount = Math.max(0, Math.floor(skin.priceCosmos || 0));
    if (cosmosAmount > 0) {
      return { currency: 'cosmos', amount: cosmosAmount };
    }

    const creditsAmount = Math.max(0, Math.floor(skin.priceCredits || 0));
    return { currency: 'credits', amount: creditsAmount };
  }

  private formatShipSkinPrice(price: ShipSkinPriceInfo): string {
    const label = price.currency === 'cosmos' ? 'Cosmos' : 'Credits';
    return `${NumberFormatter.format(price.amount)} ${label}`;
  }

  private requestServerShipSkinAction(
    skinId: string,
    action: 'equip' | 'purchase' | 'purchase_and_equip'
  ): boolean {
    if (!this.networkSystem || typeof this.networkSystem.sendShipSkinActionRequest !== 'function') {
      return false;
    }

    this.networkSystem.sendShipSkinActionRequest(skinId, action);
    return true;
  }

  private confirmShipSkinAction(params: {
    title: string;
    description: string;
    confirmText: string;
    canConfirm: boolean;
    balanceText?: string;
    accent: ShipSkinCurrency | 'equip';
    blockedConfirmText?: string;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.activePopup) {
        this.activePopup.remove();
        this.activePopup = null;
      }

      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.78);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 180;
        padding: 20px;
        box-sizing: border-box;
        opacity: 0;
        transition: opacity 0.16s ease;
      `;

      const card = document.createElement('div');
      card.style.cssText = `
        width: min(420px, 100%);
        background: rgba(16, 21, 34, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        box-shadow: 0 22px 84px rgba(0, 0, 0, 0.58);
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        opacity: 0;
        transform: translateY(10px) scale(0.985);
        transition: transform 0.18s ease, opacity 0.18s ease;
      `;

      const title = document.createElement('div');
      title.textContent = params.title;
      title.style.cssText = `
        color: #ffffff;
        font-size: 14px;
        font-weight: 900;
        letter-spacing: 1.3px;
        text-transform: uppercase;
      `;

      const description = document.createElement('div');
      description.textContent = params.description;
      description.style.cssText = `
        color: rgba(255, 255, 255, 0.9);
        font-size: 13px;
        line-height: 1.5;
        letter-spacing: 0.3px;
      `;

      const balanceLabel = document.createElement('div');
      balanceLabel.textContent = params.balanceText || '';
      balanceLabel.style.cssText = `
        color: ${params.canConfirm ? 'rgba(255, 255, 255, 0.74)' : 'rgba(248, 113, 113, 0.95)'};
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        display: ${params.balanceText ? 'block' : 'none'};
      `;

      const actions = document.createElement('div');
      actions.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      `;

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText = `
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.85);
        border-radius: 2px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.8px;
        text-transform: uppercase;
      `;

      let borderColor = 'rgba(56, 189, 248, 0.7)';
      let backgroundColor = 'rgba(56, 189, 248, 0.2)';
      let textColor = '#7dd3fc';
      if (params.accent === 'credits') {
        borderColor = 'rgba(245, 158, 11, 0.65)';
        backgroundColor = 'rgba(245, 158, 11, 0.2)';
        textColor = '#fbbf24';
      } else if (params.accent === 'cosmos') {
        borderColor = 'rgba(34, 211, 238, 0.65)';
        backgroundColor = 'rgba(34, 211, 238, 0.2)';
        textColor = '#67e8f9';
      }

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.textContent = params.canConfirm
        ? params.confirmText
        : (params.blockedConfirmText || 'Unavailable');
      confirmBtn.style.cssText = `
        border: 1px solid ${params.canConfirm ? borderColor : 'rgba(248, 113, 113, 0.55)'};
        background: ${params.canConfirm ? backgroundColor : 'rgba(127, 29, 29, 0.26)'};
        color: ${params.canConfirm ? textColor : '#fca5a5'};
        border-radius: 2px;
        padding: 8px 12px;
        cursor: ${params.canConfirm ? 'pointer' : 'not-allowed'};
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        opacity: ${params.canConfirm ? '1' : '0.75'};
      `;
      confirmBtn.disabled = !params.canConfirm;

      const closePopup = (confirmed: boolean) => {
        if (this.activePopup === overlay) this.activePopup = null;
        overlay.style.pointerEvents = 'none';
        overlay.style.opacity = '0';
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px) scale(0.985)';
        window.setTimeout(() => overlay.remove(), 180);
        resolve(confirmed);
      };

      cancelBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closePopup(false);
      });

      confirmBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!params.canConfirm) return;
        closePopup(true);
      });

      card.addEventListener('click', (event) => {
        event.stopPropagation();
      });
      card.addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });

      overlay.addEventListener('click', (event) => {
        event.stopPropagation();
        if (event.target === overlay) closePopup(false);
      });
      overlay.addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });

      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
      card.appendChild(title);
      card.appendChild(description);
      card.appendChild(balanceLabel);
      card.appendChild(actions);
      overlay.appendChild(card);

      this.activePopup = overlay;
      this.container.appendChild(overlay);
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0) scale(1)';
      });
    });
  }

  private confirmShipSkinPurchase(skin: PlayerShipSkinDefinition): Promise<boolean> {
    const price = this.resolveShipSkinPrice(skin);
    const currencyLabel = price.currency === 'cosmos' ? 'Cosmos' : 'Credits';
    const balance = this.getPlayerCurrencyBalance(price.currency);
    const canAfford = balance >= price.amount;

    return this.confirmShipSkinAction({
      title: 'Unlock Ship Skin',
      description: `Buy ${skin.displayName} for ${this.formatShipSkinPrice(price)}?`,
      confirmText: 'Buy & Equip',
      canConfirm: canAfford,
      balanceText: `Balance: ${NumberFormatter.format(balance)} ${currencyLabel}`,
      accent: price.currency,
      blockedConfirmText: `Not Enough ${currencyLabel}`
    });
  }

  private confirmShipSkinEquip(skin: PlayerShipSkinDefinition): Promise<boolean> {
    return this.confirmShipSkinAction({
      title: 'Equip Ship Skin',
      description: `Equip ${skin.displayName}?`,
      confirmText: 'Equip',
      canConfirm: true,
      accent: 'equip'
    });
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
    this.shipDragFrameAccumulator = this.currentFrame >= 0 ? this.currentFrame : 0;
    if (this.autoRotationDisabledForSession) {
      this.applyShipAnimationFrame(this.shipDragFrameAccumulator);
      return;
    }

    this.autoRotationSlowTickCount = 0;
    this.lastTimestamp = performance.now();

    this.animationRequestId = setInterval(() => {
      // Recupero forzato se null (safety check estremo)
      if (!this.shipVisual) this.recoverElements();

      const now = performance.now();
      if (!this.shipVisual || !document.body.contains(this.shipVisual)) {
        this.lastTimestamp = now;
        return;
      }

      if (!this.isVisible) {
        this.lastTimestamp = now;
        return;
      }

      if (document.hidden) {
        this.lastTimestamp = now;
        return;
      }

      const deltaMs = Math.min(100, Math.max(0, now - this.lastTimestamp));
      this.lastTimestamp = now;
      if (deltaMs >= InventoryPanel.SHIP_VISUAL_AUTO_ROTATION_SLOW_TICK_MS) {
        this.autoRotationSlowTickCount += 1;
      } else {
        this.autoRotationSlowTickCount = Math.max(0, this.autoRotationSlowTickCount - 1);
      }

      if (this.autoRotationSlowTickCount >= InventoryPanel.SHIP_VISUAL_AUTO_ROTATION_SLOW_TICK_LIMIT) {
        this.autoRotationDisabledForSession = true;
        this.stopShipAnimation();
        return;
      }

      if (!this.isShipHorizontalControlActive) {
        const skin = this.getActiveShipSkin();
        const totalFrames = Math.max(1, skin.preview.totalFrames || 1);
        const framesPerSecond =
          (InventoryPanel.SHIP_VISUAL_ROTATION_DEGREES_PER_SECOND / 360) * totalFrames;

        this.shipDragFrameAccumulator -= framesPerSecond * (deltaMs / 1000);
        this.applyShipAnimationFrame(this.shipDragFrameAccumulator);
      } else {
        this.shipDragFrameAccumulator = this.currentFrame >= 0 ? this.currentFrame : 0;
      }

      // Aggiorna dati ogni 10 step
      if (this.currentFrame % 10 === 0) {
        try { this.update(); } catch (e) { }
      }
    }, InventoryPanel.SHIP_VISUAL_TICK_MS) as any;
  }

  private applyShipAnimationFrame(frame: number): void {
    const skin = this.getActiveShipSkin();
    this.syncShipVisualSkinStyle(skin);
    const preview = skin.preview;
    const totalFrames = Math.max(1, preview.totalFrames);
    const columns = Math.max(1, preview.columns);
    const normalized = ((Math.floor(frame) % totalFrames) + totalFrames) % totalFrames;
    this.currentFrame = normalized;

    const row = Math.floor(normalized / columns);
    const col = normalized % columns;
    const posX = -(col * preview.spacingX + preview.offsetX);
    const posY = -(row * preview.spacingY + preview.offsetY);

    if (this.shipVisual && document.body.contains(this.shipVisual)) {
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
    this.ensureShipSkinState(this.networkSystem?.gameContext?.playerShipSkinId || this.selectedShipSkinId);
    this.updateShipVisualStyle();
  }

  private updateShipVisualStyle(): void {
    if (!this.shipVisual) return;

    const skin = this.getActiveShipSkin();
    this.applyShipVisualStyleForSkin(skin);
    this.renderedShipVisualSkinId = skin.id;
  }

  private applyShipVisualStyleForSkin(skin: PlayerShipSkinDefinition): void {
    if (!this.shipVisual) return;

    const preview = skin.preview;
    const { scale } = this.getShipVisualMetrics(preview);
    this.shipVisual.style.width = `${preview.frameWidth}px`;
    this.shipVisual.style.height = `${preview.frameHeight}px`;
    this.shipVisual.style.transform = `scale(${scale})`;
    this.shipVisual.style.backgroundImage = `url('${skin.basePath}.png')`;
    this.shipVisual.style.backgroundSize = `${preview.sheetWidth}px ${preview.sheetHeight}px`;
    this.shipVisual.style.backgroundPosition = `${-preview.offsetX}px ${-preview.offsetY}px`;
  }

  private syncShipVisualSkinStyle(skin?: PlayerShipSkinDefinition): boolean {
    if (!this.shipVisual) return false;

    const activeSkin = skin || this.getActiveShipSkin();
    if (this.renderedShipVisualSkinId === activeSkin.id) return false;

    this.applyShipVisualStyleForSkin(activeSkin);
    this.renderedShipVisualSkinId = activeSkin.id;

    const totalFrames = Math.max(1, activeSkin.preview.totalFrames || 1);
    const normalizedFrame =
      ((Math.floor(this.shipDragFrameAccumulator) % totalFrames) + totalFrames) % totalFrames;
    this.currentFrame = normalizedFrame;
    this.shipDragFrameAccumulator = normalizedFrame;
    return true;
  }

  private getShipVisualMetrics(preview: PlayerShipSkinDefinition['preview']): {
    scale: number;
  } {
    const safeFrameWidth = Math.max(1, preview.frameWidth);
    const safeFrameHeight = Math.max(1, preview.frameHeight);
    const fitScale = Math.min(
      InventoryPanel.SHIP_VISUAL_FIXED_WIDTH / safeFrameWidth,
      InventoryPanel.SHIP_VISUAL_FIXED_HEIGHT / safeFrameHeight
    );
    const scale = fitScale * InventoryPanel.SHIP_VISUAL_FILL_RATIO;

    return {
      scale
    };
  }

  private closeShipSkinSelector(instant: boolean = false): void {
    if (!this.shipSkinPopup) return;

    const overlay = this.shipSkinPopup;
    this.shipSkinPopup = null;
    if (instant) {
      overlay.remove();
      return;
    }

    const panel = overlay.firstElementChild as HTMLElement | null;
    overlay.style.pointerEvents = 'none';
    overlay.style.opacity = '0';
    if (panel) {
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(10px) scale(0.985)';
    }

    window.setTimeout(() => {
      overlay.remove();
    }, 180);
  }

  private openShipSkinSelector(): void {
    this.closeShipSkinSelector(true);
    this.ensureShipSkinState();

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.82);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 120;
      padding: 24px;
      box-sizing: border-box;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      width: min(560px, 100%);
      background: rgba(14, 18, 28, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 4px;
      box-shadow: 0 20px 80px rgba(0, 0, 0, 0.55);
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      transform: translateY(10px) scale(0.985);
      opacity: 0;
      transition: transform 0.22s ease, opacity 0.22s ease;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    `;

    const title = document.createElement('div');
    title.textContent = 'Select Ship Skin';
    title.style.cssText = `
      color: #ffffff;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 1.8px;
      text-transform: uppercase;
    `;

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.22);
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.85);
      border-radius: 2px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
    `;
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.borderColor = 'rgba(226, 232, 240, 0.42)';
      closeButton.style.background = 'rgba(255, 255, 255, 0.14)';
      closeButton.style.color = '#ffffff';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.borderColor = 'rgba(255, 255, 255, 0.22)';
      closeButton.style.background = 'rgba(255, 255, 255, 0.06)';
      closeButton.style.color = 'rgba(255, 255, 255, 0.85)';
    });
    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.closeShipSkinSelector();
    });

    header.appendChild(title);
    header.appendChild(closeButton);

    const serverSkinState = this.getServerShipSkinState();
    this.selectedShipSkinId = serverSkinState.selectedSkinId;

    const options = document.createElement('div');
    options.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    `;

    for (const skin of this.availableShipSkins) {
      const isSelected = skin.id === serverSkinState.selectedSkinId;
      const isUnlocked = serverSkinState.unlockedSkinIds.includes(skin.id);
      const price = this.resolveShipSkinPrice(skin);
      const isCosmosPrice = price.currency === 'cosmos';
      const canAfford = this.getPlayerCurrencyBalance(price.currency) >= price.amount;
      const skinPreview = skin.preview;

      const option = document.createElement('button');
      option.type = 'button';
      option.style.cssText = `
        border: 1px solid ${isSelected
          ? 'rgba(56, 189, 248, 0.85)'
          : isUnlocked
            ? 'rgba(255, 255, 255, 0.16)'
            : 'rgba(245, 158, 11, 0.45)'};
        background: ${isSelected
          ? 'rgba(56, 189, 248, 0.16)'
          : isUnlocked
            ? 'rgba(255, 255, 255, 0.04)'
            : 'rgba(255, 255, 255, 0.025)'};
        border-radius: 3px;
        cursor: pointer;
        padding: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        min-height: 120px;
        transition: filter 0.2s ease, border-color 0.2s ease;
      `;
      const spritePreview = document.createElement('div') as HTMLDivElement;
      const previewScale = 0.34;
      spritePreview.style.cssText = `
        width: ${Math.round(skinPreview.frameWidth * previewScale)}px;
        height: ${Math.round(skinPreview.frameHeight * previewScale)}px;
        background-image: url('${skin.basePath}.png');
        background-repeat: no-repeat;
        background-size: ${Math.round(skinPreview.sheetWidth * previewScale)}px ${Math.round(skinPreview.sheetHeight * previewScale)}px;
        background-position: ${-Math.round(skinPreview.offsetX * previewScale)}px ${-Math.round(skinPreview.offsetY * previewScale)}px;
        image-rendering: pixelated;
        opacity: ${isUnlocked ? '1' : '0.6'};
        filter: drop-shadow(0 0 12px ${isUnlocked
          ? 'rgba(255, 255, 255, 0.22)'
          : 'rgba(245, 158, 11, 0.22)'});
      `;

      const label = document.createElement('div');
      label.textContent = skin.displayName;
      label.style.cssText = `
        color: #ffffff;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 1px;
        text-transform: uppercase;
        text-align: center;
      `;

      const statusBadge = document.createElement('div');
      const statusText = isSelected
        ? 'EQUIPPED'
        : isUnlocked
          ? 'OWNED'
          : this.formatShipSkinPrice(price).toUpperCase();
      statusBadge.textContent = statusText;
      statusBadge.style.cssText = `
        color: ${isSelected
          ? 'rgba(56, 189, 248, 0.96)'
          : isUnlocked
            ? 'rgba(226, 232, 240, 0.9)'
            : canAfford
              ? (isCosmosPrice ? 'rgba(103, 232, 249, 0.95)' : 'rgba(245, 158, 11, 0.95)')
              : 'rgba(248, 113, 113, 0.96)'};
        border: 1px solid ${isSelected
          ? 'rgba(56, 189, 248, 0.6)'
          : isUnlocked
            ? 'rgba(226, 232, 240, 0.35)'
            : canAfford
              ? (isCosmosPrice ? 'rgba(103, 232, 249, 0.45)' : 'rgba(245, 158, 11, 0.45)')
              : 'rgba(248, 113, 113, 0.45)'};
        background: ${isSelected
          ? 'rgba(56, 189, 248, 0.14)'
          : isUnlocked
            ? 'rgba(148, 163, 184, 0.12)'
            : canAfford
              ? (isCosmosPrice ? 'rgba(34, 211, 238, 0.12)' : 'rgba(245, 158, 11, 0.12)')
              : 'rgba(127, 29, 29, 0.22)'};
        border-radius: 999px;
        padding: 3px 10px;
        min-height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.9px;
        text-transform: uppercase;
      `;

      const actionHint = document.createElement('div');
      actionHint.textContent = isSelected
        ? 'Current Skin'
        : isUnlocked
          ? 'Click To Equip'
          : canAfford
            ? 'Click To Unlock'
            : `Not Enough ${isCosmosPrice ? 'Cosmos' : 'Credits'}`;
      actionHint.style.cssText = `
        color: ${(!isUnlocked && !canAfford)
          ? 'rgba(248, 113, 113, 0.82)'
          : 'rgba(255, 255, 255, 0.56)'};
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.7px;
        text-transform: uppercase;
        text-align: center;
      `;

      option.appendChild(spritePreview);
      option.appendChild(label);
      option.appendChild(statusBadge);
      option.appendChild(actionHint);

      option.addEventListener('mouseenter', () => {
        option.style.filter = 'brightness(1.06)';
      });
      option.addEventListener('mouseleave', () => {
        option.style.filter = 'none';
      });

      option.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (isSelected) return;

        if (!isUnlocked) {
          const confirmedPurchase = await this.confirmShipSkinPurchase(skin);
          if (!confirmedPurchase) return;
        } else {
          const confirmedEquip = await this.confirmShipSkinEquip(skin);
          if (!confirmedEquip) return;
        }

        const action = isUnlocked ? 'equip' : 'purchase_and_equip';
        const requestSent = this.requestServerShipSkinAction(skin.id, action);
        if (!requestSent) {
          option.style.borderColor = 'rgba(248, 113, 113, 0.92)';
          statusBadge.textContent = 'SERVER OFFLINE';
          statusBadge.style.color = 'rgba(248, 113, 113, 0.98)';
          statusBadge.style.borderColor = 'rgba(248, 113, 113, 0.62)';
          statusBadge.style.background = 'rgba(127, 29, 29, 0.28)';
          actionHint.textContent = 'Try Again';
          actionHint.style.color = 'rgba(248, 113, 113, 0.85)';
          return;
        }

        this.closeShipSkinSelector();
      });

      options.appendChild(option);
    }

    panel.appendChild(header);
    panel.appendChild(options);
    overlay.appendChild(panel);

    // Prevent global "click outside panel" handlers from receiving skin selector clicks.
    panel.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    panel.addEventListener('mousedown', (event) => {
      event.stopPropagation();
    });

    overlay.addEventListener('click', (event) => {
      event.stopPropagation();
      if (event.target === overlay) this.closeShipSkinSelector();
    });
    overlay.addEventListener('mousedown', (event) => {
      event.stopPropagation();
    });

    this.shipSkinPopup = overlay;
    this.container.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0) scale(1)';
    });
  }

  protected onShow(): void {
    this.recoverElements();

    this.ensureShipSkinState(this.networkSystem?.gameContext?.playerShipSkinId || this.selectedShipSkinId);
    this.updateShipVisualStyle();
    this.lastInventoryHash = ''; // Force fresh render on first show
    this.lastInventoryLayoutSignature = '';
    this.isShipHorizontalControlActive = false;
    this.isShipHorizontalDragActive = false;
    this.lastShipDragClientX = null;
    this.shipDragDistancePx = 0;
    this.autoRotationDisabledForSession = false;
    this.autoRotationSlowTickCount = 0;
    this.shipDragFrameAccumulator = this.currentFrame >= 0 ? this.currentFrame : 0;
    this.shipDragMoved = false;
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
    this.shipDragDistancePx = 0;
    this.shipDragFrameAccumulator = this.currentFrame >= 0 ? this.currentFrame : 0;
    this.shipDragMoved = false;
    if (this.activePopup) {
      this.activePopup.remove();
      this.activePopup = null;
    }
    this.closeShipSkinSelector(true);
  }

  public invalidateInventoryCache(): void {
    this.lastInventoryHash = '';
    this.lastInventoryLayoutSignature = '';
  }

  private requestAmmoSell(ammoTier: AmmoTierSlot, quantity: number): boolean {
    const normalizedQuantity = Number.isFinite(Number(quantity))
      ? Math.max(1, Math.floor(Number(quantity)))
      : 1;

    if (this.networkSystem?.sendSellAmmoRequest) {
      return !!this.networkSystem.sendSellAmmoRequest(ammoTier, normalizedQuantity);
    }

    if (this.networkSystem?.sendMessage) {
      this.networkSystem.sendMessage({
        type: 'sell_item',
        clientId: this.networkSystem?.clientId,
        itemId: `ammo_${ammoTier}`,
        quantity: normalizedQuantity,
        timestamp: Date.now()
      });
      return true;
    }

    return false;
  }

  private showAmmoDetails(ammoTier: AmmoTierSlot, availableQuantity: number): void {
    const normalizedAvailableQuantity = Number.isFinite(Number(availableQuantity))
      ? Math.max(0, Math.floor(Number(availableQuantity)))
      : 0;
    if (normalizedAvailableQuantity <= 0) {
      return;
    }

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

    const tierColor = ammoTier === 'x1'
      ? '#7dd3fc'
      : ammoTier === 'x2'
        ? '#fbbf24'
        : '#f472b6';
    const tierMultiplier = AMMO_MULTIPLIER_BY_TIER[ammoTier] || 1;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      background: linear-gradient(to right, ${tierColor}22, transparent);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      gap: 15px;
    `;

    header.innerHTML = `
      ${this.renderIcon(AMMO_ICON_BY_TIER[ammoTier], '32px', `drop-shadow(0 0 10px ${tierColor}88)`)}
      <div>
        <div style="color: ${tierColor}; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Ammo ${ammoTier.toUpperCase()}</div>
        <div style="color: rgba(255, 255, 255, 0.4); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">AMMUNITION  â€¢  x${NumberFormatter.format(normalizedAvailableQuantity)}</div>
      </div>
    `;

    const body = document.createElement('div');
    body.style.cssText = `padding: 24px; display: flex; flex-direction: column; gap: 20px;`;

    const desc = document.createElement('div');
    desc.style.cssText = `color: rgba(255, 255, 255, 0.7); font-size: 13px; line-height: 1.5; font-style: italic;`;
    desc.textContent = `${AMMO_DESCRIPTION_BY_TIER[ammoTier]} Not equippable as a ship module.`;

    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = `display: grid; grid-template-columns: 1fr 1fr; gap: 10px;`;
    const createStat = (label: string, value: string, isAccent: boolean = false) => `
      <div style="background: rgba(255, 255, 255, 0.03); padding: 10px; border-radius: 2px;">
        <div style="color: rgba(255, 255, 255, 0.4); font-size: 10px; font-weight: 700; text-transform: uppercase;">${label}</div>
        <div style="color: ${isAccent ? tierColor : '#ffffff'}; font-size: 14px; font-weight: 700; margin-top: 4px;">${value}</div>
      </div>
    `;
    statsGrid.innerHTML = [
      createStat('Damage Tier', `x${tierMultiplier}`, true),
      createStat('Sell Price', 'Server-defined'),
      createStat('Available', NumberFormatter.format(normalizedAvailableQuantity)),
      createStat('Equippable', 'No')
    ].join('');

    const actions = document.createElement('div');
    actions.style.cssText = `display: flex; gap: 10px; margin-top: 10px;`;

    const sellBtn = document.createElement('button');
    let sellRequestInFlight = false;
    const maxSellQuantity = Math.max(1, normalizedAvailableQuantity);
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
      sellBtn.textContent = `SELL ${selectedSellQuantity}`;
    };

    let quantityControls: HTMLDivElement | null = null;
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
      sellBtn.style.background = 'rgba(245, 158, 11, 0.3)';
    };
    sellBtn.onmouseleave = () => {
      sellBtn.style.background = 'rgba(245, 158, 11, 0.2)';
    };
    sellBtn.onclick = () => {
      if (sellRequestInFlight) return;
      sellRequestInFlight = true;
      sellBtn.style.pointerEvents = 'none';
      sellBtn.style.opacity = '0.6';

      const sellRequested = this.requestAmmoSell(ammoTier, selectedSellQuantity);
      if (!sellRequested) {
        sellRequestInFlight = false;
        sellBtn.style.pointerEvents = 'auto';
        sellBtn.style.opacity = '1';
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('ui:system-message', {
            detail: { content: 'Unable to sell ammo right now' }
          }));
        }
        return;
      }

      popup.style.opacity = '0';
      setTimeout(() => popup.remove(), 200);
      this.activePopup = null;
    };

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

    actions.appendChild(sellBtn);
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

    popup.onclick = (event) => {
      if (event.target === popup) {
        cancelBtn.click();
      }
    };

    this.container.appendChild(popup);
    this.activePopup = popup;

    requestAnimationFrame(() => {
      popup.style.opacity = '1';
      card.style.transform = 'scale(1)';
    });
  }

  private requestMissileSell(missileTier: MissileTier, quantity: number): boolean {
    const normalizedQuantity = Number.isFinite(Number(quantity))
      ? Math.max(1, Math.floor(Number(quantity)))
      : 1;

    if (this.networkSystem?.sendSellMissileRequest) {
      return !!this.networkSystem.sendSellMissileRequest(missileTier, normalizedQuantity);
    }

    if (this.networkSystem?.sendMessage) {
      this.networkSystem.sendMessage({
        type: 'sell_item',
        clientId: this.networkSystem?.clientId,
        itemId: `missile_${missileTier}`,
        quantity: normalizedQuantity,
        timestamp: Date.now()
      });
      return true;
    }

    return false;
  }

  private showMissileDetails(missileTier: MissileTier, availableQuantity: number): void {
    const normalizedAvailableQuantity = Number.isFinite(Number(availableQuantity))
      ? Math.max(0, Math.floor(Number(availableQuantity)))
      : 0;
    if (normalizedAvailableQuantity <= 0) {
      return;
    }

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

    const tierColor = missileTier === 'm1'
      ? '#7dd3fc'
      : missileTier === 'm2'
        ? '#fbbf24'
        : '#f472b6';

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      background: linear-gradient(to right, ${tierColor}22, transparent);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      gap: 15px;
    `;

    header.innerHTML = `
      ${this.renderIcon(MISSILE_ICON_BY_TIER[missileTier], '32px', `drop-shadow(0 0 10px ${tierColor}88)`)}
      <div>
        <div style="color: ${tierColor}; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Missile ${missileTier.toUpperCase()}</div>
        <div style="color: rgba(255, 255, 255, 0.4); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">AMMUNITION  •  x${NumberFormatter.format(normalizedAvailableQuantity)}</div>
      </div>
    `;

    const body = document.createElement('div');
    body.style.cssText = `padding: 24px; display: flex; flex-direction: column; gap: 20px;`;

    const desc = document.createElement('div');
    desc.style.cssText = `color: rgba(255, 255, 255, 0.7); font-size: 13px; line-height: 1.5; font-style: italic;`;
    desc.textContent = `${MISSILE_DESCRIPTION_BY_TIER[missileTier]} Not equippable as a ship module.`;

    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = `display: grid; grid-template-columns: 1fr 1fr; gap: 10px;`;
    const createStat = (label: string, value: string, isAccent: boolean = false) => `
      <div style="background: rgba(255, 255, 255, 0.03); padding: 10px; border-radius: 2px;">
        <div style="color: rgba(255, 255, 255, 0.4); font-size: 10px; font-weight: 700; text-transform: uppercase;">${label}</div>
        <div style="color: ${isAccent ? tierColor : '#ffffff'}; font-size: 14px; font-weight: 700; margin-top: 4px;">${value}</div>
      </div>
    `;
    const getMultiplier = (t: string) => t === 'm1' ? 1 : t === 'm2' ? 2 : 3;
    statsGrid.innerHTML = [
      createStat('Damage Tier', `x${getMultiplier(missileTier)}`, true),
      createStat('Sell Price', 'Server-defined'),
      createStat('Available', NumberFormatter.format(normalizedAvailableQuantity)),
      createStat('Equippable', 'No')
    ].join('');

    const actions = document.createElement('div');
    actions.style.cssText = `display: flex; gap: 10px; margin-top: 10px;`;

    const sellBtn = document.createElement('button');
    let sellRequestInFlight = false;
    const maxSellQuantity = Math.max(1, normalizedAvailableQuantity);
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
      sellBtn.textContent = `SELL ${selectedSellQuantity}`;
    };

    let quantityControls: HTMLDivElement | null = null;
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
      sellBtn.style.background = 'rgba(245, 158, 11, 0.3)';
    };
    sellBtn.onmouseleave = () => {
      sellBtn.style.background = 'rgba(245, 158, 11, 0.2)';
    };
    sellBtn.onclick = () => {
      if (sellRequestInFlight) return;
      sellRequestInFlight = true;
      sellBtn.style.pointerEvents = 'none';
      sellBtn.style.opacity = '0.6';

      const sellRequested = this.requestMissileSell(missileTier, selectedSellQuantity);
      if (!sellRequested) {
        sellRequestInFlight = false;
        sellBtn.style.pointerEvents = 'auto';
        sellBtn.style.opacity = '1';
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('ui:system-message', {
            detail: { content: 'Unable to sell missile right now' }
          }));
        }
        return;
      }

      popup.style.opacity = '0';
      setTimeout(() => popup.remove(), 200);
      this.activePopup = null;
    };

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

    actions.appendChild(sellBtn);
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

    popup.onclick = (event) => {
      if (event.target === popup) {
        cancelBtn.click();
      }
    };

    this.container.appendChild(popup);
    this.activePopup = popup;

    requestAnimationFrame(() => {
      popup.style.opacity = '1';
      card.style.transform = 'scale(1)';
    });
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
        sellBtn!.textContent = `SELL ${selectedSellQuantity}`;
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

