import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente che identifica un'entità come giocatore remoto
 * Sostituisce la Map manuale per una gestione più robusta
 */
export class RemotePlayer extends Component {
  public clientId: string;
  public nickname: string;
  public rank: string;
  public leaderboardPodiumRank: number;

  public targetId: string | null = null;
  public lastVisualFireTime: number = 0;
  public lastSeen: number = Date.now();

  constructor(
    clientId: string,
    nickname: string = '',
    rank: string = 'Recruit',
    leaderboardPodiumRank: number = 0
  ) {
    super();
    this.clientId = clientId;
    this.nickname = nickname;
    this.rank = rank;
    this.leaderboardPodiumRank = leaderboardPodiumRank;
    this.targetId = null;
    this.lastVisualFireTime = 0;
  }

  /**
   * Aggiorna le informazioni del giocatore remoto
   */
  updateInfo(nickname: string, rank: string, leaderboardPodiumRank: number = 0): void {
    this.nickname = nickname;
    this.rank = rank;
    this.leaderboardPodiumRank = leaderboardPodiumRank;
  }
}
