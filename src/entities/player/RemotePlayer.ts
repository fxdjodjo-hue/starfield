import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente che identifica un'entità come giocatore remoto
 * Sostituisce la Map manuale per una gestione più robusta
 */
export class RemotePlayer extends Component {
  public clientId: string;
  public nickname: string;
  public rank: string;

  constructor(
    clientId: string,
    nickname: string = '',
    rank: string = 'Recruit'
  ) {
    super();
    this.clientId = clientId;
    this.nickname = nickname;
    this.rank = rank;
  }

  /**
   * Aggiorna le informazioni del giocatore remoto
   */
  updateInfo(nickname: string, rank: string): void {
    this.nickname = nickname;
    this.rank = rank;
  }
}
