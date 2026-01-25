import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente che identifica un'entità come giocatore remoto
 * Sostituisce la Map manuale per una gestione più robusta
 */
export class RemotePlayer extends Component {
  public clientId: string;
  public nickname: string;
  public rank: string;

  public targetId: string | null = null;
  public lastVisualFireTime: number = 0;
  public lastSeen: number = Date.now();

  constructor(
    clientId: string,
    nickname: string = '',
    rank: string = 'Recruit'
  ) {
    super();
    this.clientId = clientId;
    this.nickname = nickname;
    this.rank = rank;
    this.targetId = null;
    this.lastVisualFireTime = 0;
  }

  /**
   * Aggiorna le informazioni del giocatore remoto
   */
  updateInfo(nickname: string, rank: string): void {
    this.nickname = nickname;
    this.rank = rank;
  }
}
