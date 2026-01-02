import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Testi di danno che seguono le entità colpite
 */
export class DamageText extends Component {
  public value: number;
  public targetEntityId: number; // ID dell'entità da seguire (0 se entità morta)
  public initialOffsetX: number; // Offset orizzontale iniziale dal centro dell'entità
  public initialOffsetY: number; // Offset verticale iniziale dal centro dell'entità
  public currentOffsetY: number; // Offset verticale corrente (si muove verso l'alto)
  public lifetime: number;
  public maxLifetime: number;
  public color: string;
  public lastKnownWorldX: number; // Ultima posizione X conosciuta (per testi orfani)
  public lastKnownWorldY: number; // Ultima posizione Y conosciuta (per testi orfani)
  public entityBaseX: number; // Posizione X base dell'entità al momento della morte
  public entityBaseY: number; // Posizione Y base dell'entità al momento della morte

  constructor(value: number, targetEntityId: number, offsetX: number = 0, offsetY: number = -30, color: string = '#ffffff', lifetime: number = 1000) {
    super();

    // Validazione input
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid damage value: ${value}`);
    }
    if (!Number.isFinite(targetEntityId) || targetEntityId < 0) {
      throw new Error(`Invalid target entity ID: ${targetEntityId}`);
    }
    if (!Number.isFinite(lifetime) || lifetime <= 0) {
      lifetime = 1000; // Default fallback
    }

    this.value = Math.floor(value); // Assicuriamoci che sia intero
    this.targetEntityId = targetEntityId;
    this.initialOffsetX = Number.isFinite(offsetX) ? offsetX : 0;
    this.initialOffsetY = Number.isFinite(offsetY) ? offsetY : -30;
    this.currentOffsetY = this.initialOffsetY; // Inizia dalla posizione iniziale
    this.lifetime = lifetime;
    this.maxLifetime = lifetime;
    this.color = color || '#ffffff';
    this.lastKnownWorldX = 0;
    this.lastKnownWorldY = 0;
    this.entityBaseX = 0;
    this.entityBaseY = 0;
  }

  getAlpha(): number {
    const progress = this.lifetime / this.maxLifetime;
    return progress < 0.25 ? progress / 0.25 : 1.0;
  }

  /**
   * Verifica se il testo è scaduto
   */
  isExpired(): boolean {
    return this.lifetime <= 0;
  }
}
