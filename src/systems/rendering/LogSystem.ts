import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { LogMessage, LogType } from '../../presentation/ui/LogMessage';
import { NumberFormatter } from '../../core/utils/ui/NumberFormatter';
import { DisplayManager } from '../../infrastructure/display';

/**
 * Sistema per gestire e renderizzare i messaggi di log centrati in alto
 * Mostra informazioni importanti del gameplay con animazioni e styling
 */
export class LogSystem extends BaseSystem {
  private maxMessages: number = 3; // Numero massimo di messaggi visibili contemporaneamente
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

    // Usa la posizione Y fornita come punto di partenza per le righe

    // Salva contesto per applicare alpha
    ctx.save();
    ctx.globalAlpha = alpha;

    // Imposta stile del testo premium (Look PALANTIR: 200 weight, 4px spacing)
    ctx.font = '200 15px \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '4px'; // Ridotto per risparmiare spazio (da 6.8px)

    // Aggiungi leggera ombra per leggibilità
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
}
