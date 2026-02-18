import { Component } from '../../infrastructure/ecs/Component';
import { InputValidator } from '../../core/utils/InputValidator';

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
  public projectileType?: 'laser' | 'pet_laser' | 'npc_laser' | 'missile' | 'lb1' | 'lb2' | 'lb3' | 'm1' | 'm2' | 'm3';
  public lastWorldX: number;
  public lastWorldY: number;

  constructor(value: number, targetEntityId: number, offsetX: number = 0, offsetY: number = -30, color: string = '#ffffff', lifetime: number = 1000, projectileType?: 'laser' | 'pet_laser' | 'npc_laser' | 'missile' | 'lb1' | 'lb2' | 'lb3' | 'm1' | 'm2' | 'm3', initialWorldX: number = 0, initialWorldY: number = 0) {
    super();

    // Validazione input
    const valueValidation = InputValidator.validateStat(value, 'damage', 1000000);
    if (!valueValidation.isValid) {
      throw new Error(`Invalid damage value: ${valueValidation.error}`);
    }

    const entityIdValidation = InputValidator.validateNumber(targetEntityId, 'targetEntityId');
    if (!entityIdValidation.isValid || (targetEntityId < 0 && targetEntityId !== -1)) {
      throw new Error(`Invalid target entity ID: ${targetEntityId}`);
    }

    const lifetimeValidation = InputValidator.validateNumber(lifetime, 'lifetime');
    if (!lifetimeValidation.isValid || lifetime <= 0) {
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
    this.projectileType = projectileType;
    this.lastWorldX = initialWorldX;
    this.lastWorldY = initialWorldY;
  }

  getAlpha(): number {
    const progress = Math.max(0, this.lifetime / this.maxLifetime); // Clamp to 0 to avoid negative values
    return progress < 0.25 ? progress / 0.25 : 1.0;
  }

  /**
   * Verifica se il testo è scaduto
   */
  isExpired(): boolean {
    return this.lifetime <= 0;
  }
}
