import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente per testi di danno fissi sopra le entità
 * Mostra numeri di danno fissi sopra le entità colpite, seguendole durante il movimento
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

  constructor(value: number, targetEntityId: number, offsetX: number = 0, offsetY: number = -30, color: string = '#ffffff', lifetime: number = 2000) {
    super();

    // Validazione input
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid damage value: ${value}`);
    }
    if (!Number.isFinite(targetEntityId) || targetEntityId < 0) {
      throw new Error(`Invalid target entity ID: ${targetEntityId}`);
    }
    if (!Number.isFinite(lifetime) || lifetime <= 0) {
      lifetime = 2000; // Default fallback
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
