import { BasePanel } from './FloatingIcon';
import type { PanelConfig } from './PanelConfig';
import { LogType } from './LogMessage';
import {
  LOG_EVENT_ENTRY_ADDED,
  LOG_EVENT_HISTORY_CLEARED,
  type LogCategory,
  type LogHistoryEntry
} from '../../systems/rendering/LogSystem';
import { DomPanelInteractionController } from './interactions/DomPanelInteractionController';

const MAX_RENDERED_ENTRIES = 150;

/**
 * LogPanel - Pannello dedicato allo storico dei log di gioco.
 */
export class LogPanel extends BasePanel {
  private getHistoryEntries: () => LogHistoryEntry[] = () => [];
  private messagesContainer: HTMLElement | null = null;
  private dragHandleElement: HTMLElement | null = null;
  private autoScrollEnabled: boolean = true;
  private logEntryListener: ((event: Event) => void) | null = null;
  private historyClearedListener: ((event: Event) => void) | null = null;
  private readonly minWidth: number = 360;
  private readonly minHeight: number = 220;
  private panelInteraction: DomPanelInteractionController | null = null;

  constructor(
    config: PanelConfig,
    getHistoryEntries: () => LogHistoryEntry[]
  ) {
    super(config);

    // BasePanel invoca createPanelContent() dentro super().
    // I field initializer della sottoclasse vengono applicati dopo super(),
    // quindi i riferimenti assegnati durante createPanelContent vanno ricollegati qui.
    this.messagesContainer = this.container.querySelector<HTMLElement>('.log-panel-messages');
    this.dragHandleElement = this.container.querySelector<HTMLElement>('.log-panel-drag-handle');

    this.getHistoryEntries = getHistoryEntries;

    // Performance profile for frequent resizing:
    // avoid expensive backdrop filters and avoid width/height transitions.
    this.container.style.backdropFilter = 'none';
    this.container.style.setProperty('-webkit-backdrop-filter', 'none');
    this.container.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.35)';
    this.container.style.transition = 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    this.container.style.contain = 'layout paint style';

    this.setupLogEventListeners();
    this.panelInteraction = new DomPanelInteractionController({
      container: this.container,
      dragHandle: this.dragHandleElement,
      minWidth: this.minWidth,
      minHeight: this.minHeight
    });
    this.renderHistory(this.getHistoryEntries());
  }

  protected createPanelContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'log-panel-content';
    content.style.cssText = `
      padding: 24px;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-sizing: border-box;
      position: relative;
      background: rgba(8, 10, 14, 0.82);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: rgba(255, 255, 255, 0.9);
      contain: layout paint;
    `;

    const style = document.createElement('style');
    style.textContent = `
      .log-panel-messages::-webkit-scrollbar {
        width: 7px;
      }
      .log-panel-messages::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.04);
        border-radius: 6px;
      }
      .log-panel-messages::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.18);
        border-radius: 6px;
      }
      .log-panel-messages::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.28);
      }
    `;
    content.appendChild(style);

    const headerSection = document.createElement('div');
    headerSection.className = 'log-panel-drag-handle';
    headerSection.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      cursor: move;
      user-select: none;
    `;

    const titleGroup = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'LOGS';
    title.style.cssText = `
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 3px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'SYSTEM AND GAMEPLAY EVENTS';
    subtitle.style.cssText = `
      margin: 4px 0 0 0;
      color: rgba(255, 255, 255, 0.6);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
    `;

    titleGroup.appendChild(title);
    titleGroup.appendChild(subtitle);
    headerSection.appendChild(titleGroup);
    headerSection.appendChild(this.createCloseButton());
    content.appendChild(headerSection);

    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'log-panel-messages';
    messagesContainer.style.cssText = `
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-right: 4px;
      contain: content;
    `;

    messagesContainer.addEventListener('scroll', () => {
      this.autoScrollEnabled = this.isNearBottom(messagesContainer);
    });

    this.messagesContainer = messagesContainer;
    content.appendChild(messagesContainer);

    return content;
  }

  protected onShow(): void {
    this.autoScrollEnabled = true;
    this.renderHistory(this.getHistoryEntries());
    this.panelInteraction?.applyStoredLayout();
    this.scrollToBottom(true);
  }

  updatePosition(): void {
    super.updatePosition();
    this.panelInteraction?.applyStoredLayout();
    this.panelInteraction?.ensureContainerWithinViewport();
  }

  destroy(): void {
    this.panelInteraction?.destroy();
    this.panelInteraction = null;
    this.teardownLogEventListeners();
    super.destroy();
  }

  private createCloseButton(): HTMLButtonElement {
    const closeButton = document.createElement('button');
    closeButton.textContent = 'x';
    closeButton.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: none;
      color: rgba(255, 255, 255, 0.6);
      font-size: 20px;
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
    return closeButton;
  }

  private setupLogEventListeners(): void {
    if (typeof document === 'undefined') return;

    this.logEntryListener = (event: Event) => {
      const customEvent = event as CustomEvent<{ entry?: LogHistoryEntry }>;
      const entry = customEvent?.detail?.entry;
      if (!entry) return;

      if (!this.isPanelVisible()) {
        return;
      }

      this.appendEntry(entry);
    };

    this.historyClearedListener = () => {
      this.renderHistory([]);
    };

    document.addEventListener(LOG_EVENT_ENTRY_ADDED, this.logEntryListener);
    document.addEventListener(LOG_EVENT_HISTORY_CLEARED, this.historyClearedListener);
  }

  private teardownLogEventListeners(): void {
    if (typeof document === 'undefined') return;

    if (this.logEntryListener) {
      document.removeEventListener(LOG_EVENT_ENTRY_ADDED, this.logEntryListener);
      this.logEntryListener = null;
    }

    if (this.historyClearedListener) {
      document.removeEventListener(LOG_EVENT_HISTORY_CLEARED, this.historyClearedListener);
      this.historyClearedListener = null;
    }
  }

  private renderHistory(entries: LogHistoryEntry[]): void {
    if (!this.messagesContainer) return;

    const visibleEntries = entries.slice(-MAX_RENDERED_ENTRIES);
    this.messagesContainer.innerHTML = '';

    if (visibleEntries.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No log entries yet.';
      empty.style.cssText = `
        margin: auto;
        color: rgba(255, 255, 255, 0.55);
        font-size: 14px;
        font-style: italic;
        text-align: center;
      `;
      this.messagesContainer.appendChild(empty);
    } else {
      for (const entry of visibleEntries) {
        this.messagesContainer.appendChild(this.createEntryElement(entry));
      }
    }

    this.scrollToBottom(true);
  }

  private appendEntry(entry: LogHistoryEntry): void {
    if (!this.messagesContainer) return;

    const shouldKeepBottom = this.autoScrollEnabled || this.isNearBottom(this.messagesContainer, 48);
    const emptyMessage = this.messagesContainer.firstElementChild;

    if (emptyMessage && this.messagesContainer.childElementCount === 1 && emptyMessage.textContent === 'No log entries yet.') {
      this.messagesContainer.innerHTML = '';
    }

    this.messagesContainer.appendChild(this.createEntryElement(entry));

    while (this.messagesContainer.childElementCount > MAX_RENDERED_ENTRIES) {
      this.messagesContainer.removeChild(this.messagesContainer.firstChild as ChildNode);
    }

    if (shouldKeepBottom) {
      this.scrollToBottom(true);
    }
  }

  private createEntryElement(entry: LogHistoryEntry): HTMLElement {
    const color = this.resolveEntryColor(entry);
    const row = document.createElement('div');
    row.style.cssText = `
      border-left: 3px solid ${color};
      background: rgba(255, 255, 255, 0.04);
      border-radius: 6px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;

    const metaRow = document.createElement('div');
    metaRow.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    `;

    const time = document.createElement('span');
    time.textContent = this.formatTimestamp(entry.timestamp);
    time.style.cssText = `
      color: rgba(255, 255, 255, 0.58);
      font-size: 11px;
      letter-spacing: 0.6px;
      font-family: Consolas, 'Courier New', monospace;
    `;

    metaRow.appendChild(time);

    if (entry.category) {
      const categoryBadge = document.createElement('span');
      categoryBadge.textContent = this.formatCategoryLabel(entry.category);
      categoryBadge.style.cssText = `
        color: ${color};
        border: 1px solid ${color}55;
        background: ${color}22;
        border-radius: 6px;
        padding: 2px 7px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.7px;
        text-transform: uppercase;
        white-space: nowrap;
      `;
      metaRow.appendChild(categoryBadge);
    }

    const text = document.createElement('div');
    text.textContent = entry.text;
    text.style.cssText = `
      color: rgba(255, 255, 255, 0.92);
      font-size: 13px;
      line-height: 1.45;
      letter-spacing: 0.2px;
      white-space: pre-line;
      word-break: break-word;
    `;

    row.appendChild(metaRow);
    row.appendChild(text);
    return row;
  }

  private resolveEntryColor(entry: LogHistoryEntry): string {
    if (entry.category) {
      return this.resolveColorByCategory(entry.category);
    }

    return this.resolveColorByType(entry.type);
  }

  private resolveColorByCategory(category: LogCategory): string {
    switch (category) {
      case 'safezone':
        return '#4dd39b';
      case 'combat':
        return '#ff6363';
      case 'rewards':
        return '#ffd54f';
      case 'missions':
        return '#4da4ff';
      case 'error':
        return '#ff4d6d';
      case 'item':
        return '#a89bff';
      case 'resources':
        return '#55d6ff';
      case 'events':
        return '#ffb86b';
      default:
        return '#e7edf7';
    }
  }

  private resolveColorByType(type: LogType): string {
    switch (type) {
      case LogType.ATTACK_FAILED:
      case LogType.NPC_KILLED:
      case LogType.ATTACK_END:
        return '#ff6363';
      case LogType.MISSION:
        return '#ffd54f';
      case LogType.RARITY_UNCOMMON:
        return '#1eff00';
      case LogType.RARITY_RARE:
        return '#4da4ff';
      case LogType.RARITY_EPIC:
        return '#b07bff';
      case LogType.WELCOME:
      case LogType.REWARD:
      case LogType.GIFT:
      case LogType.RARITY_COMMON:
      case LogType.ATTACK_START:
      case LogType.INFO:
      default:
        return '#e7edf7';
    }
  }

  private formatCategoryLabel(category: LogCategory): string {
    return String(category || '')
      .replace(/_/g, ' ')
      .trim()
      .toUpperCase();
  }

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  private scrollToBottom(force: boolean = false): void {
    if (!this.messagesContainer) return;
    if (!force && !this.autoScrollEnabled) return;
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private isNearBottom(element: HTMLElement, thresholdPx: number = 24): boolean {
    const remaining = element.scrollHeight - element.clientHeight - element.scrollTop;
    return remaining <= thresholdPx;
  }
}
