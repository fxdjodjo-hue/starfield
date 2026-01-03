import { Component } from '../infrastructure/ecs/Component';

/**
 * Componente PlayerUpgrades - gestisce gli upgrade delle statistiche del giocatore
 * Ogni upgrade costa 1 skill point e dà +1% alla statistica corrispondente
 */
export class PlayerUpgrades extends Component {
  private _hpUpgrades: number = 0;
  private _shieldUpgrades: number = 0;
  private _speedUpgrades: number = 0;

  constructor(hpUpgrades: number = 0, shieldUpgrades: number = 0, speedUpgrades: number = 0) {
    super();
    this._hpUpgrades = hpUpgrades;
    this._shieldUpgrades = shieldUpgrades;
    this._speedUpgrades = speedUpgrades;
  }

  // Getters
  get hpUpgrades(): number {
    return this._hpUpgrades;
  }

  get shieldUpgrades(): number {
    return this._shieldUpgrades;
  }

  get speedUpgrades(): number {
    return this._speedUpgrades;
  }

  get totalUpgrades(): number {
    return this._hpUpgrades + this._shieldUpgrades + this._speedUpgrades;
  }

  // Methods
  /**
   * Acquista un upgrade HP (+1% HP)
   */
  upgradeHP(): boolean {
    this._hpUpgrades++;
    return true;
  }

  /**
   * Acquista un upgrade Shield (+1% Shield)
   */
  upgradeShield(): boolean {
    this._shieldUpgrades++;
    return true;
  }

  /**
   * Acquista un upgrade Speed (+1% Speed)
   */
  upgradeSpeed(): boolean {
    this._speedUpgrades++;
    return true;
  }

  /**
   * Calcola il bonus moltiplicatore per HP (1.0 + upgrades * 0.01)
   */
  getHPBonus(): number {
    return 1.0 + (this._hpUpgrades * 0.01);
  }

  /**
   * Calcola il bonus moltiplicatore per Shield (1.0 + upgrades * 0.01)
   */
  getShieldBonus(): number {
    return 1.0 + (this._shieldUpgrades * 0.01);
  }

  /**
   * Calcola il bonus moltiplicatore per Speed (1.0 + upgrades * 0.01)
   */
  getSpeedBonus(): number {
    return 1.0 + (this._speedUpgrades * 0.01);
  }

  /**
   * Resetta tutti gli upgrade (per debug o reset)
   */
  reset(): void {
    this._hpUpgrades = 0;
    this._shieldUpgrades = 0;
    this._speedUpgrades = 0;
  }

  /**
   * Imposta direttamente il numero di upgrade per ogni statistica
   */
  setUpgrades(hp: number, shield: number, speed: number): void {
    this._hpUpgrades = Math.max(0, hp);
    this._shieldUpgrades = Math.max(0, shield);
    this._speedUpgrades = Math.max(0, speed);
  }
}
