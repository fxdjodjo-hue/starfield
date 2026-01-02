import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente per testi di danno fluttuanti
 * Mostra numeri di danno sopra le entità colpite
 */
export class DamageText extends Component {
  public value: number;
  public x: number;
  public y: number;
  public lifetime: number;
  public maxLifetime: number;
  public color: string;
  public velocityY: number; // Velocità di movimento verso l'alto

  constructor(value: number, x: number, y: number, color: string = '#ffffff', lifetime: number = 2000) {
    super();
    this.value = value;
    this.x = x;
    this.y = y;
    this.lifetime = lifetime;
    this.maxLifetime = lifetime;
    this.color = color || '#ffffff';
    this.velocityY = -50; // Pixel al secondo verso l'alto
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
