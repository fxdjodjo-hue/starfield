import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { LogMessage, LogType } from '../../presentation/ui/LogMessage';
import { NumberFormatter } from '../../core/utils/ui/NumberFormatter';
import { DisplayManager } from '../../infrastructure/display';

export type LogCategory =
  | 'safezone'
  | 'combat'
  | 'rewards'
  | 'missions'
  | 'error'
  | 'item'
  | 'resources'
  | 'events';

export interface LogHistoryEntry {
  id: number;
  text: string;
  type: LogType;
  category: LogCategory | null;
  timestamp: number;
  duration: number;
}

export const LOG_EVENT_ENTRY_ADDED = 'starfield:log-entry-added';
export const LOG_EVENT_HISTORY_CLEARED = 'starfield:log-history-cleared';

/**
 * Sistema per gestire i messaggi di log in-game.
 * Mantiene uno storico consultabile via UI panel e supporta overlay canvas opzionale.
 */
export class LogSystem extends BaseSystem {
  private maxMessages: number = 3; // Numero massimo di messaggi visibili contemporaneamente
  private messageSpacing: number = 8; // Spazio tra i messaggi
  private topMargin: number = 50; // Margine dall'alto dello schermo
  private canvasOverlayEnabled: boolean = false;
  private historyEntries: LogHistoryEntry[] = [];
  private readonly maxHistoryEntries: number = 250;
  private nextEntryId: number = 1;

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Abilita/disabilita il rendering legacy dei log su canvas (alto/centro).
   */
  setCanvasOverlayEnabled(enabled: boolean): void {
    this.canvasOverlayEnabled = Boolean(enabled);
    if (!this.canvasOverlayEnabled) {
      this.clearTransientCanvasMessages();
    }
  }

  /**
   * Restituisce una copia dello storico log (ordinato dal piu vecchio al piu recente).
   */
  getHistoryEntries(limit?: number): LogHistoryEntry[] {
    const source = this.historyEntries;
    if (typeof limit === 'number' && limit > 0) {
      return source.slice(-Math.floor(limit)).map(entry => ({ ...entry }));
    }
    return source.map(entry => ({ ...entry }));
  }

  /**
   * Svuota lo storico log e notifica i listener UI.
   */
  clearHistory(): void {
    if (this.historyEntries.length === 0) return;
    this.historyEntries = [];
    this.emitHistoryCleared();
  }

  /**
   * Aggiorna i messaggi di log (lifetime e rimozione scaduti)
   */
  update(deltaTime: number): void {
    if (!this.canvasOverlayEnabled) return;

    const logMessages = this.ecs.getEntitiesWithComponents(LogMessage);

    for (const entity of logMessages) {
      const logMessage = this.ecs.getComponent(entity, LogMessage);
      if (!logMessage) continue;

      // Aggiorna durata
      logMessage.duration -= deltaTime;

      // Rimuovi messaggi scaduti
      if (logMessage.isExpired()) {
        this.ecs.removeEntity(entity);
      }
    }
  }

  /**
   * Renderizza i messaggi di log centrati in alto (legacy canvas overlay).
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.canvasOverlayEnabled) return;

    const logMessages = this.ecs.getEntitiesWithComponents(LogMessage);

    // Ordina per timestamp (piu recenti in basso)
    const sortedMessages = logMessages
      .map(entity => this.ecs.getComponent(entity, LogMessage))
      .filter(msg => msg !== null)
      .sort((a, b) => a!.timestamp - b!.timestamp);

    // Mostra solo gli ultimi maxMessages
    const visibleMessages = sortedMessages.slice(-this.maxMessages);

    // Renderizza ogni messaggio
    let currentY = this.topMargin;
    visibleMessages.forEach((message) => {
      const lineCount = message!.text.split('\n').length;
      this.renderLogMessage(ctx, message!, currentY);
      const messageHeight = lineCount * 22 + this.messageSpacing; // Ridotto a 22px
      currentY += messageHeight;
    });
  }

  /**
   * Renderizza un singolo messaggio di log
   */
  private renderLogMessage(ctx: CanvasRenderingContext2D, message: LogMessage, startY: number): void {
    const { width: canvasWidth } = DisplayManager.getInstance().getLogicalSize();
    const alpha = message.getAlpha();

    // Salva contesto per applicare alpha
    ctx.save();
    ctx.globalAlpha = alpha;

    // Imposta stile del testo premium (Look PALANTIR: 200 weight, 4px spacing)
    ctx.font = '200 15px "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '4px'; // Ridotto per risparmiare spazio (da 6.8px)

    // Aggiungi leggera ombra per leggibilita
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    // Splitta il messaggio su nuove righe e renderizza ogni riga
    const lines = message.text.split('\n');
    const lineHeight = 22; // Altezza di ogni riga ridotta (da 25px)

    lines.forEach((line, lineIndex) => {
      const lineY = startY + (lineIndex * lineHeight);

      // La prima riga usa il colore del tipo, le altre sono bianche (per rewards/info)
      ctx.fillStyle = lineIndex === 0 ? message.getTextColor() : '#ffffff';

      ctx.fillText(line, canvasWidth / 2, lineY);
    });

    // Ripristina contesto
    ctx.restore();
  }


  /**
   * Aggiunge un nuovo messaggio di log
   */
  addLogMessage(
    text: string,
    type: LogType = LogType.INFO,
    duration: number = 3000,
    categoryOverride?: LogCategory | null
  ): void {
    const normalizedText = typeof text === 'string' ? text.replace(/\r\n/g, '\n').trim() : '';

    // Evita messaggi vuoti o solo spazi
    if (!normalizedText) {
      return;
    }

    const historyEntry = this.addHistoryEntry(normalizedText, type, duration, categoryOverride);
    this.emitLogEntryAdded(historyEntry);

    // Mantiene compatibilita con eventuale rendering legacy su canvas.
    if (this.canvasOverlayEnabled) {
      const logEntity = this.ecs.createEntity();
      const logMessage = new LogMessage(normalizedText, type, duration);
      this.ecs.addComponent(logEntity, LogMessage, logMessage);
    }
  }

  /**
   * Log specifico per messaggio di benvenuto
   */
  logWelcome(playerName: string): void {
    this.addLogMessage(`Welcome back ${playerName}!`, LogType.WELCOME, 5000);
  }

  /**
   * Log specifico per inizio attacco (disabilitato su richiesta utente)
   */
  logAttackStart(targetName: string): void {
    // Hidden by default
  }

  /**
   * Log specifico per fine attacco (disabilitato su richiesta utente)
   */
  logAttackEnd(targetName: string): void {
    // Hidden by default
  }

  /**
   * Log specifico per attacco fallito
   */
  logAttackFailed(targetName: string): void {
    this.addLogMessage(`Attack failed against ${targetName}`, LogType.ATTACK_FAILED, 2000);
  }


  /**
   * Log specifico per NPC ucciso
   */
  logNpcKilled(npcName: string): void {
    this.addLogMessage(`${npcName} defeated!`, LogType.NPC_KILLED, 4000);
  }

  /**
   * Log unificato per NPC sconfitto con ricompense
   */
  logNpcDefeatWithRewards(npcName: string, credits: number, cosmos: number, experience: number, honor: number, duration: number = 4000): void {
    const rewards: string[] = [];
    const f = (n: number) => NumberFormatter.format(n);

    if (credits > 0) rewards.push(`${f(credits)} Credits`);
    if (cosmos > 0) rewards.push(`${f(cosmos)} Cosmos`);
    if (experience > 0) rewards.push(`${f(experience)} Experience`);
    if (honor > 0) rewards.push(`${f(honor)} Honor`);

    const title = `${npcName.toUpperCase()} DEFEATED!`;
    const text = rewards.length > 0 ? `${title}\nRewards: ${rewards.join(', ')}` : title;

    this.addLogMessage(text, LogType.NPC_KILLED, duration);
  }

  /**
   * Log specifico per ricompense
   */
  logReward(credits: number, cosmos: number, experience: number, honor: number, duration: number = 4000): void {
    const rewards: string[] = [];
    const f = (n: number) => NumberFormatter.format(n);

    if (credits > 0) rewards.push(`${f(credits)} Credits`);
    if (cosmos > 0) rewards.push(`${f(cosmos)} Cosmos`);
    if (experience > 0) rewards.push(`${f(experience)} Experience`);
    if (honor > 0) rewards.push(`${f(honor)} Honor`);

    // Mostra messaggio solo se ci sono ricompense
    if (rewards.length > 0) {
      const rewardText = `Rewards: ${rewards.join(', ')}`;
      this.addLogMessage(rewardText, LogType.REWARD, duration);
    }
  }

  /**
   * Log specifico per messaggi relativi alle missioni
   */
  logMission(text: string, duration: number = 5000): void {
    this.addLogMessage(text, LogType.MISSION, duration);
  }

  /**
   * Log specifico per progresso missione
   */
  logMissionProgress(missionTitle: string, current: number, target: number): void {
    const f = (n: number) => NumberFormatter.format(n);
    this.addLogMessage(`Progress [${missionTitle}]: ${f(current)}/${f(target)}`, LogType.MISSION, 3000);
  }

  /**
   * Log specifico per completamento missione (Titolo + Ricompense)
   */
  logMissionCompletion(title: string, rewards: string, duration: number = 6000): void {
    const text = rewards ? `MISSION COMPLETED: ${title}\n${rewards}` : `MISSION COMPLETED: ${title}`;
    this.addLogMessage(text, LogType.MISSION, duration);
  }

  private addHistoryEntry(
    text: string,
    type: LogType,
    duration: number,
    categoryOverride?: LogCategory | null
  ): LogHistoryEntry {
    const entry: LogHistoryEntry = {
      id: this.nextEntryId++,
      text,
      type,
      category: categoryOverride !== undefined
        ? categoryOverride
        : this.resolveLogCategory(text, type),
      timestamp: Date.now(),
      duration
    };

    this.historyEntries.push(entry);
    this.trimHistoryEntries();
    return entry;
  }

  private trimHistoryEntries(): void {
    if (this.historyEntries.length <= this.maxHistoryEntries) return;
    const overflow = this.historyEntries.length - this.maxHistoryEntries;
    this.historyEntries.splice(0, overflow);
  }

  private clearTransientCanvasMessages(): void {
    const logMessages = this.ecs.getEntitiesWithComponents(LogMessage);
    for (const entity of logMessages) {
      this.ecs.removeEntity(entity);
    }
  }

  private emitLogEntryAdded(entry: LogHistoryEntry): void {
    if (typeof document === 'undefined') return;
    const payload: LogHistoryEntry = { ...entry };
    document.dispatchEvent(new CustomEvent<{ entry: LogHistoryEntry }>(LOG_EVENT_ENTRY_ADDED, {
      detail: { entry: payload }
    }));
  }

  private emitHistoryCleared(): void {
    if (typeof document === 'undefined') return;
    document.dispatchEvent(new CustomEvent(LOG_EVENT_HISTORY_CLEARED));
  }

  private resolveLogCategory(text: string, type: LogType): LogCategory | null {
    if (text.startsWith('Welcome back ')) {
      return null;
    }

    if (text === 'Combat disabled in Safe Zone!') {
      return 'safezone';
    }

    if (text === 'Select a target first!') {
      return 'combat';
    }

    if (text.startsWith('Target out of range!')) {
      return 'combat';
    }

    if (text.startsWith('Attack failed against ')) {
      return 'combat';
    }

    if (/^[^\n]+ defeated!$/i.test(text)) {
      return 'combat';
    }

    if (text.includes('DEFEATED!') && text.includes('\nRewards: ')) {
      return 'rewards';
    }

    if (text.startsWith('Rewards: ')) {
      return 'rewards';
    }

    if (text.startsWith('MISSION COMPLETED: ')) {
      return 'missions';
    }

    if (text.startsWith('Progress [')) {
      return 'missions';
    }

    if (text.startsWith('System: ')) {
      return 'error';
    }

    if (text.startsWith('DROPPED: ')) {
      return 'item';
    }

    if (text.startsWith('Collection of ') && text.endsWith(' started')) {
      return 'resources';
    }

    if (text.startsWith('Collection of ') && text.includes(' interrupted')) {
      return 'resources';
    }

    if (text.endsWith(' collected')) {
      return 'resources';
    }

    return this.resolveCategoryFromLogType(type);
  }

  private resolveCategoryFromLogType(type: LogType): LogCategory | null {
    switch (type) {
      case LogType.MISSION:
        return 'missions';
      case LogType.REWARD:
        return 'rewards';
      case LogType.RARITY_COMMON:
      case LogType.RARITY_UNCOMMON:
      case LogType.RARITY_RARE:
      case LogType.RARITY_EPIC:
      case LogType.GIFT:
        return 'item';
      case LogType.ATTACK_FAILED:
      case LogType.ATTACK_START:
      case LogType.ATTACK_END:
      case LogType.NPC_KILLED:
        return 'combat';
      case LogType.WELCOME:
      case LogType.INFO:
      default:
        return null;
    }
  }
}
