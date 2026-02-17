import { BasePanel } from './FloatingIcon';
import type { PanelConfig } from './PanelConfig';
import type { PetStatePayload } from '../../config/NetworkConfig';

interface NormalizedPetState extends PetStatePayload {
  petNickname: string;
  experienceForNextLevel: number;
  experienceAtCurrentLevel: number;
  experienceProgressInLevel: number;
}

export class PetPanel extends BasePanel {
  private readonly petStateProvider: (() => PetStatePayload | null) | null;
  private readonly petNicknameSubmitter: ((petNickname: string) => boolean) | null;
  private nicknameInputElement: HTMLInputElement | null = null;
  private nicknameFeedbackElement: HTMLElement | null = null;
  private lastPetNickname: string = '';

  constructor(
    config: PanelConfig,
    petStateProvider?: (() => PetStatePayload | null),
    petNicknameSubmitter?: ((petNickname: string) => boolean)
  ) {
    super(config);
    this.petStateProvider = typeof petStateProvider === 'function' ? petStateProvider : null;
    this.petNicknameSubmitter = typeof petNicknameSubmitter === 'function' ? petNicknameSubmitter : null;
    this.nicknameInputElement = this.content.querySelector<HTMLInputElement>('[data-pet-nickname-input]');
    this.nicknameFeedbackElement = this.content.querySelector<HTMLElement>('[data-pet-nickname-feedback]');
  }

  protected createPanelContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'pet-panel-content';
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
    const nicknameEditor = this.createNicknameEditor();
    const summaryCard = this.createSummaryCard();
    const statsBlock = this.createStatsBlock();

    content.appendChild(header);
    content.appendChild(nicknameEditor);
    content.appendChild(summaryCard);
    content.appendChild(statsBlock);

    return content;
  }

  private createNicknameEditor(): HTMLElement {
    const section = document.createElement('section');
    section.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.25);
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    const title = document.createElement('div');
    title.textContent = 'Pet Nickname';
    title.style.cssText = `
      margin: 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    `;

    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    const input = document.createElement('input');
    input.dataset.petNicknameInput = 'true';
    input.type = 'text';
    input.placeholder = 'Insert pet nickname';
    input.maxLength = 24;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.cssText = `
      flex: 1;
      min-width: 0;
      height: 34px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(0, 0, 0, 0.35);
      color: rgba(255, 255, 255, 0.96);
      padding: 0 10px;
      font-size: 14px;
      font-weight: 600;
      outline: none;
    `;

    const submitButton = document.createElement('button');
    submitButton.dataset.petNicknameSave = 'true';
    submitButton.type = 'button';
    submitButton.textContent = 'Save';
    submitButton.style.cssText = `
      height: 34px;
      border-radius: 8px;
      border: 1px solid rgba(56, 189, 248, 0.45);
      background: linear-gradient(135deg, rgba(14, 116, 144, 0.65), rgba(2, 132, 199, 0.45));
      color: #e0f2fe;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.5px;
      padding: 0 14px;
      cursor: pointer;
      text-transform: uppercase;
      white-space: nowrap;
    `;
    submitButton.addEventListener('click', () => this.submitNickname());
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.submitNickname();
    });

    row.appendChild(input);
    row.appendChild(submitButton);

    const feedback = document.createElement('div');
    feedback.dataset.petNicknameFeedback = 'true';
    feedback.style.cssText = `
      min-height: 16px;
      color: rgba(186, 230, 253, 0.9);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.2px;
    `;

    section.appendChild(title);
    section.appendChild(row);
    section.appendChild(feedback);

    this.nicknameInputElement = input;
    this.nicknameFeedbackElement = feedback;

    return section;
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
    title.textContent = 'PET';
    title.style.cssText = `
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 3px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'COMPANION STATUS';
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

  private createSummaryCard(): HTMLElement {
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

    const left = document.createElement('div');
    left.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    const nicknameLabel = document.createElement('div');
    nicknameLabel.style.cssText = `
      font-size: 16px;
      font-weight: 800;
      color: rgba(255, 255, 255, 0.98);
      letter-spacing: 0.4px;
      text-transform: none;
    `;
    nicknameLabel.dataset.petField = 'petNickname';
    nicknameLabel.textContent = 'Sentinel';

    const modelLabel = document.createElement('div');
    modelLabel.style.cssText = `
      font-size: 12px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.68);
      letter-spacing: 0.7px;
      text-transform: uppercase;
    `;
    modelLabel.dataset.petField = 'petId';
    modelLabel.textContent = 'ship50';

    const statusLabel = document.createElement('div');
    statusLabel.style.cssText = `
      font-size: 11px;
      color: rgba(186, 230, 253, 0.9);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 700;
    `;
    statusLabel.dataset.petField = 'activeStatus';
    statusLabel.textContent = 'active';

    left.appendChild(nicknameLabel);
    left.appendChild(modelLabel);
    left.appendChild(statusLabel);

    const levelBadge = document.createElement('div');
    levelBadge.style.cssText = `
      font-size: 14px;
      font-weight: 800;
      color: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 999px;
      padding: 6px 12px;
      line-height: 1;
      white-space: nowrap;
      font-family: 'Consolas', 'Courier New', monospace;
    `;
    levelBadge.dataset.petField = 'levelBadge';
    levelBadge.textContent = 'LV 1';

    card.appendChild(left);
    card.appendChild(levelBadge);

    return card;
  }

  private createStatsBlock(): HTMLElement {
    const block = document.createElement('section');
    block.style.cssText = `
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      min-height: 0;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Pet Stats';
    title.style.cssText = `
      margin: 0 0 4px 0;
      font-size: 13px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.92);
      font-weight: 700;
    `;
    block.appendChild(title);

    block.appendChild(this.createStatRow('Experience', 'experience'));
    block.appendChild(this.createStatRow('Hull', 'health'));
    block.appendChild(this.createStatRow('Shield', 'shield'));
    block.appendChild(this.createStatRow('Cap', 'maxLevel'));

    return block;
  }

  private createStatRow(label: string, fieldKey: string): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 10px 12px;
      gap: 12px;
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
      font-size: 14px;
      color: #ffffff;
      font-weight: 800;
      font-family: 'Consolas', 'Courier New', monospace;
      text-align: right;
    `;
    value.dataset.petField = fieldKey;
    value.textContent = '--';

    row.appendChild(name);
    row.appendChild(value);

    return row;
  }

  override update(data: any): void {
    const normalizedState = this.normalizePetState(data?.petState);
    if (!normalizedState) return;

    this.lastPetNickname = normalizedState.petNickname;
    const inputHasFocus = this.nicknameInputElement
      ? document.activeElement === this.nicknameInputElement
      : false;
    if (this.nicknameInputElement && (!inputHasFocus || !this.nicknameInputElement.value.trim())) {
      this.nicknameInputElement.value = normalizedState.petNickname;
    }

    this.updateField('petNickname', normalizedState.petNickname);
    this.updateField('petId', normalizedState.petId);
    this.updateField('activeStatus', normalizedState.isActive ? 'active' : 'inactive');
    this.updateField('levelBadge', `LV ${normalizedState.level}`);
    this.updateField(
      'experience',
      `${normalizedState.experienceProgressInLevel}/${normalizedState.experienceForNextLevel}`
    );
    this.updateField('health', `${normalizedState.currentHealth}/${normalizedState.maxHealth}`);
    this.updateField('shield', `${normalizedState.currentShield}/${normalizedState.maxShield}`);
    this.updateField('maxLevel', `LV ${normalizedState.level}/${normalizedState.maxLevel}`);
  }

  protected override onShow(): void {
    if (!this.petStateProvider) return;
    const petState = this.petStateProvider();
    if (!petState) return;
    this.update({ petState });
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
      experienceProgressInLevel
    };
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

    if (this.nicknameInputElement) {
      this.nicknameInputElement.value = normalizedNickname;
    }
    this.showNicknameFeedback('Update requested');
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
