import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente PlayerRole - gestisce i ruoli e permessi del giocatore
 * Separato da Honor per Separation of Concerns
 */
export class PlayerRole extends Component {
  private _isAdministrator: boolean = false;

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
}
