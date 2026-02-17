import { DisplayManager } from '../../infrastructure/display';
import { applyFadeIn } from '../../core/utils/rendering/UIFadeAnimation';

type WeaponCooldownId = 'laser' | 'missile';

interface SkillSlotConfig {
  index: number;
  title: string;
  iconPath?: string;
  actionLabel: string;
  enabled: boolean;
}

interface WeaponWidgetConfig {
  id: WeaponCooldownId;
  title: string;
  iconPath: string;
  modeLabel: string;
}

/**
 * WeaponStatus - Bottom action area with:
 * - automatic ship weapon cooldown telemetry (separate, non-numeric)
 * - numeric skill slots 1..9 (manual abilities)
 */
export class WeaponStatus {
  private container: HTMLElement;
  private isVisible: boolean = false;
  private dprCompensation: number;
  private currentActiveSlot: number = 0;

  private readonly skillSlots: SkillSlotConfig[] = [
    { index: 1, title: 'Skill Slot 1', actionLabel: 'Skill Slot', enabled: false },
    { index: 2, title: 'Skill Slot 2', actionLabel: 'Skill Slot', enabled: false },
    { index: 3, title: 'Skill Slot 3', actionLabel: 'Skill Slot', enabled: false },
    { index: 4, title: 'Skill Slot 4', actionLabel: 'Skill Slot', enabled: false },
    { index: 5, title: 'Skill Slot 5', actionLabel: 'Skill Slot', enabled: false },
    { index: 6, title: 'Skill Slot 6', actionLabel: 'Skill Slot', enabled: false },
    { index: 7, title: 'Skill Slot 7', actionLabel: 'Skill Slot', enabled: false },
    { index: 8, title: 'Skill Slot 8', actionLabel: 'Skill Slot', enabled: false },
    { index: 9, title: 'Skill Slot 9', actionLabel: 'Skill Slot', enabled: false }
  ];

  private readonly weaponWidgets: WeaponWidgetConfig[] = [
    { id: 'laser', title: 'Laser Cannon', iconPath: 'assets/weapon_status/laser_icon.png', modeLabel: 'AUTO' },
    { id: 'missile', title: 'Missile Launcher', iconPath: 'assets/weapon_status/missile_icon.png', modeLabel: 'AUTO' }
  ];

  constructor() {
    const dpr = DisplayManager.getInstance().getDevicePixelRatio();
    this.dprCompensation = 1 / dpr;
    this.container = this.createStatusContainer();
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
      const iconMarkup = slot.iconPath
        ? `<img src="${slot.iconPath}" class="skillbar-icon" alt="${slot.title}">`
        : '<div class="skillbar-empty-mark">+</div>';

      const disabledClass = slot.enabled ? '' : ' skillbar-slot-disabled';
      return `
        <div class="skillbar-slot${disabledClass}" data-skill-slot="${slot.index}" title="${slot.title}">
          <div class="skillbar-slot-key">${slot.index}</div>
          <div class="skillbar-slot-body">
            ${iconMarkup}
          </div>
          <div class="skillbar-slot-label">${slot.actionLabel}</div>
        </div>
      `;
    }).join('');

    const weaponWidgetsMarkup = this.weaponWidgets.map((widget) => `
      <div class="weapon-widget" data-weapon-widget="${widget.id}" title="${widget.title} (${widget.modeLabel})">
        <div class="weapon-widget-core">
          <img src="${widget.iconPath}" class="weapon-widget-icon" alt="${widget.title}">
          <div class="weapon-widget-cooldown" data-cooldown-fill="${widget.id}"></div>
          <div class="weapon-widget-timer" data-cooldown-timer="${widget.id}"></div>
        </div>
        <div class="weapon-widget-text">
          <div class="weapon-widget-name">${widget.title}</div>
          <div class="weapon-widget-mode">${widget.modeLabel}</div>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="weapon-telemetry-shell">${weaponWidgetsMarkup}</div>
      <div class="skillbar-shell">${skillSlotsMarkup}</div>
    `;

    this.attachStyles();
    return container;
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
      .weapon-telemetry-shell {
        width: fit-content;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: ${Math.round(12 * c)}px;
        pointer-events: none;
      }

      .weapon-widget {
        display: flex;
        align-items: center;
        gap: ${Math.round(6 * c)}px;
        min-width: ${Math.round(130 * c)}px;
        pointer-events: none;
      }

      .weapon-widget-core {
        width: ${Math.round(42 * c)}px;
        height: ${Math.round(42 * c)}px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        background:
          linear-gradient(155deg, rgba(107, 114, 128, 0.14) 0%, rgba(255, 255, 255, 0.03) 42%, rgba(0, 0, 0, 0.62) 100%),
          rgba(0, 0, 0, 0.5);
        box-shadow:
          inset 0 0 0 1px rgba(148, 163, 184, 0.16),
          inset 0 1px 0 rgba(255, 255, 255, 0.05),
          0 ${Math.round(4 * c)}px ${Math.round(10 * c)}px rgba(0, 0, 0, 0.35);
        clip-path: polygon(
          ${Math.round(4 * c)}px 0,
          calc(100% - ${Math.round(4 * c)}px) 0,
          100% ${Math.round(4 * c)}px,
          100% calc(100% - ${Math.round(4 * c)}px),
          calc(100% - ${Math.round(4 * c)}px) 100%,
          ${Math.round(4 * c)}px 100%,
          0 calc(100% - ${Math.round(4 * c)}px),
          0 ${Math.round(4 * c)}px
        );
        overflow: hidden;
      }

      .weapon-widget-icon {
        width: 100%;
        height: 100%;
        object-fit: contain;
        opacity: 0.9;
        z-index: 0;
      }

      .weapon-widget-cooldown {
        position: absolute;
        inset: 0;
        --cooldown-remaining: 0deg;
        z-index: 1;
        opacity: 0;
        transition: opacity 0.08s linear;
        pointer-events: none;
      }

      .weapon-widget-cooldown::before {
        content: '';
        position: absolute;
        inset: 0;
        background: conic-gradient(
          from -90deg,
          rgba(0, 0, 0, 0.48) 0deg var(--cooldown-remaining),
          rgba(0, 0, 0, 0.02) var(--cooldown-remaining) 360deg
        );
      }

      .weapon-widget-timer {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${Math.round(10 * c)}px;
        font-weight: 800;
        color: rgba(248, 250, 252, 0.95);
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.88);
        font-family: 'Consolas', 'Courier New', monospace;
        letter-spacing: 0.2px;
        pointer-events: none;
      }

      .weapon-widget-text {
        display: flex;
        flex-direction: column;
        gap: ${Math.max(1, Math.round(1 * c))}px;
        min-width: ${Math.round(76 * c)}px;
      }

      .weapon-widget-name {
        color: rgba(241, 245, 249, 0.82);
        font-size: ${Math.round(8 * c)}px;
        font-weight: 700;
        letter-spacing: 0.75px;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .weapon-widget-mode {
        color: rgba(248, 113, 113, 0.88);
        font-size: ${Math.round(7 * c)}px;
        font-weight: 800;
        letter-spacing: 0.7px;
        text-transform: uppercase;
        white-space: nowrap;
      }

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
        border-color: rgba(203, 213, 225, 0.42);
        color: rgba(248, 250, 252, 0.98);
        box-shadow:
          0 ${Math.round(3 * c)}px ${Math.round(9 * c)}px rgba(148, 163, 184, 0.2),
          inset 0 1px 0 rgba(248, 250, 252, 0.12);
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
      }

      .skillbar-slot-active .skillbar-slot-body {
        box-shadow:
          inset 0 0 0 1px rgba(203, 213, 225, 0.34),
          inset 0 1px 0 rgba(248, 250, 252, 0.12),
          0 0 ${Math.round(16 * c)}px rgba(148, 163, 184, 0.28),
          0 ${Math.round(6 * c)}px ${Math.round(14 * c)}px rgba(0, 0, 0, 0.38);
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
    this.setActiveSlot(slot);
  };

  public show(): void {
    this.container.style.display = 'flex';
    if (!this.isVisible) {
      applyFadeIn(this.container, 'translateX(-50%)');
      this.isVisible = true;
    }
    this.setActiveSlot(this.currentActiveSlot);
  }

  public hide(): void {
    this.container.style.display = 'none';
    this.isVisible = false;
  }

  public update(laserProgress: number, missileProgress: number, laserRemaining: number = 0, missileRemaining: number = 0): void {
    this.updateWeaponCooldown('laser', laserProgress, laserRemaining);
    this.updateWeaponCooldown('missile', missileProgress, missileRemaining);
  }

  private updateWeaponCooldown(weaponId: WeaponCooldownId, progress: number, remainingMs: number): void {
    const fillElement = this.container.querySelector<HTMLElement>(`[data-cooldown-fill="${weaponId}"]`);
    const timerElement = this.container.querySelector<HTMLElement>(`[data-cooldown-timer="${weaponId}"]`);
    if (!fillElement || !timerElement) {
      return;
    }

    const normalizedProgress = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
    const remainingRatio = 1 - normalizedProgress;
    const remainingDegrees = Math.round(remainingRatio * 360);

    fillElement.style.setProperty('--cooldown-remaining', `${remainingDegrees}deg`);
    fillElement.style.opacity = remainingRatio > 0.005 ? '1' : '0';
    timerElement.textContent = remainingMs > 100 ? (remainingMs / 1000).toFixed(1) : '';
  }

  private setActiveSlot(slot: number): void {
    const hasEnabledSlot = this.skillSlots.some((slotConfig) => slotConfig.index === slot && slotConfig.enabled);
    this.currentActiveSlot = hasEnabledSlot ? slot : 0;

    this.container.querySelectorAll<HTMLElement>('.skillbar-slot').forEach((element) => {
      const currentSlot = Number(element.dataset.skillSlot || 0);
      element.classList.toggle('skillbar-slot-active', hasEnabledSlot && currentSlot === slot);
    });
  }

  public destroy(): void {
    document.removeEventListener('skillbar:activate', this.onSkillbarActivate as EventListener);

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    const style = document.getElementById('weapon-status-styles');
    if (style) {
      style.remove();
    }
  }
}
