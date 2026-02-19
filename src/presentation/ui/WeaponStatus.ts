import { DisplayManager } from '../../infrastructure/display';
import { applyFadeIn } from '../../core/utils/rendering/UIFadeAnimation';
import type { AmmoInventoryPayload, AmmoTier, MissileInventoryPayload, MissileTier } from '../../config/NetworkConfig';

interface SkillSlotConfig {
  index: number;
  title: string;
  iconPath?: string;
  actionLabel: string;
  enabled: boolean;
}

const AMMO_SLOT_BY_TIER: Record<AmmoTier, number> = {
  x1: 1,
  x2: 2,
  x3: 3
};

const AMMO_TIERS_BY_SLOT: Record<number, AmmoTier> = {
  1: 'x1',
  2: 'x2',
  3: 'x3'
};

const AMMO_ICON_BY_TIER: Record<AmmoTier, string> = {
  x1: 'assets/actionbar/x1.png',
  x2: 'assets/actionbar/x2.png',
  x3: 'assets/actionbar/x3.png'
};

const MISSILE_SLOT_BY_TIER: Record<MissileTier, number> = {
  m1: 4,
  m2: 5,
  m3: 6
};

const MISSILE_TIERS_BY_SLOT: Record<number, MissileTier> = {
  4: 'm1',
  5: 'm2',
  6: 'm3'
};

const MISSILE_ICON_BY_TIER: Record<MissileTier, string> = {
  m1: 'assets/actionbar/missile1.png',
  m2: 'assets/actionbar/missile2.png',
  m3: 'assets/actionbar/missile3.png'
};

/**
 * WeaponStatus - Bottom action area with:
 * - ammo slots 1..3 with cooldown overlay on the selected slot
 * - numeric skill slots 4..9 (manual abilities)
 */
export class WeaponStatus {
  private container: HTMLElement;
  private isVisible: boolean = false;
  private dprCompensation: number;
  private currentActiveSlot: number = 0;
  private currentActiveMissileSlot: number = 0;
  private readonly slotElements: Map<number, HTMLElement> = new Map();
  private readonly ammoCountElements: Map<string, HTMLElement> = new Map();
  private readonly cooldownFillElements: Map<number, HTMLElement> = new Map();
  private readonly cooldownTimerElements: Map<number, HTMLElement> = new Map();
  private skillbarSlotElements: HTMLElement[] = [];

  private readonly skillSlots: SkillSlotConfig[] = [
    { index: 1, title: 'Ammo x1', actionLabel: 'Ammo x1', enabled: false },
    { index: 2, title: 'Ammo x2', actionLabel: 'Ammo x2', enabled: false },
    { index: 3, title: 'Ammo x3', actionLabel: 'Ammo x3', enabled: false },
    { index: 4, title: 'Missile m1', actionLabel: 'Missile m1', enabled: false },
    { index: 5, title: 'Missile m2', actionLabel: 'Missile m2', enabled: false },
    { index: 6, title: 'Missile m3', actionLabel: 'Missile m3', enabled: false },
    { index: 7, title: 'Skill Slot 7', actionLabel: 'Skill Slot', enabled: false },
    { index: 8, title: 'Skill Slot 8', actionLabel: 'Skill Slot', enabled: false },
    { index: 9, title: 'Skill Slot 9', actionLabel: 'Skill Slot', enabled: false }
  ];

  constructor() {
    const dpr = DisplayManager.getInstance().getDevicePixelRatio();
    this.dprCompensation = 1 / dpr;
    this.container = this.createStatusContainer();
    this.setAmmoShortcutCount(0);
    this.setMissileShortcutCount(0);
    document.body.appendChild(this.container);
    this.setupInputBindings();
  }

  private createStatusContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'weapon-status';

    const c = this.dprCompensation;
    const margin = Math.round(14 * c);
    const edgeOverlap = Math.max(4, Math.round(8 * c));

    container.style.cssText = `
      position: fixed;
      bottom: -${edgeOverlap}px;
      left: 50%;
      transform: translateX(-50%);
      width: fit-content;
      max-width: calc(100vw - ${margin * 2}px);
      box-sizing: border-box;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: ${Math.round(6 * c)}px;
      pointer-events: none;
      z-index: 1000;
    `;

    const skillSlotsMarkup = this.skillSlots.map((slot) => {
      const ammoTier = AMMO_TIERS_BY_SLOT[slot.index];
      const missileTier = MISSILE_TIERS_BY_SLOT[slot.index];

      let iconMarkup = '';
      let cooldownMarkup = '';

      if (ammoTier) {
        cooldownMarkup = `
          <div class="skillbar-slot-cooldown" data-slot-cooldown="${slot.index}"></div>
          <div class="skillbar-slot-timer" data-slot-timer="${slot.index}"></div>
        `;
        iconMarkup = `
          <div class="skillbar-ammo-slot">
            <img src="${AMMO_ICON_BY_TIER[ammoTier]}" class="skillbar-ammo-icon" alt="Ammo ${ammoTier.toUpperCase()}">
            <div class="skillbar-ammo-count" data-ammo-shortcut-count="${ammoTier}">0</div>
          </div>
        `;
      } else if (missileTier) {
        cooldownMarkup = `
          <div class="skillbar-slot-cooldown" data-slot-cooldown="${slot.index}"></div>
          <div class="skillbar-slot-timer" data-slot-timer="${slot.index}"></div>
        `;
        iconMarkup = `
          <div class="skillbar-ammo-slot">
            <img src="${MISSILE_ICON_BY_TIER[missileTier]}" class="skillbar-ammo-icon" alt="Missile ${missileTier.toUpperCase()}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xMCAydjJNMCAxMGgyTTEwIDIydjJNMjIgMTBoMiIvPjwvc3ZnPg=='">
            <div class="skillbar-ammo-count" data-ammo-shortcut-count="${missileTier}">0</div>
          </div>
        `;
      } else {
        iconMarkup = slot.iconPath
          ? `<img src="${slot.iconPath}" class="skillbar-icon" alt="${slot.title}">`
          : '<div class="skillbar-empty-mark">+</div>';
      }

      const disabledClass = slot.enabled ? '' : ' skillbar-slot-disabled';
      return `
        <div class="skillbar-slot${disabledClass}" data-skill-slot="${slot.index}" title="${slot.title}">
          <div class="skillbar-slot-key">${slot.index}</div>
          <div class="skillbar-slot-body">
            ${iconMarkup}
            ${cooldownMarkup}
          </div>
          <div class="skillbar-slot-label">${slot.actionLabel}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="skillbar-shell">${skillSlotsMarkup}</div>
    `;

    this.cacheDomReferences(container);
    this.attachStyles();
    return container;
  }

  private cacheDomReferences(container: HTMLElement): void {
    this.slotElements.clear();
    this.ammoCountElements.clear();
    this.cooldownFillElements.clear();
    this.cooldownTimerElements.clear();

    this.skillbarSlotElements = Array.from(container.querySelectorAll<HTMLElement>('.skillbar-slot'));
    for (const element of this.skillbarSlotElements) {
      const slotIndex = Number(element.dataset.skillSlot || 0);
      if (slotIndex > 0) {
        this.slotElements.set(slotIndex, element);
      }
    }

    const ammoCounters = container.querySelectorAll<HTMLElement>('[data-ammo-shortcut-count]');
    for (const counter of Array.from(ammoCounters)) {
      const key = String(counter.dataset.ammoShortcutCount || '').trim().toLowerCase();
      if (key.length > 0) {
        this.ammoCountElements.set(key, counter);
      }
    }

    const cooldownFillNodes = container.querySelectorAll<HTMLElement>('[data-slot-cooldown]');
    for (const fillNode of Array.from(cooldownFillNodes)) {
      const slotIndex = Number(fillNode.dataset.slotCooldown || 0);
      if (slotIndex > 0) {
        this.cooldownFillElements.set(slotIndex, fillNode);
      }
    }

    const cooldownTimerNodes = container.querySelectorAll<HTMLElement>('[data-slot-timer]');
    for (const timerNode of Array.from(cooldownTimerNodes)) {
      const slotIndex = Number(timerNode.dataset.slotTimer || 0);
      if (slotIndex > 0) {
        this.cooldownTimerElements.set(slotIndex, timerNode);
      }
    }
  }

  private attachStyles(): void {
    const id = 'weapon-status-styles';
    const previousStyle = document.getElementById(id);
    if (previousStyle) {
      previousStyle.remove();
    }

    const c = this.dprCompensation;
    const shellTopCut = Math.max(14, Math.round(26 * c));
    const shellSideCut = Math.max(14, Math.round(26 * c));
    const shellBottomCut = Math.max(10, Math.round(16 * c));
    const shellNotchHalf = Math.max(22, Math.round(34 * c));
    const shellNotchDepth = Math.max(6, Math.round(11 * c));
    const shellPaddingTop = Math.max(9, Math.round(10 * c));
    const shellPaddingX = Math.max(16, Math.round(18 * c));
    const shellPaddingBottom = Math.max(12, Math.round(14 * c));

    const style = document.createElement('style');
    style.id = id;
    style.textContent = `

      .skillbar-shell {
        width: fit-content;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: flex-end;
        gap: ${Math.round(8 * c)}px;
        background:
          linear-gradient(180deg, rgba(241, 245, 249, 0.07) 0%, rgba(241, 245, 249, 0) 26%),
          linear-gradient(130deg, rgba(148, 163, 184, 0.13) 0%, rgba(255, 255, 255, 0.03) 44%, rgba(203, 213, 225, 0.08) 100%),
          rgba(0, 0, 0, 0.46);
        box-shadow:
          0 ${Math.round(10 * c)}px ${Math.round(28 * c)}px rgba(0, 0, 0, 0.44),
          inset 0 1px 0 rgba(255, 255, 255, 0.05),
          inset 0 0 0 1px rgba(0, 0, 0, 0.5);
        padding: ${shellPaddingTop}px ${shellPaddingX}px ${shellPaddingBottom}px;
        backdrop-filter: blur(14px) saturate(150%);
        -webkit-backdrop-filter: blur(14px) saturate(150%);
        clip-path: polygon(
          ${shellTopCut}px 0,
          calc(100% - ${shellTopCut}px) 0,
          100% ${shellTopCut}px,
          100% calc(100% - ${shellBottomCut}px),
          calc(100% - ${shellSideCut}px) 100%,
          calc(50% + ${shellNotchHalf}px) 100%,
          calc(50% + ${shellNotchHalf - shellNotchDepth}px) calc(100% - ${shellNotchDepth}px),
          50% calc(100% - ${shellNotchDepth}px),
          calc(50% - ${shellNotchHalf - shellNotchDepth}px) calc(100% - ${shellNotchDepth}px),
          calc(50% - ${shellNotchHalf}px) 100%,
          ${shellSideCut}px 100%,
          0 calc(100% - ${shellBottomCut}px),
          0 ${shellTopCut}px
        );
        pointer-events: none;
        overflow: hidden;
      }

      .skillbar-shell::before {
        content: '';
        position: absolute;
        inset: 0;
        clip-path: inherit;
        box-shadow:
          inset 0 0 0 1px rgba(148, 163, 184, 0.24),
          inset 0 1px 0 rgba(241, 245, 249, 0.12),
          inset 0 -1px 0 rgba(226, 232, 240, 0.14);
        pointer-events: none;
      }

      .skillbar-shell::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: ${Math.max(2, Math.round(3 * c))}px;
        width: ${Math.max(38, Math.round(72 * c))}px;
        height: ${Math.max(2, Math.round(4 * c))}px;
        transform: translateX(-50%);
        background: linear-gradient(90deg, rgba(148, 163, 184, 0), rgba(226, 232, 240, 0.62), rgba(148, 163, 184, 0));
        opacity: 0.68;
        clip-path: polygon(0 100%, 10% 0, 90% 0, 100% 100%);
      }

      .skillbar-slot {
        width: ${Math.round(60 * c)}px;
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: ${Math.round(5 * c)}px;
        pointer-events: auto;
        transition: transform 0.12s ease;
      }

      .skillbar-slot-active {
        transform: translateY(-${Math.max(2, Math.round(3 * c))}px);
      }

      .skillbar-slot-key {
        position: absolute;
        top: ${Math.round(-7 * c)}px;
        left: 50%;
        transform: translateX(-50%);
        min-width: ${Math.round(18 * c)}px;
        height: ${Math.round(15 * c)}px;
        padding: 0 ${Math.round(5 * c)}px;
        background: linear-gradient(180deg, rgba(17, 24, 39, 0.96) 0%, rgba(2, 6, 23, 0.95) 100%);
        border: 1px solid rgba(148, 163, 184, 0.24);
        color: rgba(241, 245, 249, 0.94);
        font-size: ${Math.round(9 * c)}px;
        font-weight: 700;
        letter-spacing: 0.35px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Consolas', 'Courier New', monospace;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
        box-shadow:
          0 ${Math.round(2 * c)}px ${Math.round(7 * c)}px rgba(0, 0, 0, 0.46),
          inset 0 1px 0 rgba(255, 255, 255, 0.08);
        clip-path: polygon(
          ${Math.round(4 * c)}px 0,
          calc(100% - ${Math.round(4 * c)}px) 0,
          100% ${Math.round(4 * c)}px,
          100% 100%,
          0 100%,
          0 ${Math.round(4 * c)}px
        );
        z-index: 3;
      }

      .skillbar-slot-active .skillbar-slot-key {
        border-color: rgba(248, 250, 252, 0.9);
        color: rgba(248, 250, 252, 0.98);
        box-shadow:
          0 ${Math.round(3 * c)}px ${Math.round(11 * c)}px rgba(241, 245, 249, 0.42),
          inset 0 1px 0 rgba(248, 250, 252, 0.14);
      }

      .skillbar-slot-disabled .skillbar-slot-key {
        opacity: 0.55;
      }

      .skillbar-slot-body {
        width: ${Math.round(54 * c)}px;
        height: ${Math.round(54 * c)}px;
        position: relative;
        background:
          linear-gradient(155deg, rgba(107, 114, 128, 0.14) 0%, rgba(255, 255, 255, 0.03) 42%, rgba(0, 0, 0, 0.62) 100%),
          rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        box-shadow:
          inset 0 0 0 1px rgba(148, 163, 184, 0.11),
          inset 0 1px 0 rgba(255, 255, 255, 0.05),
          0 ${Math.round(5 * c)}px ${Math.round(12 * c)}px rgba(0, 0, 0, 0.35);
        clip-path: polygon(
          ${Math.round(5 * c)}px 0,
          calc(100% - ${Math.round(5 * c)}px) 0,
          100% ${Math.round(5 * c)}px,
          100% calc(100% - ${Math.round(5 * c)}px),
          calc(100% - ${Math.round(5 * c)}px) 100%,
          ${Math.round(5 * c)}px 100%,
          0 calc(100% - ${Math.round(5 * c)}px),
          0 ${Math.round(5 * c)}px
        );
        transition: box-shadow 0.12s ease;
      }

      .skillbar-slot-active .skillbar-slot-body {
        box-shadow:
          inset 0 0 0 ${Math.max(2, Math.round(2 * c))}px rgba(248, 250, 252, 0.92),
          inset 0 1px 0 rgba(248, 250, 252, 0.2),
          0 0 ${Math.round(18 * c)}px rgba(241, 245, 249, 0.48),
          0 ${Math.round(6 * c)}px ${Math.round(14 * c)}px rgba(0, 0, 0, 0.45);
      }

      .skillbar-slot-disabled .skillbar-slot-body {
        box-shadow:
          inset 0 0 0 1px rgba(0, 0, 0, 0.62),
          inset 0 1px 0 rgba(255, 255, 255, 0.03);
        opacity: 0.55;
      }

      .skillbar-icon {
        position: relative;
        z-index: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        opacity: 0.9;
      }

      .skillbar-empty-mark {
        color: rgba(255, 255, 255, 0.22);
        font-size: ${Math.round(18 * c)}px;
        font-weight: 700;
        line-height: 1;
        z-index: 0;
      }

      .skillbar-ammo-slot {
        position: relative;
        z-index: 1;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .skillbar-ammo-icon {
        width: 100%;
        height: 100%;
        object-fit: contain;
        opacity: 0.95;
        filter: drop-shadow(0 0 ${Math.max(4, Math.round(6 * c))}px rgba(14, 165, 233, 0.25));
      }

      .skillbar-ammo-count {
        position: absolute;
        right: ${Math.max(2, Math.round(3 * c))}px;
        bottom: ${Math.max(2, Math.round(2 * c))}px;
        color: rgba(248, 250, 252, 0.95);
        font-size: ${Math.round(14 * c)}px;
        font-weight: 800;
        line-height: 1;
        font-family: 'Consolas', 'Courier New', monospace;
        text-shadow: 0 0 ${Math.max(4, Math.round(8 * c))}px rgba(14, 165, 233, 0.35);
      }

      .skillbar-slot-cooldown {
        position: absolute;
        inset: 0;
        --cooldown-remaining: 0deg;
        z-index: 2;
        opacity: 0;
        transition: opacity 0.08s linear;
        pointer-events: none;
      }

      .skillbar-slot-cooldown::before {
        content: '';
        position: absolute;
        inset: 0;
        background: conic-gradient(
          from -90deg,
          rgba(0, 0, 0, 0.52) 0deg var(--cooldown-remaining),
          rgba(0, 0, 0, 0.02) var(--cooldown-remaining) 360deg
        );
      }

      .skillbar-slot-timer {
        position: absolute;
        inset: 0;
        z-index: 3;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${Math.round(11 * c)}px;
        font-weight: 800;
        color: rgba(248, 250, 252, 0.95);
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.88);
        font-family: 'Consolas', 'Courier New', monospace;
        letter-spacing: 0.2px;
        pointer-events: none;
      }

      .skillbar-slot-label {
        width: ${Math.round(60 * c)}px;
        padding: ${Math.max(1, Math.round(1 * c))}px ${Math.round(3 * c)}px;
        color: rgba(241, 245, 249, 0.58);
        font-size: ${Math.round(7 * c)}px;
        font-weight: 700;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        white-space: nowrap;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        background: rgba(0, 0, 0, 0.24);
        clip-path: polygon(
          ${Math.round(3 * c)}px 0,
          calc(100% - ${Math.round(3 * c)}px) 0,
          100% 100%,
          0 100%
        );
      }

      .skillbar-slot-active .skillbar-slot-label {
        color: rgba(248, 250, 252, 0.98);
        background: rgba(15, 23, 42, 0.72);
      }

      .skillbar-slot-disabled .skillbar-slot-label {
        color: rgba(241, 245, 249, 0.3);
      }
    `;

    document.head.appendChild(style);
  }

  private setupInputBindings(): void {
    document.addEventListener('skillbar:activate', this.onSkillbarActivate as EventListener);
  }

  private onSkillbarActivate = (event: CustomEvent<{ slot: number }>): void => {
    const slot = Number(event?.detail?.slot || 0);
    if (slot < 1 || slot > 9) {
      return;
    }
    const shouldForceActivation = (slot >= 1 && slot <= 3) || (slot >= 4 && slot <= 6);
    this.setActiveSlot(slot, shouldForceActivation);
  };

  public show(): void {
    this.container.style.display = 'flex';
    if (!this.isVisible) {
      applyFadeIn(this.container, 'translateX(-50%)');
      this.isVisible = true;
    }
    const shouldForceActivation = (this.currentActiveSlot >= 1 && this.currentActiveSlot <= 3) || (this.currentActiveSlot >= 4 && this.currentActiveSlot <= 6);
    this.setActiveSlot(this.currentActiveSlot, shouldForceActivation);
  }

  public hide(): void {
    this.container.style.display = 'none';
    this.isVisible = false;
  }

  /**
   * Updates the cooldown overlay on the currently active ammo slot.
   * @param cooldownProgress 0.0 (just fired) to 1.0 (ready)
   * @param cooldownRemaining milliseconds remaining
   */
  public update(cooldownProgress: number, cooldownRemaining: number = 0): void {
    this.updateActiveSlotCooldown(cooldownProgress, cooldownRemaining);
  }

  public updateMissileCooldown(cooldownProgress: number, cooldownRemaining: number = 0): void {
    this.updateActiveMissileSlotCooldown(cooldownProgress, cooldownRemaining);
  }

  public setAmmoShortcutCount(ammoCountRaw: number | null | undefined): void {
    const ammoCount = Number.isFinite(Number(ammoCountRaw))
      ? Math.max(0, Math.floor(Number(ammoCountRaw)))
      : 0;
    this.setAmmoShortcutCounts({
      selectedTier: 'x1',
      tiers: {
        x1: ammoCount,
        x2: 0,
        x3: 0
      }
    });
  }

  public setMissileShortcutCount(missileCountRaw: number | null | undefined): void {
    const missileCount = Number.isFinite(Number(missileCountRaw))
      ? Math.max(0, Math.floor(Number(missileCountRaw)))
      : 0;
    this.setMissileShortcutCounts({
      selectedTier: 'm1',
      tiers: {
        m1: missileCount,
        m2: 0,
        m3: 0
      }
    });
  }

  public setAmmoShortcutCounts(ammoInventoryRaw: AmmoInventoryPayload | null | undefined): void {
    const normalizedAmmoInventory = this.normalizeAmmoInventory(ammoInventoryRaw);

    for (const ammoTier of Object.keys(AMMO_SLOT_BY_TIER) as AmmoTier[]) {
      const slotIndex = AMMO_SLOT_BY_TIER[ammoTier];
      const ammoCount = this.normalizeAmmoCount(normalizedAmmoInventory.tiers[ammoTier]);
      const isEnabled = ammoCount > 0;

      const slotConfig = this.skillSlots.find((slot) => slot.index === slotIndex);
      if (slotConfig) {
        slotConfig.enabled = isEnabled;
      }

      const ammoSlot = this.slotElements.get(slotIndex);
      const ammoCountElement = this.ammoCountElements.get(ammoTier);
      if (ammoCountElement) {
        ammoCountElement.textContent = `${ammoCount}`;
      }

      if (ammoSlot) {
        ammoSlot.classList.toggle('skillbar-slot-disabled', !isEnabled);
        ammoSlot.title = isEnabled
          ? `Ammo ${ammoTier} (${ammoCount})`
          : `Ammo ${ammoTier} (empty)`;
      }
    }

    const selectedSlot = AMMO_SLOT_BY_TIER[normalizedAmmoInventory.selectedTier] || 1;
    this.setActiveSlot(selectedSlot, true);
  }

  public setMissileShortcutCounts(missileInventoryRaw: MissileInventoryPayload | null | undefined): void {
    const normalizedMissileInventory = this.normalizeMissileInventory(missileInventoryRaw);

    for (const missileTier of Object.keys(MISSILE_SLOT_BY_TIER) as MissileTier[]) {
      const slotIndex = MISSILE_SLOT_BY_TIER[missileTier];
      const missileCount = this.normalizeAmmoCount(normalizedMissileInventory.tiers[missileTier]);
      const isEnabled = missileCount > 0;

      const slotConfig = this.skillSlots.find((slot) => slot.index === slotIndex);
      if (slotConfig) {
        slotConfig.enabled = isEnabled;
      }

      const ammoSlot = this.slotElements.get(slotIndex);
      const ammoCountElement = this.ammoCountElements.get(missileTier);
      if (ammoCountElement) {
        ammoCountElement.textContent = `${missileCount}`;
      }

      if (ammoSlot) {
        ammoSlot.classList.toggle('skillbar-slot-disabled', !isEnabled);
        ammoSlot.title = isEnabled
          ? `Missile ${missileTier} (${missileCount})`
          : `Missile ${missileTier} (empty)`;
      }
    }

    const selectedSlot = MISSILE_SLOT_BY_TIER[normalizedMissileInventory.selectedTier] || 4;
    this.setActiveSlot(selectedSlot, true);
  }

  private normalizeAmmoInventory(ammoInventoryRaw: AmmoInventoryPayload | null | undefined): AmmoInventoryPayload {
    const sourceInventory = ammoInventoryRaw && typeof ammoInventoryRaw === 'object'
      ? ammoInventoryRaw
      : null;
    const fallbackTier: AmmoTier = 'x1';
    const selectedTier = sourceInventory && (sourceInventory.selectedTier === 'x1' || sourceInventory.selectedTier === 'x2' || sourceInventory.selectedTier === 'x3')
      ? sourceInventory.selectedTier
      : fallbackTier;

    return {
      selectedTier,
      tiers: {
        x1: this.normalizeAmmoCount(sourceInventory?.tiers?.x1),
        x2: this.normalizeAmmoCount(sourceInventory?.tiers?.x2),
        x3: this.normalizeAmmoCount(sourceInventory?.tiers?.x3)
      }
    };
  }

  private normalizeMissileInventory(missileInventoryRaw: MissileInventoryPayload | null | undefined): MissileInventoryPayload {
    const sourceInventory = missileInventoryRaw && typeof missileInventoryRaw === 'object'
      ? missileInventoryRaw
      : null;
    const fallbackTier: MissileTier = 'm1';
    const selectedTier = sourceInventory && (sourceInventory.selectedTier === 'm1' || sourceInventory.selectedTier === 'm2' || sourceInventory.selectedTier === 'm3')
      ? sourceInventory.selectedTier
      : fallbackTier;

    return {
      selectedTier,
      tiers: {
        m1: this.normalizeAmmoCount(sourceInventory?.tiers?.m1),
        m2: this.normalizeAmmoCount(sourceInventory?.tiers?.m2),
        m3: this.normalizeAmmoCount(sourceInventory?.tiers?.m3)
      }
    };
  }

  private normalizeAmmoCount(rawValue: unknown): number {
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) return 0;
    return Math.max(0, Math.floor(parsedValue));
  }

  private applyCooldownDom(
    fillElement: HTMLElement,
    timerElement: HTMLElement,
    remainingDegrees: number,
    isVisible: boolean,
    timerText: string
  ): void {
    const degreesValue = `${remainingDegrees}deg`;
    if (fillElement.style.getPropertyValue('--cooldown-remaining') !== degreesValue) {
      fillElement.style.setProperty('--cooldown-remaining', degreesValue);
    }

    const opacityValue = isVisible ? '1' : '0';
    if (fillElement.style.opacity !== opacityValue) {
      fillElement.style.opacity = opacityValue;
    }

    if (timerElement.textContent !== timerText) {
      timerElement.textContent = timerText;
    }
  }

  private updateActiveSlotCooldown(progress: number, remainingMs: number): void {
    const normalizedProgress = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
    const remainingRatio = 1 - normalizedProgress;
    const remainingDegrees = Math.round(remainingRatio * 360);
    const activeVisible = remainingRatio > 0.005;
    const activeTimerText = remainingMs > 100 ? (remainingMs / 1000).toFixed(1) : '';

    // Update all ammo slots (1-3): show cooldown only on active, clear others
    for (let slot = 1; slot <= 3; slot++) {
      const fillElement = this.cooldownFillElements.get(slot);
      const timerElement = this.cooldownTimerElements.get(slot);
      if (!fillElement || !timerElement) continue;

      if (slot === this.currentActiveSlot) {
        this.applyCooldownDom(fillElement, timerElement, remainingDegrees, activeVisible, activeTimerText);
      } else {
        this.applyCooldownDom(fillElement, timerElement, 0, false, '');
      }
    }
  }

  private updateActiveMissileSlotCooldown(progress: number, remainingMs: number): void {
    const normalizedProgress = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
    const remainingRatio = 1 - normalizedProgress;
    const remainingDegrees = Math.round(remainingRatio * 360);
    const activeVisible = remainingRatio > 0.005;
    const activeTimerText = remainingMs > 100 ? (remainingMs / 1000).toFixed(1) : '';

    // Update all missile slots (4-6): show cooldown only on active, clear others
    for (let slot = 4; slot <= 6; slot++) {
      const fillElement = this.cooldownFillElements.get(slot);
      const timerElement = this.cooldownTimerElements.get(slot);
      if (!fillElement || !timerElement) continue;

      if (slot === this.currentActiveMissileSlot) {
        this.applyCooldownDom(fillElement, timerElement, remainingDegrees, activeVisible, activeTimerText);
      } else {
        this.applyCooldownDom(fillElement, timerElement, 0, false, '');
      }
    }
  }

  private setActiveSlot(slot: number, forceActivation: boolean = false): void {
    const hasSlot = this.skillSlots.some((slotConfig) => slotConfig.index === slot);
    const hasEnabledSlot = this.skillSlots.some((slotConfig) => slotConfig.index === slot && slotConfig.enabled);
    const shouldActivate = forceActivation ? hasSlot : hasEnabledSlot;

    if (shouldActivate) {
      if (slot >= 1 && slot <= 3) {
        this.currentActiveSlot = slot;
      } else if (slot >= 4 && slot <= 6) {
        this.currentActiveMissileSlot = slot;
      } else {
        // Generic slots don't track active state in this property for now
      }
    }

    this.skillbarSlotElements.forEach((element) => {
      const currentSlot = Number(element.dataset.skillSlot || 0);
      const isActive = (currentSlot === this.currentActiveSlot) || (currentSlot === this.currentActiveMissileSlot);
      element.classList.toggle('skillbar-slot-active', isActive);
    });
  }

  public destroy(): void {
    document.removeEventListener('skillbar:activate', this.onSkillbarActivate as EventListener);

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.slotElements.clear();
    this.ammoCountElements.clear();
    this.cooldownFillElements.clear();
    this.cooldownTimerElements.clear();
    this.skillbarSlotElements = [];

    const style = document.getElementById('weapon-status-styles');
    if (style) {
      style.remove();
    }
  }
}
