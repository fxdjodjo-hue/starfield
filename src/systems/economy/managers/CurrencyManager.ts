import { ECS } from '../../../infrastructure/ecs/ECS';
import { Credits, Cosmos } from '../../../entities/currency/Currency';

/**
 * Manages Credits and Cosmos currency operations
 */
export class CurrencyManager {
  constructor(
    private readonly ecs: ECS,
    private readonly getPlayerEntity: () => any,
    private readonly onCreditsChanged?: (newAmount: number, change: number) => void,
    private readonly onCosmosChanged?: (newAmount: number, change: number) => void
  ) {}

  /**
   * Gets player Credits component
   */
  getPlayerCredits(): Credits | null {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return null;
    return this.ecs.getComponent(playerEntity, Credits) || null;
  }

  /**
   * Gets player Cosmos component
   */
  getPlayerCosmos(): Cosmos | null {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return null;
    return this.ecs.getComponent(playerEntity, Cosmos) || null;
  }

  // ===== CREDITS METHODS =====

  /**
   * Aggiunge Credits al giocatore
   */
  addCredits(amount: number, reason: string = 'unknown'): number {
    const credits = this.getPlayerCredits();
    if (!credits) return 0;

    const oldAmount = credits.credits;
    const added = credits.addCredits(amount);

    // ✅ FIX: Non chiamare callback se il cambiamento viene dal server per evitare loop infinito
    if (added > 0 && reason !== 'server_update') {
      this.onCreditsChanged?.(credits.credits, added);
    }

    return added;
  }

  /**
   * Rimuove Credits dal giocatore
   */
  removeCredits(amount: number, reason: string = 'unknown'): number {
    const credits = this.getPlayerCredits();
    if (!credits) return 0;

    const oldAmount = credits.credits;
    const removed = credits.removeCredits(amount);

    if (removed > 0) {
      this.onCreditsChanged?.(credits.credits, -removed);
    }

    return removed;
  }

  /**
   * Controlla se il giocatore può permettersi un acquisto in Credits
   */
  canAffordCredits(cost: number): boolean {
    const credits = this.getPlayerCredits();
    return credits ? credits.canAfford(cost) : false;
  }

  /**
   * IMPOSTA direttamente i Credits del giocatore (Server Authoritative)
   */
  setCredits(amount: number, reason: string = 'server_update'): void {
    const credits = this.getPlayerCredits();
    if (!credits) return;

    const oldAmount = credits.credits;
    const targetAmount = Math.max(0, amount);

    if (targetAmount > oldAmount) {
      // Aggiungi la differenza
      credits.addCredits(targetAmount - oldAmount);
    } else if (targetAmount < oldAmount) {
      // Rimuovi la differenza
      credits.removeCredits(oldAmount - targetAmount);
    }
    // Se sono uguali, non fare nulla

    const change = credits.credits - oldAmount;

    // ✅ Chiama sempre il callback per aggiornare l'UI, anche per aggiornamenti dal server
    this.onCreditsChanged?.(credits.credits, change);
  }

  // ===== COSMOS METHODS =====

  /**
   * Aggiunge Cosmos al giocatore
   */
  addCosmos(amount: number, reason: string = 'unknown'): number {
    const cosmos = this.getPlayerCosmos();
    if (!cosmos) return 0;

    const oldAmount = cosmos.cosmos;
    const added = cosmos.addCosmos(amount);

    // ✅ FIX: Non chiamare callback se il cambiamento viene dal server per evitare loop infinito
    if (added > 0 && reason !== 'server_update') {
      this.onCosmosChanged?.(cosmos.cosmos, added);
    }

    return added;
  }

  /**
   * Rimuove Cosmos dal giocatore
   */
  removeCosmos(amount: number, reason: string = 'unknown'): number {
    const cosmos = this.getPlayerCosmos();
    if (!cosmos) return 0;

    const oldAmount = cosmos.cosmos;
    const removed = cosmos.removeCosmos(amount);

    if (removed > 0) {
      this.onCosmosChanged?.(cosmos.cosmos, -removed);
    }

    return removed;
  }

  /**
   * Controlla se il giocatore può permettersi un acquisto in Cosmos
   */
  canAffordCosmos(cost: number): boolean {
    const cosmos = this.getPlayerCosmos();
    return cosmos ? cosmos.canAfford(cost) : false;
  }

  /**
   * IMPOSTA direttamente i Cosmos del giocatore (Server Authoritative)
   */
  setCosmos(amount: number, reason: string = 'server_update'): void {
    const cosmos = this.getPlayerCosmos();
    if (!cosmos) return;

    const oldAmount = cosmos.cosmos;
    const targetAmount = Math.max(0, amount);

    if (targetAmount > oldAmount) {
      cosmos.addCosmos(targetAmount - oldAmount);
    } else if (targetAmount < oldAmount) {
      cosmos.removeCosmos(oldAmount - targetAmount);
    }

    const change = cosmos.cosmos - oldAmount;

    // ✅ Chiama sempre il callback per aggiornare l'UI, anche per aggiornamenti dal server
    this.onCosmosChanged?.(cosmos.cosmos, change);
  }
}
