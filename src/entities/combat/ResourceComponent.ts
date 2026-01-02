import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Classe base astratta per componenti che gestiscono risorse (HP, Shield, Mana, ecc.)
 * Fornisce logica comune per gestione current/max, danno, guarigione, percentuali
 */
export abstract class ResourceComponent extends Component {
  protected current: number;
  protected max: number;
  protected lastDamageTime: number = 0;

  constructor(current: number, max: number) {
    super();
    this.current = current;
    this.max = max;
    // Assicuriamoci che il valore corrente non superi il massimo
    this.current = Math.min(current, max);
  }

  /**
   * Riduce la risorsa dell'entità
   */
  takeDamage(amount: number): void {
    const oldCurrent = this.current;
    this.current = Math.max(0, this.current - amount);

    // Se ha effettivamente ricevuto danno, registra il timestamp
    if (this.current < oldCurrent) {
      this.lastDamageTime = Date.now();
    }
  }

  /**
   * Aumenta la risorsa dell'entità
   */
  heal(amount: number): void {
    this.current = Math.min(this.max, this.current + amount);
  }

  /**
   * Imposta la risorsa al valore massimo
   */
  restoreFull(): void {
    this.current = this.max;
  }

  /**
   * Verifica se la risorsa è piena
   */
  isFull(): boolean {
    return this.current >= this.max;
  }

  /**
   * Verifica se la risorsa è vuota
   */
  isEmpty(): boolean {
    return this.current <= 0;
  }

  /**
   * Ottiene la percentuale di risorsa rimanente (0-1)
   */
  getPercentage(): number {
    return this.current / this.max;
  }

  /**
   * Imposta nuovi valori di risorsa
   */
  setResource(current: number, max?: number): void {
    if (max !== undefined) {
      this.max = max;
    }
    this.current = Math.max(0, Math.min(current, this.max));
  }

  /**
   * Ottiene il valore corrente
   */
  get currentValue(): number {
    return this.current;
  }

  /**
   * Ottiene il valore massimo
   */
  get maxValue(): number {
    return this.max;
  }

  /**
   * Imposta il valore corrente
   */
  set currentValue(value: number) {
    this.current = Math.max(0, Math.min(value, this.max));
  }

  /**
   * Imposta il valore massimo
   */
  set maxValue(value: number) {
    this.max = Math.max(0, value);
    this.current = Math.min(this.current, this.max);
  }

  /**
   * Ottiene il timestamp dell'ultimo danno ricevuto
   */
  getLastDamageTime(): number {
    return this.lastDamageTime;
  }

  /**
   * Verifica se l'entità è stata danneggiata recentemente
   */
  wasDamagedRecently(currentTime: number, timeWindow: number = 3000): boolean {
    return (currentTime - this.lastDamageTime) < timeWindow;
  }
}

