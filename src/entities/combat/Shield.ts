import { ResourceComponent } from './ResourceComponent';

/**
 * Componente Shield - gestisce lo scudo di un'entità
 * Gli shield assorbono danni prima che colpiscano la salute
 */
export class Shield extends ResourceComponent {
  constructor(current: number, max: number) {
    super(current, max);
  }

  /**
   * Ricarica lo scudo dell'entità (override per logica specifica)
   */
  recharge(amount: number): void {
    this.heal(amount);
  }

  /**
   * Verifica se lo scudo è attivo
   */
  isActive(): boolean {
    return !this.isEmpty();
  }

  /**
   * Ottiene la percentuale di scudo rimanente (0-1)
   * Alias per compatibilità
   */
  getShieldPercentage(): number {
    return this.getPercentage();
  }

  /**
   * Imposta nuovi valori di scudo
   * Alias per compatibilità
   */
  setShield(current: number, max?: number): void {
    this.setResource(current, max);
  }
}
