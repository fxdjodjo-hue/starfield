import { BasePanel } from './FloatingIcon';
import type { PanelConfig } from './PanelConfig';
import type { PanelData } from './UIManager';
import { ECS } from '../../infrastructure/ecs/ECS';
import { PlayerSystem } from '../../systems/player/PlayerSystem';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { PlayerUpgrades } from '../../entities/player/PlayerUpgrades';
import { getPlayerDefinition } from '../../config/PlayerConfig';
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

  constructor(config: PanelConfig, ecs: ECS, playerSystem?: PlayerSystem) {
    super(config);
    this.ecs = ecs;
    this.playerSystem = playerSystem || null;

    // Inizializzazione esplicita stati post-super
    this.animationTime = 0;
    this.currentFrame = -1;
    this.animationRequestId = null;
    this.lastTimestamp = 0;

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
      background: rgba(0, 0, 0, 0.2);
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
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 5px;
      text-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'FLEET MANAGEMENT & CARGO';
    subtitle.style.cssText = `
      margin: 4px 0 0 0;
      color: rgba(255, 255, 255, 0.5);
      font-size: 11px;
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
    `;

    // --- COLUMN 1: SHIP STATUS (Stats) ---
    const statsColumn = document.createElement('div');
    statsColumn.className = 'inventory-column stats-column';
    statsColumn.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 2px;
      padding: 24px;
      box-sizing: border-box;
      min-height: 0;
    `;

    const statsHeader = document.createElement('h3');
    statsHeader.textContent = 'TELEMETRY DATA';
    statsHeader.style.cssText = `
      margin: 0;
      color: rgba(255, 255, 255, 0.4);
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 2px;
      line-height: 1;
    `;

    statsColumn.appendChild(statsHeader);

    const statsList = document.createElement('div');
    statsList.style.cssText = `display: flex; flex-direction: column; gap: 15px;`;

    const createStatRow = (label: string, id: string, icon: string) => {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 2px;
        border: 1px solid rgba(255, 255, 255, 0.03);
      `;
      row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: rgba(255, 255, 255, 0.5); font-size: 11px; font-weight: 700; letter-spacing: 1px;">${icon} ${label}</span>
          <span class="stat-value-${id}" style="color: #ffffff; font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums;">--</span>
        </div>
        <div style="height: 4px; background: rgba(255, 255, 255, 0.05); border-radius: 2px; overflow: hidden;">
          <div class="stat-bar-${id}" style="height: 100%; width: 0%; background: #ffffff; opacity: 0.6; transition: width 0.5s ease;"></div>
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
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
      box-sizing: border-box;
      backdrop-filter: blur(5px);
    `;
    powerBox.innerHTML = `
      <div style="color: rgba(255, 255, 255, 0.4); font-size: 13px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin: 0; line-height: 1; align-self: center;">Combat Power</div>
      <div class="stat-value-total" style="color: #ffffff; font-size: 32px; font-weight: 900; text-shadow: 0 0 20px rgba(255, 255, 255, 0.2); line-height: 1;">--</div>
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
    `;
    this.shipVisual = shipDisplay;
    shipContainer.appendChild(shipDisplay);

    // Equipment Slots
    const createEquipmentSlot = (label: string, position: { top?: string, bottom?: string, left?: string, right?: string }) => {
      const slot = document.createElement('div');
      const posStyle = Object.entries(position).map(([k, v]) => `${k}:${v}`).join(';');
      slot.style.cssText = `
        position: absolute;
        ${posStyle};
        width: 80px;
        height: 80px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
        backdrop-filter: blur(10px);
        z-index: 2;
      `;
      slot.innerHTML = `
        <div style="font-size: 24px; opacity: 0.2;">+</div>
        <div style="font-size: 8px; font-weight: 800; color: rgba(255, 255, 255, 0.4); margin-top: 4px; text-align: center; text-transform: uppercase;">${label}</div>
      `;

      slot.addEventListener('mouseenter', () => {
        slot.style.background = 'rgba(255, 255, 255, 0.1)';
        slot.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        slot.style.transform = 'scale(1.1)';
      });
      slot.addEventListener('mouseleave', () => {
        slot.style.background = 'rgba(255, 255, 255, 0.03)';
        slot.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        slot.style.transform = 'scale(1)';
      });

      return slot;
    };

    shipContainer.appendChild(createEquipmentSlot('Hull', { top: '0', left: '160px' }));
    shipContainer.appendChild(createEquipmentSlot('Shield', { top: '160px', left: '0' }));
    shipContainer.appendChild(createEquipmentSlot('Laser', { top: '160px', right: '0' }));
    shipContainer.appendChild(createEquipmentSlot('Engine', { bottom: '0', left: '60px' }));
    shipContainer.appendChild(createEquipmentSlot('Missile', { bottom: '0', right: '60px' }));

    visualColumn.appendChild(shipContainer);

    // --- COLUMN 3: CARGO HOLD (Grid) ---
    const cargoColumn = document.createElement('div');
    cargoColumn.className = 'inventory-column cargo-column';
    cargoColumn.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 2px;
      padding: 24px 0 24px 24px;
      box-sizing: border-box;
      min-height: 0;
    `;

    const cargoHeader = document.createElement('h3');
    cargoHeader.textContent = 'INVENTORY';
    cargoHeader.style.cssText = `
      margin: 0 24px 0 0;
      color: rgba(255, 255, 255, 0.4);
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 2px;
      line-height: 1;
    `;
    cargoColumn.appendChild(cargoHeader);

    const cargoGrid = document.createElement('div');
    cargoGrid.className = 'inventory-grid';
    cargoGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      overflow-y: auto;
      padding-right: 12px;
      flex: 1;
      min-height: 0;
    `;

    for (let i = 0; i < 30; i++) {
      const slot = document.createElement('div');
      slot.style.cssText = `
          aspect-ratio: 1/1;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
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
      const bonus = upgrades ? upgrades.getDamageBonus() : 1;
      const bar = (this.statsElements as any).damage_bar;
      if (bar) bar.style.width = `${Math.min(100, (bonus - 1) * 20 + 20)}%`;
    }

    if (this.statsElements.missile) {
      const bonus = upgrades ? upgrades.getMissileDamageBonus() : 1;
      this.statsElements.missile.textContent = NumberFormatter.format(Math.floor((playerDef.stats.missileDamage || 100) * bonus));
      const bar = (this.statsElements as any).missile_bar;
      if (bar) bar.style.width = `${Math.min(100, (bonus - 1) * 20 + 20)}%`;
    }

    if (this.statsElements.speed) {
      const bonus = upgrades ? upgrades.getSpeedBonus() : 1;
      this.statsElements.speed.textContent = `${Math.floor(playerDef.stats.speed * bonus)} u/s`;
      const bar = (this.statsElements as any).speed_bar;
      if (bar) bar.style.width = `${Math.min(100, (bonus - 1) * 20 + 20)}%`;
    }

    // Calculate overall power (average of raw values)
    const hpVal = health ? health.max : playerDef.stats.health;
    const shieldVal = shield ? shield.max : (playerDef.stats.shield || 0);
    const damageVal = damage ? damage.damage : playerDef.stats.damage;
    const missileVal = (playerDef.stats.missileDamage || 100) * (upgrades ? upgrades.getMissileDamageBonus() : 1);
    const speedVal = playerDef.stats.speed * (upgrades ? upgrades.getSpeedBonus() : 1);

    // Media dei valori numerici
    const overallPowerValue = (hpVal + shieldVal + damageVal + missileVal + speedVal) / 5;

    if (this.statsElements.total) {
      this.statsElements.total.textContent = Math.round(overallPowerValue).toString();
    }
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

      // Senso orario: decrementiamo il frame
      if (this.currentFrame <= 0) {
        this.currentFrame = 71;
      } else {
        this.currentFrame--;
      }

      const row = Math.floor(this.currentFrame / 10);
      const col = this.currentFrame % 10;
      const spacing = 191;

      const posX = -(col * spacing + 2);
      const posY = -(row * spacing + 2);

      this.shipVisual.style.backgroundPosition = `${posX}px ${posY}px`;

      // Aggiorna dati ogni 10 step
      if (this.currentFrame % 10 === 0) {
        try { this.update(); } catch (e) { }
      }
    }, 50) as any;
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

  protected onShow(): void {
    this.recoverElements();
    this.update();
    setTimeout(() => {
      if (this.isVisible) this.startShipAnimation();
    }, 150);
  }

  protected onHide(): void {
    this.stopShipAnimation();
  }
}
