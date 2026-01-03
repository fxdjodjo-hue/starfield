import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente Damage - gestisce le capacità di attacco di un'entità
 * Include danno base, velocità di attacco e logica di combattimento
 */
export class Damage extends Component {
  public damage: number;
  public attackRange: number;
  public attackCooldown: number;
  private lastAttackTime: number = 0;

  constructor(
    damage: number,
    attackRange: number,
    attackCooldown: number // millisecondi tra attacchi
  ) {
    super();
    this.damage = damage;
    this.attackRange = attackRange;
    this.attackCooldown = attackCooldown;
  }

  /**
   * Verifica se l'entità può attaccare in questo momento
   */
  canAttack(currentTime: number): boolean {
    return (currentTime - this.lastAttackTime) >= this.attackCooldown;
  }

  /**
   * Registra un attacco (aggiorna il timestamp dell'ultimo attacco)
   */
  performAttack(currentTime: number): void {
    this.lastAttackTime = currentTime;
  }

  /**
   * Ottiene il tempo rimanente prima del prossimo attacco possibile
   */
  getCooldownRemaining(currentTime: number): number {
    const timeSinceLastAttack = currentTime - this.lastAttackTime;
    return Math.max(0, this.attackCooldown - timeSinceLastAttack);
  }

  /**
   * Verifica se un'entità è nel range di attacco
   */
  isInRange(attackerX: number, attackerY: number, targetX: number, targetY: number): boolean {
    const distance = Math.sqrt(
      Math.pow(attackerX - targetX, 2) + Math.pow(attackerY - targetY, 2)
    );
    return distance <= this.attackRange;
  }

  /**
   * Imposta nuovi valori di danno
   */
  setDamageStats(damage: number, attackRange: number, attackCooldown: number): void {
    this.damage = damage;
    this.attackRange = attackRange;
    this.attackCooldown = attackCooldown;
  }
}
