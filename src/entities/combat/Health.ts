import { ResourceComponent } from './ResourceComponent';

/**
 * Componente Health - gestisce la salute di un'entità
 * Include salute corrente, massima e logica di morte
 */
export class Health extends ResourceComponent {
  public isInvulnerable: boolean = false;

  constructor(current: number, max: number) {
    super(current, max);
  }

  /**
   * Verifica se l'entità è morta
   */
  isDead(): boolean {
    return this.isEmpty();
  }

  /**
   * Ottiene la percentuale di salute rimanente (0-1)
   * Alias per compatibilità
   */
  getHealthPercentage(): number {
    return this.getPercentage();
  }

  /**
   * Imposta nuovi valori di salute
   * Alias per compatibilità
   */
  setHealth(current: number, max?: number): void {
    this.setResource(current, max);
  }

  /**
   * Proprietà per accesso diretto (per compatibilità)
   * N.B. Rimosso override accessors che andavano in conflitto con la classe base.
   * ResourceComponent ha già public current e max o metodi appropriati.
   */
}
