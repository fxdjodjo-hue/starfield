import { AssetManager } from '../../core/services/AssetManager';
import { NETWORK_CONFIG } from '../../config/NetworkConfig';
import { type PlayerUuid, type PlayerDbId, type ClientId } from '../../config/NetworkConfig';
import { ConnectionState } from '../../multiplayer/client/managers/NetworkStateManager';

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

  // Identità client - separazione esplicita con branded types
  public localClientId: ClientId = '' as ClientId;           // ID univoco di questo client (WebSocket ID)
  public authId: PlayerUuid = '' as PlayerUuid;              // Auth ID dell'utente (UUID Supabase)
  public playerDbId: PlayerDbId = 0 as PlayerDbId;           // ID numerico database del player
  public playerNickname: string = '';                        // Nickname del player
  public sessionId: string = '';                             // ID sessione corrente

  // Dati giocatore (sincronizzati dal server)
  public playerInventory: {
    credits: number;
    cosmos: number;
    experience: number;
    honor: number;
    recentHonor?: number; // Media mobile honor ultimi 30 giorni
  } = {
      credits: 0,
      cosmos: 0,
      experience: 0,
      honor: 0
    };

  public playerUpgrades: {
    hpUpgrades: number;
    shieldUpgrades: number;
    speedUpgrades: number;
    damageUpgrades: number;
  } = {
      hpUpgrades: 0,
      shieldUpgrades: 0,
      speedUpgrades: 0,
      damageUpgrades: 0
    };

  public playerQuests: any[] = [];             // Lista quest del giocatore

  // Stato connessione
  public connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  public serverUrl: string = ''; // URL del server di gioco (inizializzato nel costruttore)

  // Gestione giocatori
  public players: Map<string, PlayerState> = new Map();
  public localPlayer: PlayerState | null = null;

  // Stato stanza
  public currentRoom: GameRoom | null = null;
  public currentMapId: string = 'palantir'; // Mappa corrente
  public playerShipSkinId: string = ''; // Server-selected ship skin
  public unlockedPlayerShipSkinIds: string[] = []; // Server-owned ship skins

  // Timing e sincronizzazione
  public serverTick: number = 0;
  public clientTick: number = 0;
  public latency: number = 0;

  // Riferimento a AuthScreen per aggiornare lo spinner
  public authScreen: any = null;

  // 🔧 FIX: Store pending administrator status from welcome message
  // 🔧 DEBUG NPC COUNTER
  public pendingAdministrator: boolean | null = null;
  public totalWorldNpcs: number = 0;

  // Riferimento allo stato corrente del gioco
  public currentState: any = null;

  constructor(canvas: HTMLCanvasElement, gameContainer: HTMLElement) {
    this.canvas = canvas;
    this.gameContainer = gameContainer;
    this.assetManager = new AssetManager();

    // Initialize server URL from network config
    this.serverUrl = NETWORK_CONFIG.DEFAULT_SERVER_URL;
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
  }

  /**
   * Verifica se connesso al server
   */
  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }
}
