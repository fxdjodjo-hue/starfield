import { BasePanel } from './FloatingIcon';
import type { PanelConfig } from './PanelConfig';
import type { PetStatePayload } from '../../config/NetworkConfig';

interface NormalizedPetState extends PetStatePayload {
  experienceForNextLevel: number;
  experienceAtCurrentLevel: number;
  experienceProgressInLevel: number;
}

export class PetPanel extends BasePanel {
  private readonly petStateProvider: (() => PetStatePayload | null) | null;

  constructor(config: PanelConfig, petStateProvider?: (() => PetStatePayload | null)) {
    super(config);
    this.petStateProvider = typeof petStateProvider === 'function' ? petStateProvider : null;
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
    const summaryCard = this.createSummaryCard();
    const statsBlock = this.createStatsBlock();

    content.appendChild(header);
    content.appendChild(summaryCard);
    content.appendChild(statsBlock);

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

    const modelLabel = document.createElement('div');
    modelLabel.style.cssText = `
      font-size: 14px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.95);
      letter-spacing: 0.4px;
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

    const experienceAtCurrentLevel = Math.max(0, this.getExperienceRequiredForLevel(level));
    const experienceForNextLevelRaw = this.getExperienceRequiredForLevel(Math.min(maxLevel, level + 1));
    const experienceForNextLevel = Math.max(1, experienceForNextLevelRaw - experienceAtCurrentLevel);
    const experienceProgressInLevel = Math.max(0, Math.min(
      experienceForNextLevel,
      experience - experienceAtCurrentLevel
    ));

    return {
      petId,
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
