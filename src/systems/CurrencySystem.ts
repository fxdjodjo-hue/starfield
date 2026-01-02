import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { Currency } from '/src/entities/Currency';

/**
 * Sistema Currency - gestisce la valuta Cosmos del giocatore
 * Fornisce metodi sicuri per transazioni e aggiornamenti UI
 */
export class CurrencySystem extends BaseSystem {
  private playerEntity: any = null;
  private currencyDisplayElement: HTMLElement | null = null;
  private onCurrencyChanged?: (newAmount: number, change: number) => void;

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Imposta l'entità player per il sistema valuta
   */
  setPlayerEntity(entity: any): void {
    this.playerEntity = entity;
  }

  /**
   * Imposta il callback per quando la valuta cambia
   */
  setCurrencyChangedCallback(callback: (newAmount: number, change: number) => void): void {
    this.onCurrencyChanged = callback;
  }

  /**
   * Crea l'elemento UI per mostrare i Cosmos
   */
  createCurrencyDisplay(): void {
    // Rimuovi elemento esistente se presente
    this.removeCurrencyDisplay();

    this.currencyDisplayElement = document.createElement('div');
    this.currencyDisplayElement.id = 'currency-display';
    this.currencyDisplayElement.style.cssText = `
      position: fixed;
      top: 60px;
      left: 20px;
      background: rgba(0, 10, 30, 0.9);
      color: #00ff88;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #00ff88;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: bold;
      z-index: 100;
      display: none;
    `;

    // Icona Cosmos (usiamo un simbolo semplice)
    const iconSpan = document.createElement('span');
    iconSpan.textContent = '⚫';
    iconSpan.style.marginRight = '8px';

    const textSpan = document.createElement('span');
    textSpan.id = 'currency-amount';
    textSpan.textContent = '0';

    this.currencyDisplayElement.appendChild(iconSpan);
    this.currencyDisplayElement.appendChild(textSpan);
    document.body.appendChild(this.currencyDisplayElement);
  }

  /**
   * Rimuove l'elemento UI della valuta
   */
  removeCurrencyDisplay(): void {
    if (this.currencyDisplayElement && document.body.contains(this.currencyDisplayElement)) {
      document.body.removeChild(this.currencyDisplayElement);
      this.currencyDisplayElement = null;
    }
  }

  /**
   * Mostra l'UI della valuta
   */
  showCurrencyDisplay(): void {
    if (this.currencyDisplayElement) {
      this.currencyDisplayElement.style.display = 'flex';
      this.currencyDisplayElement.style.alignItems = 'center';
    }
  }

  /**
   * Nasconde l'UI della valuta
   */
  hideCurrencyDisplay(): void {
    if (this.currencyDisplayElement) {
      this.currencyDisplayElement.style.display = 'none';
    }
  }

  /**
   * Aggiorna l'UI con la quantità attuale di Cosmos
   */
  updateCurrencyDisplay(): void {
    if (!this.currencyDisplayElement) return;

    const currency = this.getPlayerCurrency();
    if (currency) {
      const amountElement = this.currencyDisplayElement.querySelector('#currency-amount');
      if (amountElement) {
        amountElement.textContent = currency.formatForDisplay();
      }
    }
  }

  /**
   * Ottiene il componente Currency del giocatore
   */
  getPlayerCurrency(): Currency | null {
    if (!this.playerEntity) return null;
    return this.ecs.getComponent(this.playerEntity, Currency);
  }

  /**
   * Aggiunge Cosmos al giocatore
   */
  addCosmos(amount: number, reason: string = 'unknown'): number {
    const currency = this.getPlayerCurrency();
    if (!currency) return 0;

    const oldAmount = currency.cosmos;
    const added = currency.addCosmos(amount);

    if (added > 0) {
      console.log(`Currency: +${added} Cosmos (${reason}) - Total: ${currency.cosmos}`);
      this.updateCurrencyDisplay();
      this.onCurrencyChanged?.(currency.cosmos, added);
    }

    return added;
  }

  /**
   * Rimuove Cosmos dal giocatore
   */
  removeCosmos(amount: number, reason: string = 'unknown'): number {
    const currency = this.getPlayerCurrency();
    if (!currency) return 0;

    const oldAmount = currency.cosmos;
    const removed = currency.removeCosmos(amount);

    if (removed > 0) {
      console.log(`Currency: -${removed} Cosmos (${reason}) - Total: ${currency.cosmos}`);
      this.updateCurrencyDisplay();
      this.onCurrencyChanged?.(currency.cosmos, -removed);
    }

    return removed;
  }

  /**
   * Controlla se il giocatore può permettersi un acquisto
   */
  canAfford(cost: number): boolean {
    const currency = this.getPlayerCurrency();
    return currency ? currency.canAfford(cost) : false;
  }

  /**
   * Effettua una transazione sicura (rimuove solo se può permettersela)
   */
  transact(cost: number, reason: string = 'purchase'): boolean {
    if (this.canAfford(cost)) {
      this.removeCosmos(cost, reason);
      return true;
    }
    return false;
  }

  /**
   * Imposta direttamente la quantità di Cosmos (per debug o caricamento)
   */
  setCosmos(amount: number): void {
    const currency = this.getPlayerCurrency();
    if (currency) {
      currency.setCosmos(amount);
      this.updateCurrencyDisplay();
      this.onCurrencyChanged?.(currency.cosmos, 0);
    }
  }

  /**
   * Ottiene la quantità attuale di Cosmos
   */
  getCurrentCosmos(): number {
    const currency = this.getPlayerCurrency();
    return currency ? currency.cosmos : 0;
  }

  update(deltaTime: number): void {
    // Il sistema currency non ha aggiornamenti automatici
    // Tutto è gestito tramite chiamate esplicite
  }
}
