import { Component } from '../../infrastructure/ecs/Component';

/**
 * Testi dei messaggi di chat che seguono le entità
 */
export class ChatText extends Component {
  public message: string;
  public targetEntityId: number; // ID dell'entità da seguire (0 se entità morta)
  public initialOffsetX: number; // Offset orizzontale iniziale dal centro dell'entità
  public initialOffsetY: number; // Offset verticale iniziale dal centro dell'entità
  public currentOffsetY: number; // Offset verticale corrente (si muove verso l'alto)
  public lifetime: number;
  public maxLifetime: number;
  public lastWorldX: number;
  public lastWorldY: number;

  constructor(message: string, targetEntityId: number, offsetX: number = 0, offsetY: number = -50, lifetime: number = 2500) {
    super();

    // Validazione input
    if (!message || typeof message !== 'string') {
      throw new Error(`Invalid chat message: ${message}`);
    }
    if (!Number.isFinite(targetEntityId) || targetEntityId < 0) {
      throw new Error(`Invalid target entity ID: ${targetEntityId}`);
    }
    if (!Number.isFinite(lifetime) || lifetime <= 0) {
      lifetime = 2500; // Default fallback
    }

    this.message = message;
    this.targetEntityId = targetEntityId;
    this.initialOffsetX = Number.isFinite(offsetX) ? offsetX : 0;
    this.initialOffsetY = Number.isFinite(offsetY) ? offsetY : -50;
    this.currentOffsetY = this.initialOffsetY; // Inizia dalla posizione iniziale
    this.lifetime = lifetime;
    this.maxLifetime = lifetime;
    this.lastWorldX = 0;
    this.lastWorldY = 0;
  }

  getAlpha(): number {
    // Sempre completamente visibile fino alla scadenza
    return 1.0;
  }

  /**
   * Verifica se il testo è scaduto
   */
  isExpired(): boolean {
    return this.lifetime <= 0;
  }
}
