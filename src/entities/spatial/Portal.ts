import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente Portal - identifica un'entità come portale
 * I portali possono essere usati per cambiare mappa o teletrasportare il player
 */
export class Portal extends Component {
  public targetMapId?: string; // ID della mappa di destinazione (opzionale)
  public targetX?: number; // Posizione X di destinazione (opzionale)
  public targetY?: number; // Posizione Y di destinazione (opzionale)
  public activatedAt?: number; // Timestamp quando il portale è stato attivato (per velocizzazione animazione)

  constructor(targetMapId?: string, targetX?: number, targetY?: number) {
    super();
    this.targetMapId = targetMapId;
    this.targetX = targetX;
    this.targetY = targetY;
  }

  /**
   * Verifica se il portale è attualmente attivato (velocizzato)
   */
  isActivated(): boolean {
    if (!this.activatedAt) return false;
    const ACTIVATION_DURATION = 3000; // 3 secondi
    return (Date.now() - this.activatedAt) < ACTIVATION_DURATION;
  }

  /**
   * Attiva il portale (velocizza animazione per 3 secondi)
   */
  activate(): void {
    this.activatedAt = Date.now();
  }
}
