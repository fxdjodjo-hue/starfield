import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { Transform } from '/src/entities/spatial/Transform';
import { LogMessage, LogType } from '/src/entities/ui/LogMessage';

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
    const canvasWidth = ctx.canvas.width;
    const alpha = message.getAlpha();

    // Usa la posizione Y fornita come base

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
      const y = baseY + (lineIndex * lineHeight);
      ctx.fillText(line, canvasWidth / 2, y);
    });

    // Ripristina contesto
    ctx.restore();
  }


  /**
   * Aggiunge un nuovo messaggio di log
   */
  addLogMessage(text: string, type: LogType = LogType.INFO, duration: number = 3000): void {
    const logEntity = this.ecs.createEntity();
    const logMessage = new LogMessage(text, type, duration);
    this.ecs.addComponent(logEntity, LogMessage, logMessage);
  }

  /**
   * Log specifico per messaggio di benvenuto
   */
  logWelcome(playerName: string): void {
    this.addLogMessage(`Welcome back ${playerName}!`, LogType.WELCOME);
  }

  /**
   * Log specifico per inizio attacco
   */
  logAttackStart(targetName: string): void {
    this.addLogMessage(`🔥 Attacco iniziato contro ${targetName}`, LogType.ATTACK_START);
  }

  /**
   * Log specifico per fine attacco
   */
  logAttackEnd(targetName: string): void {
    this.addLogMessage(`Attacco fuori gittata contro ${targetName}`, LogType.ATTACK_END);
  }

  /**
   * Log specifico per attacco fallito
   */
  logAttackFailed(targetName: string): void {
    this.addLogMessage(`Attacco fallito contro ${targetName}`, LogType.ATTACK_FAILED);
  }


  /**
   * Log specifico per NPC ucciso
   */
  logNpcKilled(npcName: string): void {
    this.addLogMessage(`💀 ${npcName} sconfitto!`, LogType.NPC_KILLED);
  }

  /**
   * Log specifico per ricompense
   */
  logReward(credits: number, cosmos: number, experience: number, honor: number, duration: number = 3000): void {
    let rewardText = '🎁 Ricompense: ';
    const rewards: string[] = [];

    if (credits > 0) rewards.push(`${credits} crediti`);
    if (cosmos > 0) rewards.push(`${cosmos} cosmos`);
    if (experience > 0) rewards.push(`${experience} XP`);
    if (honor > 0) rewards.push(`${honor} onore`);

    if (rewards.length > 0) {
      rewardText += rewards.join(', ');
      this.addLogMessage(rewardText, LogType.REWARD, duration);
    }
  }
}
