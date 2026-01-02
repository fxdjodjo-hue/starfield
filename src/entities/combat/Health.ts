import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente Health - gestisce la salute di un'entità
 * Include salute corrente, massima e logica di morte
 */
export class Health extends Component {
  public current: number;
  public max: number;

  constructor(
    current: number,
    max: number
  ) {
    super();
    this.current = current;
    this.max = max;
    // Assicuriamoci che la salute corrente non superi il massimo
    this.current = Math.min(current, max);
  }

  /**
   * Riduce la salute dell'entità
   */
  takeDamage(amount: number): void {
    this.current = Math.max(0, this.current - amount);
  }

  /**
   * Aumenta la salute dell'entità
   */
  heal(amount: number): void {
    this.current = Math.min(this.max, this.current + amount);
  }

  /**
   * Imposta la salute al valore massimo
   */
  restoreFull(): void {
    this.current = this.max;
  }

  /**
   * Verifica se l'entità è morta
   */
  isDead(): boolean {
    return this.current <= 0;
  }

  /**
   * Ottiene la percentuale di salute rimanente (0-1)
   */
  getHealthPercentage(): number {
    return this.current / this.max;
  }

  /**
   * Imposta nuovi valori di salute
   */
  setHealth(current: number, max?: number): void {
    if (max !== undefined) {
      this.max = max;
    }
    this.current = Math.max(0, Math.min(current, this.max));
  }
}
