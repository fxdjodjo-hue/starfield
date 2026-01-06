import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente che identifica un'entità come giocatore remoto
 * Sostituisce la Map manuale per una gestione più robusta
 */
export class RemotePlayer extends Component {
  constructor(
    public clientId: string,
    public nickname: string = '',
    public rank: string = 'Recruit'
  ) {
    super();
  }

  /**
   * Aggiorna le informazioni del giocatore remoto
   */
  updateInfo(nickname: string, rank: string): void {
    this.nickname = nickname;
    this.rank = rank;
  }
}
