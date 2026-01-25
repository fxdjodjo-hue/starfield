import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente PlayerRole - gestisce i ruoli e permessi del giocatore
 * Separato da Honor per Separation of Concerns
 */
export class PlayerRole extends Component {
  private _isAdministrator: boolean = false;
  private _currentRank: string = 'Basic Space Pilot';

  constructor(isAdministrator: boolean = false) {
    super();
    this._isAdministrator = isAdministrator;
  }

  /**
   * Verifica se il giocatore è un Administrator
   */
  get isAdministrator(): boolean {
    return this._isAdministrator;
  }

  /**
   * Imposta lo status di Administrator
   */
  setAdministrator(isAdmin: boolean): void {
    this._isAdministrator = isAdmin;
  }

  /**
   * Ottiene il rank attuale calcolato dal server
   */
  get currentRank(): string {
    return this._currentRank;
  }

  /**
   * Imposta il rank attuale
   */
  setRank(rank: string): void {
    this._currentRank = rank;
  }
}
