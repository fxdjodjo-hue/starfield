import { AssetManager } from '../AssetManager';

/**
 * Stato di connessione al server
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

/**
 * Stato di un giocatore connesso
 */
export interface PlayerState {
  id: string;                    // ID univoco del giocatore
  nickname: string;              // Nome visualizzato
  isLocal: boolean;              // È questo client?
  isHost: boolean;               // È l'host della stanza?
  entityId?: string;             // ID dell'entity nel mondo di gioco
  lastActivity: number;          // Timestamp ultima attività
  ping: number;                  // Latenza in ms
}

/**
 * Stato della stanza di gioco
 */
export interface GameRoom {
  id: string;                    // ID univoco della stanza
  name: string;                  // Nome della stanza
  maxPlayers: number;            // Numero massimo giocatori
  currentPlayers: number;        // Numero corrente giocatori
  isPrivate: boolean;            // Stanza privata?
  password?: string;             // Password se privata
  gameMode: string;              // Modalità di gioco
  mapId: string;                 // ID della mappa
  hostId: string;                // ID del giocatore host
}

/**
 * Contesto di gioco multiplayer-first
 * Gestisce stato globale del gioco, giocatori connessi e connessione server
 */
export class GameContext {
  // Canvas e rendering
  public canvas: HTMLCanvasElement;
  public gameContainer: HTMLElement;
  public assetManager: AssetManager;

  // Identità client
  public localClientId: string = '';           // ID univoco di questo client (UUID Supabase)
  public playerId: number = 0;                 // ID numerico sequenziale del player
  public playerNickname: string = '';          // Nickname del player
  public sessionId: string = '';               // ID sessione corrente

  // Stato connessione
  public connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  public serverUrl: string = 'ws://localhost:3000'; // URL del server di gioco

  // Gestione giocatori
  public players: Map<string, PlayerState> = new Map();
  public localPlayer: PlayerState | null = null;

  // Stato stanza
  public currentRoom: GameRoom | null = null;

  // Timing e sincronizzazione
  public serverTick: number = 0;
  public clientTick: number = 0;
  public latency: number = 0;

  constructor(canvas: HTMLCanvasElement, gameContainer: HTMLElement) {
    this.canvas = canvas;
    this.gameContainer = gameContainer;
    this.assetManager = new AssetManager();
  }

  /**
   * Aggiunge un giocatore connesso
   */
  addPlayer(player: PlayerState): void {
    this.players.set(player.id, player);
    if (player.isLocal) {
      this.localPlayer = player;
    }
  }

  /**
   * Rimuove un giocatore disconnesso
   */
  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player?.isLocal) {
      this.localPlayer = null;
    }
    this.players.delete(playerId);
  }

  /**
   * Ottiene un giocatore per ID
   */
  getPlayer(playerId: string): PlayerState | undefined {
    return this.players.get(playerId);
  }

  /**
   * Ottiene tutti i giocatori connessi
   */
  getAllPlayers(): PlayerState[] {
    return Array.from(this.players.values());
  }

  /**
   * Verifica se questo client è l'host
   */
  isHost(): boolean {
    return this.localPlayer?.isHost ?? false;
  }

  /**
   * Imposta lo stato di connessione
   */
  setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    console.log(`🔌 Connection state changed to: ${state}`);
  }

  /**
   * Verifica se connesso al server
   */
  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }
}
