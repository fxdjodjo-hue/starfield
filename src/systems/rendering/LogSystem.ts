import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { LogMessage, LogType } from '../../presentation/ui/LogMessage';
import { NumberFormatter } from '../../core/utils/ui/NumberFormatter';
import { DisplayManager } from '../../infrastructure/display';
import { PixiRenderer } from '../../infrastructure/rendering/PixiRenderer';
import { Container, Text, TextStyle } from 'pixi.js';

/**
 * LogSystem - PixiJS Version
 * Gestisce e renderizza i messaggi di log centrati in alto usando PixiJS Text
 */
export class LogSystem extends BaseSystem {
  private maxMessages: number = 3;
  private messageSpacing: number = 8;
  private topMargin: number = 50;

  // PixiJS elements
  private logContainer: Container;
  private textPool: Map<number, Container> = new Map(); // entityId -> text container
  private pixiInitialized: boolean = false;

  constructor(ecs: ECS) {
    super(ecs);
    this.logContainer = new Container();
    this.logContainer.label = 'LogMessages';
  }

  /**
   * Inizializza PixiJS container (lazy)
   */
  private initPixi(): void {
    if (this.pixiInitialized) return;

    try {
      const pixiRenderer = PixiRenderer.getInstance();
      const uiContainer = pixiRenderer.getUIContainer();
      uiContainer.addChild(this.logContainer);
      this.logContainer.zIndex = 1000; // Sempre in cima
      this.pixiInitialized = true;
    } catch (e) {
      // PixiRenderer non ancora pronto
    }
  }

  /**
   * Crea stile testo premium per i log
   */
  private createTextStyle(color: string, alpha: number): TextStyle {
    return new TextStyle({
      fontFamily: '"Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
      fontSize: 15,
      fontWeight: '200',
      fill: color,
      align: 'center',
      letterSpacing: 4,
      dropShadow: {
        color: 'rgba(0, 0, 0, 0.4)',
        blur: 4,
        distance: 1,
        angle: Math.PI / 4,
      },
    });
  }

  /**
   * Aggiorna i messaggi di log (lifetime, rimozione scaduti, e rendering PixiJS)
   */
  update(deltaTime: number): void {
    this.initPixi();
    if (!this.pixiInitialized) return;

    const { width: screenWidth } = DisplayManager.getInstance().getLogicalSize();
    const logEntities = this.ecs.getEntitiesWithComponents(LogMessage);

    // Aggiorna durata e rimuovi scaduti
    for (const entity of logEntities) {
      const logMessage = this.ecs.getComponent(entity, LogMessage);
      if (!logMessage) continue;

      logMessage.duration -= deltaTime;

      if (logMessage.isExpired()) {
        this.ecs.removeEntity(entity);
      }
    }

    // Ottieni messaggi ancora validi dopo cleanup
    const validEntities = this.ecs.getEntitiesWithComponents(LogMessage);

    // Ordina per timestamp (più recenti in basso)
    const sortedMessages = validEntities
      .map(entity => ({
        entity,
        message: this.ecs.getComponent(entity, LogMessage)!,
        entityId: typeof entity === 'number' ? entity : (entity as any).id
      }))
      .filter(item => item.message !== null)
      .sort((a, b) => a.message.timestamp - b.message.timestamp);

    // Mostra solo gli ultimi maxMessages
    const visibleMessages = sortedMessages.slice(-this.maxMessages);
    const visibleIds = new Set(visibleMessages.map(m => m.entityId));

    // Rimuovi text containers per messaggi non più visibili
    for (const [entityId, container] of this.textPool) {
      if (!visibleIds.has(entityId)) {
        container.destroy({ children: true });
        this.textPool.delete(entityId);
      }
    }

    // Renderizza messaggi visibili
    let currentY = this.topMargin;

    for (const { entity, message, entityId } of visibleMessages) {
      const alpha = message.getAlpha();
      const lines = message.text.split('\n');
      const lineHeight = 22;

      // Crea o riutilizza container per questo messaggio
      let textContainer = this.textPool.get(entityId);

      if (!textContainer) {
        textContainer = new Container();
        textContainer.label = `LogMessage_${entityId}`;
        this.logContainer.addChild(textContainer);
        this.textPool.set(entityId, textContainer);

        // Crea testi per ogni riga
        lines.forEach((line, lineIndex) => {
          const color = lineIndex === 0 ? message.getTextColor() : '#ffffff';
          const style = this.createTextStyle(color, alpha);
          const text = new Text({ text: line, style });
          text.anchor.set(0.5, 0.5);
          text.y = lineIndex * lineHeight;
          textContainer!.addChild(text);
        });
      }

      // Aggiorna posizione e alpha
      textContainer.position.set(screenWidth / 2, currentY);
      textContainer.alpha = alpha;

      // Aggiorna testi esistenti se necessario
      const children = textContainer.children as Text[];
      lines.forEach((line, lineIndex) => {
        if (children[lineIndex]) {
          children[lineIndex].text = line;
          children[lineIndex].y = lineIndex * lineHeight;
        }
      });

      currentY += lines.length * lineHeight + this.messageSpacing;
    }
  }

  /**
   * Aggiunge un nuovo messaggio di log
   */
  addLogMessage(text: string, type: LogType = LogType.INFO, duration: number = 3000): void {
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
   * Log specifico per inizio attacco (disabilitato)
   */
  logAttackStart(targetName: string): void {
    // Hidden by default
  }

  /**
   * Log specifico per fine attacco (disabilitato)
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
   * Log specifico per completamento missione
   */
  logMissionCompletion(title: string, rewards: string, duration: number = 6000): void {
    const text = rewards ? `MISSION COMPLETED: ${title}\n${rewards}` : `MISSION COMPLETED: ${title}`;
    this.addLogMessage(text, LogType.MISSION, duration);
  }

  /**
   * Cleanup risorse PixiJS
   */
  destroy(): void {
    for (const container of this.textPool.values()) {
      container.destroy({ children: true });
    }
    this.textPool.clear();
    if (this.logContainer) {
      this.logContainer.destroy({ children: true });
    }
  }
}
