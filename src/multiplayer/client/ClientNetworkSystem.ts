import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { Transform } from '../../entities/spatial/Transform';

/**
 * Sistema di rete client semplificato per multiplayer funzionante
 * Invia input al server e riceve aggiornamenti di stato
 */
export class ClientNetworkSystem extends BaseSystem {
  private gameContext: GameContext;
  private socket: WebSocket | null = null;
  private clientId: string = '';
  private connected = false;
  private tickCounter = 0;

  // Informazioni player
  private playerNickname: string = 'Player';
  private playerId?: number;

  // Stato sincronizzazione posizione
  private lastSentPosition: { x: number; y: number } | null = null;
  private lastPositionSyncTime = 0;
  private lastHeartbeatTime = 0;
  private readonly HEARTBEAT_INTERVAL = 5000; // 5 secondi
  private readonly POSITION_SYNC_INTERVAL = 100; // 10 FPS per posizione

  constructor(ecs: ECS, gameContext: GameContext, serverUrl: string = 'ws://localhost:3000') {
    super(ecs);
    this.gameContext = gameContext;

    // Genera un client ID univoco
    this.clientId = 'client_' + Math.random().toString(36).substr(2, 9);
    this.connect(serverUrl);
  }

  /**
   * Imposta informazioni aggiuntive del player
   */
  setPlayerInfo(nickname?: string, playerId?: number): void {
    this.playerNickname = nickname || 'Player';
    this.playerId = playerId;
  }

  /**
   * Connette al server
   */
  connect(serverUrl: string): void {
    try {
      console.log(`🔌 Connecting to server: ${serverUrl}`);
      this.socket = new WebSocket(serverUrl);

      this.socket.onopen = () => {
        console.log('✅ Connected to server');
        this.connected = true;

        // Invia messaggio di join con informazioni complete del player
        this.sendMessage({
          type: 'join',
          clientId: this.clientId,
          nickname: this.playerNickname,
          playerId: this.playerId,
          userId: this.gameContext.localClientId // Supabase auth ID
        });
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.socket.onclose = () => {
        console.log('❌ Disconnected from server');
        this.connected = false;
      };

      this.socket.onerror = (error) => {
        console.error('🔌 WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to connect to server:', error);
    }
  }


  /**
   * Aggiorna il sistema di rete
   */
  update(deltaTime: number): void {
    if (!this.connected || !this.socket) return;

    this.tickCounter++;

    // Sincronizza posizione del player a intervalli regolari
    const now = Date.now();
    if (now - this.lastPositionSyncTime > this.POSITION_SYNC_INTERVAL) {
      this.sendPlayerPosition();
      this.lastPositionSyncTime = now;
    }

    // Invia heartbeat periodico per mantenere connessione viva
    if (now - this.lastHeartbeatTime > this.HEARTBEAT_INTERVAL) {
      this.sendHeartbeat();
      this.lastHeartbeatTime = now;
    }
  }

  /**
   * Invia heartbeat per mantenere connessione viva
   */
  private sendHeartbeat(): void {
    if (!this.socket) return;

    this.sendMessage({
      type: 'heartbeat',
      clientId: this.clientId,
      timestamp: Date.now()
    });
  }

  /**
   * Sincronizza la posizione del player al server
   */
  private sendPlayerPosition(): void {
    if (!this.socket) return;

    // Trova l'entità del player locale
    // Per ora assumiamo che il player sia l'unico entity con Transform e Velocity
    // TODO: Implementare identificazione più robusta del player locale
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform);

    if (playerEntities.length === 0) return;

    // Prendi il primo player (in single-player è l'unico)
    const playerEntity = playerEntities[0];
    const transform = this.ecs.getComponent(playerEntity, Transform);

    if (!transform) return;

    // Invia posizione solo se cambiata significativamente
    const currentPosition = { x: transform.x, y: transform.y };
    const positionChanged = !this.lastSentPosition ||
      Math.abs(currentPosition.x - this.lastSentPosition.x) > 5 ||
      Math.abs(currentPosition.y - this.lastSentPosition.y) > 5;

    if (positionChanged) {
      this.sendMessage({
        type: 'position_update',
        clientId: this.clientId,
        position: currentPosition,
        rotation: transform.rotation || 0,
        tick: this.tickCounter
      });
      this.lastSentPosition = { ...currentPosition };
    }
  }

  /**
   * Gestisce i messaggi ricevuti dal server
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'welcome':
          console.log('🎉 Server welcome:', message);
          this.gameContext.localClientId = message.clientId || this.clientId;
          break;

        case 'position_ack':
          // Position acknowledgment - non richiede elaborazione
          break;

        case 'heartbeat_ack':
          // Heartbeat acknowledgment - connessione viva
          break;

        case 'world_update':
          // Qui gestiremmo gli aggiornamenti del mondo
          console.log('🌍 World update received');
          break;

        case 'error':
          console.error('🚨 Server error:', message.message);
          break;

        default:
          console.log('📨 Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  /**
   * Invia un messaggio al server
   */
  private sendMessage(message: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  /**
   * Verifica se è connesso
   */
  isConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnette dal server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.connected = false;
    }
  }
}
