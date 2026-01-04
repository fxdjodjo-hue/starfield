import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { Transform } from '../../entities/spatial/Transform';
import { Sprite } from '../../entities/Sprite';
import { Health } from '../../entities/combat/Health';
import { Velocity } from '../../entities/spatial/Velocity';
import { Npc } from '../../entities/ai/Npc';
import { RemotePlayerSystem } from '../../systems/multiplayer/RemotePlayerSystem';

/**
 * Sistema di rete client semplificato per multiplayer funzionante
 * Invia input al server e riceve aggiornamenti di stato
 */
export class ClientNetworkSystem extends BaseSystem {
  private gameContext: GameContext;
  private remotePlayerSystem: RemotePlayerSystem;
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

  constructor(ecs: ECS, gameContext: GameContext, remotePlayerSystem: RemotePlayerSystem | null, serverUrl: string = 'ws://localhost:3000') {
    super(ecs);
    this.gameContext = gameContext;
    this.remotePlayerSystem = remotePlayerSystem;

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

        // Prima ottieni la posizione corrente del player locale
        const currentPosition = this.getLocalPlayerPosition();

        // Invia messaggio di join con informazioni complete del player
        this.sendMessage({
          type: 'join',
          clientId: this.clientId,
          nickname: this.playerNickname,
          playerId: this.playerId,
          userId: this.gameContext.localClientId, // Supabase auth ID
          position: currentPosition // Posizione iniziale del player
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
   * Ottiene la posizione corrente del player locale
   */
  private getLocalPlayerPosition(): { x: number; y: number; rotation: number } {
    // Trova il player locale (assumiamo sia l'unico senza componente NPC)
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform)
      .filter(entity => !this.ecs.hasComponent(entity, Npc));

    if (playerEntities.length > 0) {
      const playerEntity = playerEntities[0];
      const transform = this.ecs.getComponent(playerEntity, Transform);

      if (transform) {
        return {
          x: transform.x,
          y: transform.y,
          rotation: transform.rotation || 0
        };
      }
    }

    // Fallback: posizione default
    console.warn('[CLIENT] Could not find local player position, using default');
    return { x: 400, y: 300, rotation: 0 };
  }

  /**
   * Gestisce aggiornamenti posizione di giocatori remoti
   */
  private handleRemotePlayerUpdate(message: any): void {
    const { clientId, position, rotation } = message;

    if (this.remotePlayerSystem) {
      if (!this.remotePlayerSystem.isRemotePlayer(clientId)) {
        // Crea nuovo giocatore remoto
        this.remotePlayerSystem.addRemotePlayer(clientId, position, rotation || 0);
      } else {
        // Aggiorna posizione giocatore remoto esistente
        this.remotePlayerSystem.updateRemotePlayer(clientId, position, rotation || 0);
      }
    }
  }

  /**
   * Crea un nuovo giocatore remoto
   */
  private createRemotePlayer(clientId: string, position: any, rotation: number): number {
    // Crea una nuova entity per il giocatore remoto
    const entity = this.ecs.createEntity();

    // Aggiungi componenti base
    const transform = new Transform(position.x, position.y, rotation || 0);
    this.ecs.addComponent(entity, Transform, transform);

    // Aggiungi velocità (anche se non si muove attivamente, serve per rendering)
    const velocity = new Velocity(0, 0, 0);
    this.ecs.addComponent(entity, Velocity, velocity);

    // Aggiungi salute per mostrare le barre e confermare che è renderizzato
    const health = new Health(100, 100); // 100/100 HP
    this.ecs.addComponent(entity, Health, health);

    // Aggiungi sprite per il giocatore remoto (stesso del player locale per ora)
    const sprite = new Sprite(null, 32, 32); // null significa usa colore invece di immagine
    this.ecs.addComponent(entity, Sprite, sprite);

    console.log(`🎯 [CLIENT] Created remote player entity ${entity.id} with components: Transform, Velocity, Health, Sprite`);
    return entity.id;
  }

  /**
   * Gestisce disconnessione di un giocatore remoto
   */
  public handleRemotePlayerDisconnected(clientId: string): void {
    if (this.remotePlayerSystem) {
      this.remotePlayerSystem.removeRemotePlayer(clientId);
    }
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

        case 'remote_player_update':
          // Aggiornamento posizione di un altro giocatore
          this.handleRemotePlayerUpdate(message);
          break;

        case 'player_joined':
          // Un nuovo giocatore si è connesso
          console.log(`👋 [CLIENT] New player joined: ${message.clientId} (${message.nickname})`);
          break;

        case 'player_left':
          // Un giocatore si è disconnesso
          console.log(`👋 [CLIENT] Player left: ${message.clientId}`);
          this.handleRemotePlayerDisconnected(message.clientId);
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
    return this.connected;
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
