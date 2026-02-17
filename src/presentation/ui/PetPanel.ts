import { BasePanel } from './FloatingIcon';
import type { PanelConfig } from './PanelConfig';
import type { PetStatePayload } from '../../config/NetworkConfig';
import { AtlasParser } from '../../core/utils/AtlasParser';

interface NormalizedPetState extends PetStatePayload {
  petNickname: string;
  experienceForNextLevel: number;
  experienceAtCurrentLevel: number;
  experienceProgressInLevel: number;
  moduleSlot: NormalizedPetModuleSlot;
  inventory: NormalizedPetInventoryItem[];
  inventoryCapacity: number;
}

interface NormalizedPetModuleSlot {
  itemId: string;
  itemName: string;
  rarity: string;
  level: number;
  isEmpty: boolean;
}

interface NormalizedPetInventoryItem {
  itemId: string;
  itemName: string;
  quantity: number;
  rarity: string;
}

interface PetPreviewFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PetPreviewAnimationData {
  frames: PetPreviewFrame[];
  frameWidth: number;
  frameHeight: number;
}

export class PetPanel extends BasePanel {
  private static readonly COMPANION_PREVIEW_SCALE = 1.12;
  private static readonly COMPANION_PREVIEW_TICK_MS = 80;
  private readonly petStateProvider: (() => PetStatePayload | null) | null;
  private readonly petNicknameSubmitter: ((petNickname: string) => boolean) | null;
  private readonly petActiveSubmitter: ((isActive: boolean) => boolean) | null;
  private nicknameModalElement: HTMLElement | null = null;
  private nicknameNoticeElement: HTMLElement | null = null;
  private nicknameNoticeTimeoutId: number | null = null;
  private nicknameInputElement: HTMLInputElement | null = null;
  private nicknameFeedbackElement: HTMLElement | null = null;
  private companionSpriteElement: HTMLElement | null = null;
  private moduleSlotNameElement: HTMLElement | null = null;
  private moduleSlotMetaElement: HTMLElement | null = null;
  private moduleSlotRarityElement: HTMLElement | null = null;
  private activeToggleButtonElement: HTMLButtonElement | null = null;
  private petInventoryGridElement: HTMLElement | null = null;
  private petInventoryCountElement: HTMLElement | null = null;
  private currentPreviewPetId: string = '';
  private previewRequestToken = 0;
  private readonly petPreviewFrameCache = new Map<string, PetPreviewAnimationData | null>();
  private currentPreviewAnimation: PetPreviewAnimationData | null = null;
  private previewAnimationFrameIndex = 0;
  private previewAnimationIntervalId: number | null = null;
  private lastPetNickname: string = '';
  private lastPetIsActive: boolean = true;

  constructor(
    config: PanelConfig,
    petStateProvider?: (() => PetStatePayload | null),
    petNicknameSubmitter?: ((petNickname: string) => boolean),
    petActiveSubmitter?: ((isActive: boolean) => boolean)
  ) {
    super(config);
    this.petStateProvider = typeof petStateProvider === 'function' ? petStateProvider : null;
    this.petNicknameSubmitter = typeof petNicknameSubmitter === 'function' ? petNicknameSubmitter : null;
    this.petActiveSubmitter = typeof petActiveSubmitter === 'function' ? petActiveSubmitter : null;
    this.nicknameModalElement = this.content.querySelector<HTMLElement>('[data-pet-nickname-modal]');
    this.nicknameNoticeElement = this.content.querySelector<HTMLElement>('[data-pet-nickname-notice]');
    this.nicknameInputElement = this.content.querySelector<HTMLInputElement>('[data-pet-nickname-input]');
    this.nicknameFeedbackElement = this.content.querySelector<HTMLElement>('[data-pet-nickname-feedback]');
    this.companionSpriteElement = this.content.querySelector<HTMLElement>('[data-pet-companion-sprite]');
    this.moduleSlotNameElement = this.content.querySelector<HTMLElement>('[data-pet-module-name]');
    this.moduleSlotMetaElement = this.content.querySelector<HTMLElement>('[data-pet-module-meta]');
    this.moduleSlotRarityElement = this.content.querySelector<HTMLElement>('[data-pet-module-rarity]');
    this.activeToggleButtonElement = this.content.querySelector<HTMLButtonElement>('[data-pet-active-toggle]');
    this.petInventoryGridElement = this.content.querySelector<HTMLElement>('[data-pet-inventory-grid]');
    this.petInventoryCountElement = this.content.querySelector<HTMLElement>('[data-pet-inventory-count]');
  }

  protected createPanelContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'pet-panel-content';
    content.style.cssText = `
      padding: 28px;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 18px;
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
      background:
        radial-gradient(circle at 30% 35%, rgba(255, 255, 255, 0.08), transparent 42%),
        rgba(0, 0, 0, 0.36);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: rgba(255, 255, 255, 0.92);
    `;

    const header = this.createHeader();
    const summaryCard = this.createSummaryCard();
    const statsBlock = this.createStatsBlock();
    const moduleInventoryBlock = this.createModuleInventoryBlock();
    const nicknameModal = this.createNicknameModal();
    const nicknameNotice = this.createNicknameNotice();
    const mainLayout = document.createElement('div');
    mainLayout.style.cssText = `
      display: grid;
      grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
      gap: 16px;
      flex: 1;
      min-height: 0;
    `;
    const leftColumn = document.createElement('div');
    leftColumn.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 0;
      height: 100%;
    `;
    leftColumn.appendChild(summaryCard);
    leftColumn.appendChild(statsBlock);

    const rightColumn = document.createElement('div');
    rightColumn.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 0;
      height: 100%;
    `;
    rightColumn.appendChild(moduleInventoryBlock);

    mainLayout.appendChild(leftColumn);
    mainLayout.appendChild(rightColumn);

    content.appendChild(header);
    content.appendChild(mainLayout);
    content.appendChild(nicknameNotice);
    content.appendChild(nicknameModal);

    return content;
  }

  private createNicknameNotice(): HTMLElement {
    const notice = document.createElement('div');
    notice.dataset.petNicknameNotice = 'true';
    notice.style.cssText = `
      position: absolute;
      left: 50%;
      top: 28px;
      transform: translate(-50%, -6px);
      border: 1px solid rgba(109, 255, 138, 0.55);
      background: rgba(6, 20, 12, 0.92);
      color: rgba(109, 255, 138, 0.98);
      border-radius: 2px;
      padding: 8px 11px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      z-index: 35;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.18s ease, transform 0.18s ease;
    `;
    return notice;
  }

  private createNicknameModal(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.dataset.petNicknameModal = 'true';
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(2, 6, 14, 0.72);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 30;
      padding: 16px;
      box-sizing: border-box;
    `;
    overlay.addEventListener('click', (event) => {
      if (event.target !== overlay) return;
      this.closeNicknameModal();
    });

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      width: min(420px, 100%);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 2px;
      background: rgba(7, 12, 22, 0.96);
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    const title = document.createElement('div');
    title.textContent = 'Change Pet Nickname';
    title.style.cssText = `
      color: rgba(255, 255, 255, 0.94);
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
    `;

    const input = document.createElement('input');
    input.dataset.petNicknameInput = 'true';
    input.type = 'text';
    input.placeholder = 'Insert pet nickname';
    input.maxLength = 24;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.cssText = `
      width: 100%;
      height: 38px;
      border-radius: 2px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(3, 6, 12, 0.82);
      color: rgba(255, 255, 255, 0.96);
      padding: 0 11px;
      font-size: 14px;
      font-weight: 600;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    `;
    input.addEventListener('focus', () => {
      input.style.borderColor = 'rgba(56, 189, 248, 0.62)';
      input.style.boxShadow = '0 0 0 2px rgba(56, 189, 248, 0.18)';
    });
    input.addEventListener('blur', () => {
      input.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      input.style.boxShadow = 'none';
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeNicknameModal();
        return;
      }
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.submitNickname();
    });

    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
    `;

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
      height: 34px;
      border-radius: 2px;
      border: 1px solid rgba(148, 163, 184, 0.42);
      background: rgba(15, 23, 42, 0.6);
      color: rgba(226, 232, 240, 0.95);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.8px;
      padding: 0 14px;
      cursor: pointer;
      text-transform: uppercase;
    `;
    cancelButton.addEventListener('click', () => this.closeNicknameModal());

    const submitButton = document.createElement('button');
    submitButton.dataset.petNicknameSave = 'true';
    submitButton.type = 'button';
    submitButton.textContent = 'Save';
    submitButton.style.cssText = `
      height: 34px;
      border-radius: 2px;
      border: 1px solid rgba(56, 189, 248, 0.62);
      background: linear-gradient(135deg, rgba(14, 116, 144, 0.42), rgba(2, 132, 199, 0.18));
      color: #e0f2fe;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.9px;
      padding: 0 15px;
      cursor: pointer;
      text-transform: uppercase;
      white-space: nowrap;
    `;
    submitButton.addEventListener('click', () => this.submitNickname());

    const feedback = document.createElement('div');
    feedback.dataset.petNicknameFeedback = 'true';
    feedback.style.cssText = `
      min-height: 15px;
      color: rgba(186, 230, 253, 0.9);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    `;

    actions.appendChild(cancelButton);
    actions.appendChild(submitButton);
    dialog.appendChild(title);
    dialog.appendChild(input);
    dialog.appendChild(actions);
    dialog.appendChild(feedback);
    overlay.appendChild(dialog);

    this.nicknameModalElement = overlay;
    this.nicknameInputElement = input;
    this.nicknameFeedbackElement = feedback;

    return overlay;
  }

  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    `;

    const titleGroup = document.createElement('div');

    const title = document.createElement('h2');
    title.textContent = 'PET';
    title.style.cssText = `
      margin: 0;
      color: #ffffff;
      font-size: 30px;
      font-weight: 900;
      letter-spacing: 5px;
      text-shadow: 0 0 24px rgba(255, 255, 255, 0.24);
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'COMPANION STATUS';
    subtitle.style.cssText = `
      margin: 4px 0 0 0;
      color: rgba(255, 255, 255, 0.72);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
    `;

    titleGroup.appendChild(title);
    titleGroup.appendChild(subtitle);

    const closeButton = document.createElement('button');
    closeButton.textContent = 'x';
    closeButton.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.6);
      font-size: 24px;
      line-height: 1;
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

    header.appendChild(titleGroup);
    header.appendChild(closeButton);
    return header;
  }

  private createSummaryCard(): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(11, 14, 22, 0.58);
      border-radius: 2px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-height: 0;
    `;

    const visual = document.createElement('div');
    visual.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 2px;
      height: 148px;
      background:
        radial-gradient(circle at 35% 25%, rgba(56, 189, 248, 0.28), transparent 52%),
        linear-gradient(145deg, rgba(15, 23, 42, 0.86), rgba(2, 6, 23, 0.94));
      position: relative;
      overflow: hidden;
    `;
    const companionSprite = document.createElement('div');
    companionSprite.dataset.petCompanionSprite = 'true';
    companionSprite.style.cssText = `
      position: absolute;
      left: 50%;
      top: 56%;
      width: 180px;
      height: 160px;
      transform: translate(-50%, -50%);
      transform-origin: center center;
      background-repeat: no-repeat;
      background-size: auto;
      background-position: center;
      image-rendering: auto;
      filter: drop-shadow(0 0 14px rgba(56, 189, 248, 0.38));
      opacity: 0.98;
      pointer-events: none;
    `;
    visual.appendChild(companionSprite);
    this.companionSpriteElement = companionSprite;

    const infoRow = document.createElement('div');
    infoRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    `;

    const left = document.createElement('div');
    left.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    `;

    const nicknameRow = document.createElement('div');
    nicknameRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    `;

    const nicknameLabel = document.createElement('div');
    nicknameLabel.style.cssText = `
      font-size: 20px;
      font-weight: 900;
      color: rgba(255, 255, 255, 0.98);
      letter-spacing: 0.5px;
      text-transform: none;
      text-shadow: 0 0 16px rgba(255, 255, 255, 0.2);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    nicknameLabel.dataset.petField = 'petNickname';
    nicknameLabel.textContent = 'Sentinel';

    const nicknameEditButton = document.createElement('button');
    nicknameEditButton.type = 'button';
    nicknameEditButton.dataset.petNicknameOpen = 'true';
    nicknameEditButton.setAttribute('aria-label', 'Change pet nickname');
    nicknameEditButton.style.cssText = `
      width: 26px;
      height: 26px;
      border-radius: 2px;
      border: 1px solid rgba(56, 189, 248, 0.45);
      background: rgba(14, 116, 144, 0.18);
      color: rgba(186, 230, 253, 0.96);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
      transition: border-color 0.18s ease, background 0.18s ease;
    `;
    nicknameEditButton.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
        <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm14.71-9.04a1 1 0 0 0 0-1.41l-2.5-2.5a1 1 0 0 0-1.41 0l-1.8 1.8 3.75 3.75 1.96-1.64z" fill="currentColor"/>
      </svg>
    `;
    nicknameEditButton.addEventListener('mouseenter', () => {
      nicknameEditButton.style.borderColor = 'rgba(125, 211, 252, 0.82)';
      nicknameEditButton.style.background = 'rgba(14, 116, 144, 0.34)';
    });
    nicknameEditButton.addEventListener('mouseleave', () => {
      nicknameEditButton.style.borderColor = 'rgba(56, 189, 248, 0.45)';
      nicknameEditButton.style.background = 'rgba(14, 116, 144, 0.18)';
    });
    nicknameEditButton.addEventListener('click', () => this.openNicknameModal());

    const statusLabel = document.createElement('div');
    statusLabel.style.cssText = `
      font-size: 11px;
      color: rgba(109, 255, 138, 0.95);
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 800;
    `;
    statusLabel.dataset.petField = 'activeStatus';
    statusLabel.textContent = 'active';

    const controls = document.createElement('div');
    controls.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      gap: 8px;
      flex-shrink: 0;
    `;

    const activeToggleButton = document.createElement('button');
    activeToggleButton.type = 'button';
    activeToggleButton.dataset.petActiveToggle = 'true';
    activeToggleButton.style.cssText = `
      min-width: 92px;
      height: 30px;
      border-radius: 2px;
      border: 1px solid rgba(109, 255, 138, 0.55);
      background: linear-gradient(135deg, rgba(8, 33, 19, 0.8), rgba(4, 20, 13, 0.86));
      color: rgba(163, 255, 192, 0.98);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
      padding: 0 12px;
      transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease, opacity 0.18s ease;
    `;
    activeToggleButton.addEventListener('click', () => this.togglePetActiveState());

    nicknameRow.appendChild(nicknameLabel);
    nicknameRow.appendChild(nicknameEditButton);
    left.appendChild(nicknameRow);
    left.appendChild(statusLabel);
    controls.appendChild(activeToggleButton);
    this.activeToggleButtonElement = activeToggleButton;
    this.updateActiveToggleButton(true);

    infoRow.appendChild(left);
    infoRow.appendChild(controls);
    card.appendChild(visual);
    card.appendChild(infoRow);

    return card;
  }

  private createStatsBlock(): HTMLElement {
    const block = document.createElement('section');
    block.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 2px;
      padding: 16px;
      background: rgba(11, 14, 22, 0.58);
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      min-height: 0;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Telemetry Data';
    title.style.cssText = `
      margin: 0 0 6px 0;
      font-size: 13px;
      letter-spacing: 1.3px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.92);
      font-weight: 800;
    `;
    block.appendChild(title);

    block.appendChild(this.createStatRow('Experience', 'experience'));
    block.appendChild(this.createStatRow('Hull', 'health'));
    block.appendChild(this.createStatRow('Shield', 'shield'));
    block.appendChild(this.createStatRow('Level', 'maxLevel'));

    return block;
  }

  private createStatRow(label: string, fieldKey: string): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(90deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.018));
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      padding: 11px 13px;
      gap: 12px;
    `;

    const name = document.createElement('div');
    name.style.cssText = `
      font-size: 12px;
      color: rgba(255, 255, 255, 0.84);
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    `;
    name.textContent = label;

    const value = document.createElement('div');
    value.style.cssText = `
      font-size: 14px;
      color: #ffffff;
      font-weight: 800;
      font-family: 'Consolas', 'Courier New', monospace;
      text-align: right;
      letter-spacing: 0.3px;
    `;
    value.dataset.petField = fieldKey;
    value.textContent = '--';

    row.appendChild(name);
    row.appendChild(value);

    return row;
  }

  private createModuleInventoryBlock(): HTMLElement {
    const block = document.createElement('section');
    block.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 2px;
      padding: 16px;
      background: rgba(11, 14, 22, 0.58);
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
      min-height: 0;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Module Bay';
    title.style.cssText = `
      margin: 0;
      font-size: 13px;
      letter-spacing: 1.3px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.92);
      font-weight: 800;
    `;
    block.appendChild(title);

    const moduleSlot = document.createElement('div');
    moduleSlot.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      background: linear-gradient(90deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.018));
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;

    const moduleSlotLabel = document.createElement('div');
    moduleSlotLabel.textContent = 'Equipped Module';
    moduleSlotLabel.style.cssText = `
      font-size: 10px;
      color: rgba(255, 255, 255, 0.62);
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
    `;

    const moduleSlotName = document.createElement('div');
    moduleSlotName.dataset.petModuleName = 'true';
    moduleSlotName.style.cssText = `
      font-size: 15px;
      color: rgba(255, 255, 255, 0.95);
      font-weight: 800;
      letter-spacing: 0.4px;
      text-transform: none;
    `;
    moduleSlotName.textContent = 'Empty Slot';

    const moduleSlotMeta = document.createElement('div');
    moduleSlotMeta.dataset.petModuleMeta = 'true';
    moduleSlotMeta.style.cssText = `
      font-size: 11px;
      color: rgba(255, 255, 255, 0.64);
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    `;
    moduleSlotMeta.textContent = 'No module equipped';

    const moduleSlotRarity = document.createElement('div');
    moduleSlotRarity.dataset.petModuleRarity = 'true';
    moduleSlotRarity.style.cssText = `
      font-size: 10px;
      color: rgba(148, 163, 184, 0.9);
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
    `;
    moduleSlotRarity.textContent = 'COMMON';

    moduleSlot.appendChild(moduleSlotLabel);
    moduleSlot.appendChild(moduleSlotName);
    moduleSlot.appendChild(moduleSlotMeta);
    moduleSlot.appendChild(moduleSlotRarity);
    block.appendChild(moduleSlot);

    this.moduleSlotNameElement = moduleSlotName;
    this.moduleSlotMetaElement = moduleSlotMeta;
    this.moduleSlotRarityElement = moduleSlotRarity;

    const inventoryHeader = document.createElement('div');
    inventoryHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    `;

    const inventoryTitle = document.createElement('div');
    inventoryTitle.textContent = 'Pet Inventory';
    inventoryTitle.style.cssText = `
      font-size: 11px;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
    `;

    const inventoryCount = document.createElement('div');
    inventoryCount.dataset.petInventoryCount = 'true';
    inventoryCount.style.cssText = `
      font-size: 11px;
      color: rgba(186, 230, 253, 0.9);
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      font-family: 'Consolas', 'Courier New', monospace;
    `;
    inventoryCount.textContent = '0/8';

    inventoryHeader.appendChild(inventoryTitle);
    inventoryHeader.appendChild(inventoryCount);
    block.appendChild(inventoryHeader);

    const inventoryGrid = document.createElement('div');
    inventoryGrid.dataset.petInventoryGrid = 'true';
    inventoryGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      min-height: 0;
      overflow: auto;
      padding-right: 2px;
    `;

    this.petInventoryGridElement = inventoryGrid;
    this.petInventoryCountElement = inventoryCount;
    this.renderPetInventory([], 8);

    block.appendChild(inventoryGrid);
    return block;
  }

  private createInventorySlotCell(
    item: NormalizedPetInventoryItem | null,
    slotIndex: number
  ): HTMLElement {
    const cell = document.createElement('div');
    const rarityColor = item ? this.getRarityColor(item.rarity) : 'rgba(148, 163, 184, 0.35)';
    cell.style.cssText = `
      border: 1px solid ${rarityColor};
      border-radius: 2px;
      background: rgba(5, 10, 19, 0.72);
      min-height: 68px;
      padding: 8px 9px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 6px;
    `;

    const name = document.createElement('div');
    name.style.cssText = `
      font-size: 11px;
      color: ${item ? 'rgba(255, 255, 255, 0.94)' : 'rgba(148, 163, 184, 0.86)'};
      font-weight: 700;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    name.textContent = item ? item.itemName : `Empty ${slotIndex + 1}`;

    const meta = document.createElement('div');
    meta.style.cssText = `
      font-size: 10px;
      color: ${item ? 'rgba(186, 230, 253, 0.9)' : 'rgba(148, 163, 184, 0.72)'};
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      font-family: 'Consolas', 'Courier New', monospace;
    `;
    meta.textContent = item ? `x${item.quantity} | ${item.rarity.toUpperCase()}` : '--';

    cell.appendChild(name);
    cell.appendChild(meta);
    return cell;
  }

  override update(data: any): void {
    const normalizedState = this.normalizePetState(data?.petState);
    if (!normalizedState) return;

    this.lastPetNickname = normalizedState.petNickname;
    this.lastPetIsActive = normalizedState.isActive !== false;
    const inputHasFocus = this.nicknameInputElement
      ? document.activeElement === this.nicknameInputElement
      : false;
    if (this.nicknameInputElement && (!inputHasFocus || !this.nicknameInputElement.value.trim())) {
      this.nicknameInputElement.value = normalizedState.petNickname;
    }

    this.updateField('petNickname', normalizedState.petNickname);
    this.updateActiveStatusField(this.lastPetIsActive);
    this.updateActiveToggleButton(this.lastPetIsActive);
    this.updateField(
      'experience',
      `${normalizedState.experienceProgressInLevel}/${normalizedState.experienceForNextLevel}`
    );
    this.updateField('health', `${normalizedState.currentHealth}/${normalizedState.maxHealth}`);
    this.updateField('shield', `${normalizedState.currentShield}/${normalizedState.maxShield}`);
    this.updateField('maxLevel', `${normalizedState.level}/${normalizedState.maxLevel}`);
    this.updateCompanionPreview(normalizedState.petId);
    this.updatePetModuleSlot(normalizedState.moduleSlot);
    this.renderPetInventory(normalizedState.inventory, normalizedState.inventoryCapacity);
  }

  protected override onShow(): void {
    if (!this.petStateProvider) return;
    const petState = this.petStateProvider();
    if (!petState) return;
    this.update({ petState });
    this.startCompanionPreviewAnimation();
  }

  protected override onHide(): void {
    this.stopCompanionPreviewAnimation();
    this.closeNicknameModal();
    this.hideNicknameNotice();
  }

  private openNicknameModal(): void {
    if (!this.nicknameModalElement || !this.nicknameInputElement) return;
    this.nicknameModalElement.style.display = 'flex';
    this.nicknameInputElement.value = this.lastPetNickname || this.nicknameInputElement.value || '';
    this.showNicknameFeedback('');
    this.nicknameInputElement.focus();
    this.nicknameInputElement.select();
  }

  private closeNicknameModal(): void {
    if (!this.nicknameModalElement) return;
    this.nicknameModalElement.style.display = 'none';
    this.showNicknameFeedback('');
  }

  private showNicknameNotice(message: string): void {
    if (!this.nicknameNoticeElement) return;
    this.nicknameNoticeElement.textContent = message;
    this.nicknameNoticeElement.style.opacity = '1';
    this.nicknameNoticeElement.style.transform = 'translate(-50%, 0)';

    if (this.nicknameNoticeTimeoutId !== null) {
      clearTimeout(this.nicknameNoticeTimeoutId);
    }
    this.nicknameNoticeTimeoutId = window.setTimeout(() => {
      this.hideNicknameNotice();
    }, 1900);
  }

  private hideNicknameNotice(): void {
    if (!this.nicknameNoticeElement) return;
    if (this.nicknameNoticeTimeoutId !== null) {
      clearTimeout(this.nicknameNoticeTimeoutId);
      this.nicknameNoticeTimeoutId = null;
    }
    this.nicknameNoticeElement.style.opacity = '0';
    this.nicknameNoticeElement.style.transform = 'translate(-50%, -6px)';
  }

  private normalizePetState(rawPetState: unknown): NormalizedPetState | null {
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
    const petNickname = this.normalizeNickname(source.petNickname);
    const moduleSlot = this.normalizeModuleSlot(
      source.moduleSlot ?? source.petModuleSlot ?? source.module ?? source.module_slot
    );
    const inventory = this.normalizeInventory(
      source.inventory ?? source.petInventory ?? source.cargo ?? source.pet_inventory
    );
    const inventoryCapacity = Math.max(
      inventory.length,
      Math.max(4, Math.floor(Number(source.inventoryCapacity ?? source.petInventoryCapacity ?? 8)))
    );

    const experienceAtCurrentLevel = Math.max(0, this.getExperienceRequiredForLevel(level));
    const experienceForNextLevelRaw = this.getExperienceRequiredForLevel(Math.min(maxLevel, level + 1));
    const experienceForNextLevel = Math.max(1, experienceForNextLevelRaw - experienceAtCurrentLevel);
    const experienceProgressInLevel = Math.max(0, Math.min(
      experienceForNextLevel,
      experience - experienceAtCurrentLevel
    ));

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
      experienceForNextLevel,
      experienceAtCurrentLevel,
      experienceProgressInLevel,
      moduleSlot,
      inventory,
      inventoryCapacity
    };
  }

  private normalizeModuleSlot(rawSlot: unknown): NormalizedPetModuleSlot {
    if (!rawSlot || typeof rawSlot !== 'object') {
      return {
        itemId: '',
        itemName: 'Empty Slot',
        rarity: 'common',
        level: 1,
        isEmpty: true
      };
    }

    const source = rawSlot as Record<string, unknown>;
    const itemId = String(source.itemId ?? source.id ?? source.moduleId ?? '').trim();
    const itemName = String(source.itemName ?? source.name ?? '').trim();
    const rarity = String(source.rarity ?? source.grade ?? 'common').trim().toLowerCase();
    const level = Math.max(1, Math.floor(Number(source.level ?? source.tier ?? 1)));
    const isEmpty = !itemId && !itemName;

    return {
      itemId,
      itemName: itemName || itemId || 'Empty Slot',
      rarity: isEmpty ? 'common' : rarity,
      level,
      isEmpty
    };
  }

  private normalizeInventory(rawInventory: unknown): NormalizedPetInventoryItem[] {
    if (!Array.isArray(rawInventory)) return [];

    return rawInventory
      .map((rawItem) => {
        if (!rawItem || typeof rawItem !== 'object') return null;
        const source = rawItem as Record<string, unknown>;
        const itemId = String(source.itemId ?? source.id ?? '').trim();
        const itemName = String(source.itemName ?? source.name ?? '').trim();
        if (!itemId && !itemName) return null;

        return {
          itemId: itemId || itemName.toLowerCase().replace(/\s+/g, '_'),
          itemName: itemName || itemId,
          quantity: Math.max(1, Math.floor(Number(source.quantity ?? source.count ?? 1))),
          rarity: String(source.rarity ?? source.grade ?? 'common').trim().toLowerCase()
        };
      })
      .filter((item): item is NormalizedPetInventoryItem => !!item);
  }

  private updatePetModuleSlot(moduleSlot: NormalizedPetModuleSlot): void {
    if (!this.moduleSlotNameElement || !this.moduleSlotMetaElement || !this.moduleSlotRarityElement) return;

    this.moduleSlotNameElement.textContent = moduleSlot.itemName;
    this.moduleSlotMetaElement.textContent = moduleSlot.isEmpty
      ? 'No module equipped'
      : `LV ${moduleSlot.level} | READY`;
    this.moduleSlotRarityElement.textContent = moduleSlot.isEmpty
      ? 'EMPTY'
      : moduleSlot.rarity.toUpperCase();
    this.moduleSlotRarityElement.style.color = this.getRarityColor(moduleSlot.rarity);
  }

  private renderPetInventory(items: NormalizedPetInventoryItem[], capacity: number): void {
    if (!this.petInventoryGridElement) return;

    const safeCapacity = Math.max(4, Math.min(24, Math.floor(Number(capacity || 0) || 8)));
    const occupiedCount = Math.min(items.length, safeCapacity);
    if (this.petInventoryCountElement) {
      this.petInventoryCountElement.textContent = `${occupiedCount}/${safeCapacity}`;
    }

    this.petInventoryGridElement.replaceChildren();
    for (let slotIndex = 0; slotIndex < safeCapacity; slotIndex++) {
      const item = slotIndex < items.length ? items[slotIndex] : null;
      const slotCell = this.createInventorySlotCell(item, slotIndex);
      this.petInventoryGridElement.appendChild(slotCell);
    }
  }

  private getRarityColor(rarity: string): string {
    const normalized = String(rarity || 'common').trim().toLowerCase();
    if (normalized === 'uncommon') return 'rgba(109, 255, 138, 0.95)';
    if (normalized === 'rare') return 'rgba(96, 165, 250, 0.95)';
    if (normalized === 'epic') return 'rgba(196, 181, 253, 0.95)';
    if (normalized === 'legendary') return 'rgba(251, 191, 36, 0.95)';
    return 'rgba(186, 230, 253, 0.9)';
  }

  private sanitizePetIdForAssetPath(rawPetId: string): string {
    return String(rawPetId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  }

  private async updateCompanionPreview(petId: string): Promise<void> {
    const normalizedPetId = this.sanitizePetIdForAssetPath(petId);
    if (!normalizedPetId || !this.companionSpriteElement) {
      this.currentPreviewAnimation = null;
      this.stopCompanionPreviewAnimation();
      return;
    }
    if (normalizedPetId === this.currentPreviewPetId) {
      this.startCompanionPreviewAnimation();
      return;
    }
    this.currentPreviewPetId = normalizedPetId;

    const requestToken = ++this.previewRequestToken;
    const previewAnimation = await this.loadPetPreviewFrame(normalizedPetId);
    if (requestToken !== this.previewRequestToken || !this.companionSpriteElement) return;

    if (!previewAnimation || !previewAnimation.frames.length) {
      this.currentPreviewAnimation = null;
      this.stopCompanionPreviewAnimation();
      this.companionSpriteElement.style.backgroundImage = 'none';
      return;
    }

    this.currentPreviewAnimation = previewAnimation;
    this.previewAnimationFrameIndex = 0;
    this.companionSpriteElement.style.backgroundImage = `url("assets/pet/${normalizedPetId}.png")`;
    this.companionSpriteElement.style.width = `${Math.round(previewAnimation.frameWidth * PetPanel.COMPANION_PREVIEW_SCALE)}px`;
    this.companionSpriteElement.style.height = `${Math.round(previewAnimation.frameHeight * PetPanel.COMPANION_PREVIEW_SCALE)}px`;
    this.applyCompanionPreviewFrame(0);
    this.startCompanionPreviewAnimation();
  }

  private async loadPetPreviewFrame(petId: string): Promise<PetPreviewAnimationData | null> {
    if (this.petPreviewFrameCache.has(petId)) {
      return this.petPreviewFrameCache.get(petId) || null;
    }

    try {
      const response = await fetch(`assets/pet/${petId}.atlas`, { cache: 'force-cache' });
      if (!response.ok) {
        this.petPreviewFrameCache.set(petId, null);
        return null;
      }

      const atlasText = await response.text();
      const sections = AtlasParser.parseAtlasTextAll(atlasText);
      const frames = sections[0]?.frames || [];
      if (!frames.length) {
        this.petPreviewFrameCache.set(petId, null);
        return null;
      }

      const previewFrames: PetPreviewFrame[] = frames
        .filter((frame) => frame.width > 0 && frame.height > 0)
        .sort((frameA, frameB) => this.compareFrameNames(frameA.name, frameB.name))
        .map((frame) => ({
          x: frame.x,
          y: frame.y,
          width: frame.width,
          height: frame.height
        }));

      if (!previewFrames.length) {
        this.petPreviewFrameCache.set(petId, null);
        return null;
      }

      const frameWidth = previewFrames.reduce(
        (maxWidth, frame) => Math.max(maxWidth, frame.width),
        0
      );
      const frameHeight = previewFrames.reduce(
        (maxHeight, frame) => Math.max(maxHeight, frame.height),
        0
      );

      const animationData: PetPreviewAnimationData = {
        frames: previewFrames,
        frameWidth,
        frameHeight
      };

      this.petPreviewFrameCache.set(petId, animationData);
      return animationData;
    } catch {
      this.petPreviewFrameCache.set(petId, null);
      return null;
    }
  }

  private compareFrameNames(nameA: string, nameB: string): number {
    const numericA = Number(nameA);
    const numericB = Number(nameB);
    const bothNumeric = Number.isFinite(numericA) && Number.isFinite(numericB);
    if (bothNumeric) return numericA - numericB;
    return nameA.localeCompare(nameB);
  }

  private startCompanionPreviewAnimation(): void {
    this.stopCompanionPreviewAnimation();
    this.applyCompanionPreviewFrame(this.previewAnimationFrameIndex);

    if (!this.isVisible || !this.currentPreviewAnimation || this.currentPreviewAnimation.frames.length <= 1) {
      return;
    }

    this.previewAnimationIntervalId = window.setInterval(() => {
      if (!this.isVisible || !this.currentPreviewAnimation) return;
      this.previewAnimationFrameIndex += 1;
      this.applyCompanionPreviewFrame(this.previewAnimationFrameIndex);
    }, PetPanel.COMPANION_PREVIEW_TICK_MS);
  }

  private stopCompanionPreviewAnimation(): void {
    if (this.previewAnimationIntervalId !== null) {
      clearInterval(this.previewAnimationIntervalId);
      this.previewAnimationIntervalId = null;
    }
  }

  private applyCompanionPreviewFrame(frameIndex: number): void {
    if (!this.companionSpriteElement || !this.currentPreviewAnimation || !this.currentPreviewAnimation.frames.length) {
      return;
    }

    const totalFrames = this.currentPreviewAnimation.frames.length;
    const normalizedFrameIndex = ((Math.floor(frameIndex) % totalFrames) + totalFrames) % totalFrames;
    const frame = this.currentPreviewAnimation.frames[normalizedFrameIndex];
    this.previewAnimationFrameIndex = normalizedFrameIndex;
    this.companionSpriteElement.style.backgroundPosition = `-${frame.x}px -${frame.y}px`;
  }

  private submitNickname(): void {
    const normalizedNickname = this.normalizeNickname(this.nicknameInputElement?.value);
    if (!normalizedNickname) {
      this.showNicknameFeedback('Invalid nickname', true);
      return;
    }

    if (normalizedNickname === this.lastPetNickname) {
      this.showNicknameFeedback('Already set');
      return;
    }

    if (!this.petNicknameSubmitter) {
      this.showNicknameFeedback('Network unavailable', true);
      return;
    }

    const sent = this.petNicknameSubmitter(normalizedNickname);
    if (!sent) {
      this.showNicknameFeedback('Send failed', true);
      return;
    }

    this.lastPetNickname = normalizedNickname;
    this.updateField('petNickname', normalizedNickname);
    if (this.nicknameInputElement) {
      this.nicknameInputElement.value = normalizedNickname;
    }
    this.closeNicknameModal();
    this.showNicknameNotice('Nickname saved');
  }

  private togglePetActiveState(): void {
    if (!this.petActiveSubmitter) {
      this.showNicknameNotice('Network unavailable');
      return;
    }

    const nextActiveState = !this.lastPetIsActive;
    const sent = this.petActiveSubmitter(nextActiveState);
    if (!sent) {
      this.showNicknameNotice('Toggle failed');
      return;
    }

    this.lastPetIsActive = nextActiveState;
    this.updateActiveStatusField(nextActiveState);
    this.updateActiveToggleButton(nextActiveState);
    this.showNicknameNotice(nextActiveState ? 'Pet resumed' : 'Pet paused');
  }

  private updateActiveStatusField(isActive: boolean): void {
    const field = this.content.querySelector<HTMLElement>('[data-pet-field="activeStatus"]');
    if (!field) return;

    field.textContent = isActive ? 'active' : 'paused';
    field.style.color = isActive
      ? 'rgba(109, 255, 138, 0.95)'
      : 'rgba(248, 113, 113, 0.95)';
  }

  private updateActiveToggleButton(isActive: boolean): void {
    const activeToggleButton = this.resolveActiveToggleButton();
    if (!activeToggleButton) return;

    if (isActive) {
      activeToggleButton.textContent = 'Pause';
      activeToggleButton.style.borderColor = 'rgba(248, 113, 113, 0.58)';
      activeToggleButton.style.background = 'linear-gradient(135deg, rgba(52, 12, 12, 0.8), rgba(26, 8, 8, 0.86))';
      activeToggleButton.style.color = 'rgba(254, 202, 202, 0.98)';
      return;
    }

    activeToggleButton.textContent = 'Play';
    activeToggleButton.style.borderColor = 'rgba(109, 255, 138, 0.55)';
    activeToggleButton.style.background = 'linear-gradient(135deg, rgba(8, 33, 19, 0.8), rgba(4, 20, 13, 0.86))';
    activeToggleButton.style.color = 'rgba(163, 255, 192, 0.98)';
  }

  private resolveActiveToggleButton(): HTMLButtonElement | null {
    const contentRoot = this.content;
    if (!contentRoot) {
      return this.activeToggleButtonElement;
    }

    if (this.activeToggleButtonElement && contentRoot.contains(this.activeToggleButtonElement)) {
      return this.activeToggleButtonElement;
    }

    this.activeToggleButtonElement = contentRoot.querySelector<HTMLButtonElement>('[data-pet-active-toggle]');
    return this.activeToggleButtonElement;
  }

  private normalizeNickname(rawNickname: unknown): string {
    return String(rawNickname ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24)
      .trim();
  }

  private showNicknameFeedback(message: string, isError: boolean = false): void {
    if (!this.nicknameFeedbackElement) return;
    this.nicknameFeedbackElement.textContent = message;
    this.nicknameFeedbackElement.style.color = isError
      ? 'rgba(248, 113, 113, 0.95)'
      : 'rgba(186, 230, 253, 0.9)';
  }

  private getExperienceRequiredForLevel(level: number): number {
    const safeLevel = Math.max(1, Math.floor(level));
    if (safeLevel <= 1) return 0;

    const progressionRequirements: Record<number, number> = {
      2: 2000,
      3: 6000,
      4: 14000,
      5: 30000,
      6: 62000,
      7: 126000,
      8: 254000,
      9: 510000,
      10: 1022000,
      11: 2046000,
      12: 4094000,
      13: 8190000,
      14: 16382000,
      15: 32782000
    };

    return Number(progressionRequirements[safeLevel] || progressionRequirements[15] || 0);
  }

  private updateField(fieldKey: string, value: string): void {
    const field = this.content.querySelector<HTMLElement>(`[data-pet-field="${fieldKey}"]`);
    if (!field) return;
    field.textContent = value;
  }
}
