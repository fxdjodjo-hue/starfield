import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente PlayerStats - traccia statistiche del giocatore
 * Include kills, deaths, missioni completate, etc.
 */
export class PlayerStats extends Component {
  private _kills: number;
  private _deaths: number;
  private _missionsCompleted: number;
  private _playTime: number; // in secondi

  constructor(kills: number = 0, deaths: number = 0, missionsCompleted: number = 0, playTime: number = 0) {
    super();
    this._kills = kills;
    this._deaths = deaths;
    this._missionsCompleted = missionsCompleted;
    this._playTime = playTime;
  }

  // Getters
  get kills(): number {
    return this._kills;
  }

  get deaths(): number {
    return this._deaths;
  }

  get missionsCompleted(): number {
    return this._missionsCompleted;
  }

  get playTime(): number {
    return this._playTime;
  }

  // Methods
  addKill(): void {
    this._kills++;
  }

  addDeath(): void {
    this._deaths++;
  }

  addMissionCompleted(): void {
    this._missionsCompleted++;
  }

  addPlayTime(seconds: number): void {
    this._playTime += seconds;
  }

  getKillDeathRatio(): number {
    return this._deaths > 0 ? this._kills / this._deaths : this._kills;
  }

  /**
   * Formatta le statistiche per display
   */
  formatForDisplay(): string {
    const kdr = this.getKillDeathRatio().toFixed(2);
    return `Kills: ${this._kills} | Deaths: ${this._deaths} | K/D: ${kdr} | Missions: ${this._missionsCompleted}`;
  }
}
