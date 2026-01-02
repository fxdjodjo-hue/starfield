import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente DamageTaken - traccia quando un'entità è stata danneggiata l'ultima volta
 * Utile per comportamenti AI reattivi (es. NPC che inseguono quando attaccati)
 */
export class DamageTaken extends Component {
  public lastDamageTime: number;

  constructor() {
    super();
    this.lastDamageTime = 0;
  }

  /**
   * Registra che l'entità è stata danneggiata
   */
  takeDamage(currentTime: number): void {
    this.lastDamageTime = currentTime;
  }

  /**
   * Verifica se l'entità è stata danneggiata recentemente
   */
  wasDamagedRecently(currentTime: number, timeWindowMs: number = 5000): boolean {
    return (currentTime - this.lastDamageTime) < timeWindowMs;
  }

  /**
   * Tempo trascorso dall'ultimo danno
   */
  getTimeSinceLastDamage(currentTime: number): number {
    return currentTime - this.lastDamageTime;
  }
}
