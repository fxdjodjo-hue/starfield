import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { LogMessage, LogType } from '../../presentation/ui/LogMessage';
import { DisplayManager } from '../../infrastructure/display';

/**
 * Sistema per gestire e renderizzare i messaggi di log centrati in alto
 * Mostra informazioni importanti del gameplay con animazioni e styling
 */
export class LogSystem extends BaseSystem {
  private maxMessages: number = 5; // Numero massimo di messaggi visibili contemporaneamente
  private messageSpacing: number = 8; // Spazio tra i messaggi
  private topMargin: number = 50; // Margine dall'alto dello schermo

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Aggiorna i messaggi di log (lifetime e rimozione scaduti)
   */
  update(deltaTime: number): void {
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
   * Renderizza i messaggi di log centrati in alto
   */
  render(ctx: CanvasRenderingContext2D): void {
    const logMessages = this.ecs.getEntitiesWithComponents(LogMessage);

    // Ordina per timestamp (più recenti in basso)
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
      const messageHeight = lineCount * 20 + this.messageSpacing; // 20px per riga + spacing
      currentY += messageHeight;
    });
  }

  /**
   * Renderizza un singolo messaggio di log
   */
  private renderLogMessage(ctx: CanvasRenderingContext2D, message: LogMessage, startY: number): void {
    const { width: canvasWidth } = DisplayManager.getInstance().getLogicalSize();
    const alpha = message.getAlpha();

    // Usa la posizione Y fornita come punto di partenza per le righe

    // Salva contesto per applicare alpha
    ctx.save();
    ctx.globalAlpha = alpha;

    // Imposta stile del testo semplice
    ctx.fillStyle = message.getTextColor();
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Aggiungi leggera ombra per leggibilità
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    // Splitta il messaggio su nuove righe e renderizza ogni riga
    const lines = message.text.split('\n');
    const lineHeight = 20; // Altezza di ogni riga

    lines.forEach((line, lineIndex) => {
      const y = startY + (lineIndex * lineHeight);
      ctx.fillText(line, canvasWidth / 2, y);
    });

    // Ripristina contesto
    ctx.restore();
  }


  /**
   * Aggiunge un nuovo messaggio di log
   */
  addLogMessage(text: string, type: LogType = LogType.INFO, duration: number = 3000): void {
    // Evita messaggi vuoti o solo spazi
    if (!text || text.trim().length === 0) {
      return;
    }

    const logEntity = this.ecs.createEntity();
    const logMessage = new LogMessage(text, type, duration);
    this.ecs.addComponent(logEntity, LogMessage, logMessage);
  }

  /**
   * Log specifico per messaggio di benvenuto
   */
  logWelcome(playerName: string): void {
    this.addLogMessage(`Welcome back ${playerName}!`, LogType.WELCOME, 5000);
  }

  /**
   * Log specifico per inizio attacco
   */
  logAttackStart(targetName: string): void {
    this.addLogMessage(`Attack started against ${targetName}`, LogType.ATTACK_START, 2000);
  }

  /**
   * Log specifico per fine attacco
   */
  logAttackEnd(targetName: string): void {
    this.addLogMessage(`Attack ended against ${targetName}`, LogType.ATTACK_END, 2000);
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
   * Log specifico per ricompense
   */
  logReward(credits: number, cosmos: number, experience: number, honor: number, duration: number = 4000): void {
    const rewards: string[] = [];

    if (credits > 0) rewards.push(`${credits} credits`);
    if (cosmos > 0) rewards.push(`${cosmos} cosmos`);
    if (experience > 0) rewards.push(`${experience} XP`);
    if (honor > 0) rewards.push(`${honor} honor`);

    // Mostra messaggio solo se ci sono ricompense
    if (rewards.length > 0) {
      const rewardText = `Rewards: ${rewards.join(', ')}`;
      this.addLogMessage(rewardText, LogType.REWARD, duration);
    }
  }

  /**
   * Log specifico per messaggi relativi alle quest
   */
  logQuest(text: string, duration: number = 5000): void {
    this.addLogMessage(text, LogType.QUEST, duration);
  }

  /**
   * Log specifico per progresso quest
   */
  logQuestProgress(questTitle: string, current: number, target: number): void {
    this.addLogMessage(`Progress [${questTitle}]: ${current}/${target}`, LogType.QUEST, 3000);
  }
}
