import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente per testi di danno fissi sopra le entità
 * Mostra numeri di danno fissi sopra le entità colpite, seguendole durante il movimento
 */
export class DamageText extends Component {
  public value: number;
  public targetEntityId: number; // ID dell'entità da seguire
  public offsetX: number; // Offset orizzontale dal centro dell'entità
  public offsetY: number; // Offset verticale dal centro dell'entità
  public lifetime: number;
  public maxLifetime: number;
  public color: string;

  constructor(value: number, targetEntityId: number, offsetX: number = 0, offsetY: number = -30, color: string = '#ffffff', lifetime: number = 2000) {
    super();
    this.value = value;
    this.targetEntityId = targetEntityId;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.lifetime = lifetime;
    this.maxLifetime = lifetime;
    this.color = color;
  }

  /**
   * Calcola l'opacità basata sul tempo rimanente
   */
  getAlpha(): number {
    const progress = this.lifetime / this.maxLifetime;
    // Fade out negli ultimi 500ms
    if (progress < 0.25) {
      return progress / 0.25;
    }
    return 1.0;
  }

  /**
   * Verifica se il testo è scaduto
   */
  isExpired(): boolean {
    return this.lifetime <= 0;
  }
}
