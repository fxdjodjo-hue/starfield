import { Component } from '../../infrastructure/ecs/Component';

/**
 * Tipi di messaggi di log
 */
export enum LogType {
  WELCOME = 'welcome',
  ATTACK_START = 'attack_start',
  ATTACK_END = 'attack_end',
  ATTACK_FAILED = 'attack_failed',
  NPC_KILLED = 'npc_killed',
  REWARD = 'reward',
  INFO = 'info'
}

/**
 * Componente per i messaggi di log centrati in alto
 * Mostra informazioni importanti del gameplay (attacchi, ricompense, NPC uccisi)
 */
export class LogMessage extends Component {
  public text: string;
  public type: LogType;
  public timestamp: number;
  public duration: number;
  public maxDuration: number;

  constructor(text: string, type: LogType = LogType.INFO, duration: number = 3000) {
    super();
    this.text = text;
    this.type = type;
    this.timestamp = Date.now();
    this.duration = duration;
    this.maxDuration = duration;
  }

  /**
   * Verifica se il messaggio è scaduto
   */
  isExpired(): boolean {
    return this.duration <= 0;
  }

  /**
   * Calcola l'opacità basata sul tempo rimanente
   */
  getAlpha(): number {
    const progress = this.duration / this.maxDuration;
    // Fade out negli ultimi 500ms
    if (progress < 0.17) { // 500ms / 3000ms
      return progress / 0.17;
    }
    return 1.0;
  }

  /**
   * Ottiene il colore del testo basato sul tipo
   */
  getTextColor(): string {
    switch (this.type) {
      case LogType.NPC_KILLED:
      case LogType.ATTACK_END:
      case LogType.ATTACK_FAILED:
        return '#ff4444'; // Rosso per messaggi negativi
      case LogType.WELCOME:
      case LogType.ATTACK_START:
      case LogType.REWARD:
      case LogType.INFO:
      default:
        return '#ffffff'; // Bianco per tutti gli altri messaggi
    }
  }

}
