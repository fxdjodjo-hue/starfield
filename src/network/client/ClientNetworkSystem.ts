import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { ECSSnapshot } from '../../systems/simulation/ECSSnapshot';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Npc } from '../../entities/ai/Npc';
import { InputCommandWithId } from '../../systems/input/commands/InputCommand';
import {
  NetworkMessageType,
  NetworkMessageFactory
} from '../protocol/NetworkMessage';
import type {
  NetworkMessage,
  ClientJoinMessage,
  ServerWelcomeMessage,
  WorldSnapshotMessage,
  TickSyncMessage,
  ErrorMessage
} from '../protocol/NetworkMessage';
import { NetworkProtocol, NETWORK_PROTOCOL_CONFIG } from '../protocol/NetworkProtocol';


/**
 * Sistema di rete per il client
 * Gestisce connessione WebSocket, invio comandi e ricezione snapshot
 */
export class ClientNetworkSystem extends BaseSystem {
  private gameContext: GameContext;
  private socket: WebSocket | null = null;
  private serverUrl: string;
  private clientId: string = '';
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // ms

  // Stato connessione
  private lastMessageTime = 0;
  private pingSequence = 0;
  private latency = 0;

  // Stato server
  private serverTick = 0;
  private snapshotInterval = NETWORK_PROTOCOL_CONFIG.SNAPSHOT_INTERVAL;

  // Stato semplice per movimento server-authoritative
  private serverAssignedPlayerId: string | null = null;

  // Callbacks per eventi rete
  private onConnected?: () => void;
  private onDisconnected?: () => void;
  private onSnapshotReceived?: (snapshot: WorldSnapshotMessage) => void;
  private onTickSync?: (tickSync: TickSyncMessage) => void;
  private onError?: (error: ErrorMessage) => void;

  constructor(ecs: ECS, gameContext: GameContext, serverUrl: string) {
    super(ecs);
    this.gameContext = gameContext;
    this.serverUrl = serverUrl;
  }

  /**
   * Connette al server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      try {
        // TEMP: Hardcoded per test locale - ripristinare dopo test
        this.socket = new WebSocket('ws://localhost:8080');
        this.socket.binaryType = 'blob'; // Per future ottimizzazioni binarie

        this.socket.onopen = () => {
          console.log('🔗 Connected to server:', this.serverUrl);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.lastMessageTime = Date.now();

          // Invia messaggio di join
          this.sendJoinMessage();
          this.onConnected?.();

          // Fallback timeout: se non riceviamo server_welcome entro 5 secondi, usa playerId locale
          setTimeout(() => {
            if (!this.serverAssignedPlayerId) {
              console.log('⏰ [CLIENT] Server welcome timeout, using local playerId as fallback');
              this.serverAssignedPlayerId = this.gameContext.playerId;
            }
          }, 5000);

          resolve();
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.socket.onclose = (event) => {
          console.log('🔌 Disconnected from server:', event.code, event.reason);
          this.isConnected = false;
          this.onDisconnected?.();
          // NON riconnettere automaticamente - la riconnessione deve essere esplicita
          // this.handleReconnection();
        };

        this.socket.onerror = (error) => {
          console.error('🌐 WebSocket error:', error);
          reject(error);
        };

        // Timeout connessione
        setTimeout(() => {
          if (!this.isConnected) {
            this.socket?.close();
            reject(new Error('Connection timeout'));
          }
        }, NETWORK_PROTOCOL_CONFIG.CONNECTION_TIMEOUT);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnette dal server
   */
  disconnect(): void {
    if (this.socket) {
      this.sendLeaveMessage();
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Invia un comando input al server (semplice)
   */
  sendInputCommand(commandWithId: any): void {
    console.log(`📡 [CLIENT] Sending command to server:`, commandWithId);
    if (!this.isConnected || !this.socket) {
      console.warn('⚠️ [CLIENT] Cannot send command: not connected');
      return;
    }

    // Usa il playerId assegnato dal server, o quello locale come fallback
    const playerId = this.serverAssignedPlayerId || this.gameContext.playerId;

    const message = NetworkMessageFactory.createInputCommand(
      playerId,
      commandWithId,
      this.gameContext.tickManager.getCurrentTick()
    );

    try {
      this.sendMessage(message);
    } catch (error) {
      console.error('❌ Failed to send command:', error);
    }
  }

  /**
   * Gestisce i messaggi ricevuti dal server
   */
  private handleMessage(data: string): void {
    try {
      const message = NetworkProtocol.deserialize(data);
      this.lastMessageTime = Date.now();

      switch (message.type) {
        case NetworkMessageType.SERVER_WELCOME:
          this.handleServerWelcome(message as ServerWelcomeMessage);
          break;

        case NetworkMessageType.WORLD_SNAPSHOT:
          this.handleWorldSnapshot(message as WorldSnapshotMessage);
          break;

        case NetworkMessageType.TICK_SYNC:
          this.handleTickSync(message as TickSyncMessage);
          break;

        case NetworkMessageType.PONG:
          this.handlePong(message as any);
          break;

        case NetworkMessageType.ERROR:
          this.handleError(message as ErrorMessage);
          break;

        default:
          console.warn('⚠️ Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('❌ Failed to handle network message:', error);
    }
  }

  private handleServerWelcome(message: ServerWelcomeMessage): void {
    console.log('🎉 [CLIENT] Server welcome received:', message);
    console.log('🎯 [CLIENT] assignedPlayerId:', message.assignedPlayerId);

    // Salva il clientId assegnato dal server
    if (message.clientId) {
      this.clientId = message.clientId;
      console.log(`🆔 [CLIENT] Assigned clientId: ${this.clientId}`);
    }

    // Aggiorna il playerId con quello assegnato dal server
    if (message.assignedPlayerId) {
      const oldPlayerId = this.gameContext.playerId;
      this.gameContext.playerId = message.assignedPlayerId;
      this.serverAssignedPlayerId = message.assignedPlayerId;
      console.log(`🎯 [CLIENT] PlayerId updated from ${oldPlayerId} to ${this.gameContext.playerId}`);
    }

    this.serverTick = message.serverTick;
    this.snapshotInterval = message.snapshotInterval;

    // Sincronizza tick manager con server
    this.gameContext.tickManager.syncWithServer(message.serverTick);

    // Applica stato iniziale del mondo se presente
    if ((message as any).initialWorldState) {
      console.log('🌍 Applying initial world state from server');
      this.applyInitialWorldState((message as any).initialWorldState);
    }
  }

  /**
   * Applica lo stato iniziale del mondo ricevuto dal server
   */
  private applyInitialWorldState(worldState: any): void {
    // Il server.js invia initialWorldState in formato diverso
    console.log('🌍 Processing initial world state:', worldState);

    // Se è il formato del server.js (players, npcs, projectiles)
    if (worldState.players || worldState.npcs || worldState.projectiles) {
      this.applySimpleInitialWorldState(worldState);
      return;
    }

    // Fallback al formato ECSSnapshot
    if (!worldState.entityStates || !Array.isArray(worldState.entityStates)) {
      console.warn('⚠️ Invalid initial world state received');
      return;
    }

    console.log(`🌍 Processing initial world state with ${worldState.entityStates.length} entities`);

    // Crea snapshot temporaneo dallo stato iniziale
    const snapshot = new ECSSnapshot(
      worldState.tick || this.serverTick,
      worldState.timestamp || Date.now()
    );

    // Popola snapshot con dati ricevuti
    for (const entityState of worldState.entityStates) {
      if (!entityState || typeof entityState.entityId === 'undefined') {
        console.warn('⚠️ Invalid entityState in initial world state:', entityState);
        continue;
      }

      console.log(`🔄 Adding initial entity ${entityState.entityId} to snapshot`);
      snapshot.addEntityState(entityState.entityId, entityState.components);
    }

    // Applica lo snapshot completo
    this.gameContext.applySnapshot(snapshot);

    console.log(`🌍 Applied initial world state: ${snapshot.getEntityCount()} entities at tick ${snapshot.tick}`);
  }

  /**
   * Applica lo stato iniziale nel formato semplice del server.js
   */
  private applySimpleInitialWorldState(worldState: any): void {
    console.log('🌍 Applying simple initial world state from server.js');

    // Per ora, non applichiamo lo stato iniziale semplice
    // Il client riceverà gli aggiornamenti regolari tramite snapshot
    console.log('🌍 Skipping initial world state application - will use regular snapshots');
  }

  private handleWorldSnapshot(message: WorldSnapshotMessage): void {
    console.log(`📦 [CLIENT] Received world snapshot: ${message.snapshot.entityStates?.length || 0} entities, tick=${message.serverTick}`);

    // Applica lo snapshot del server (questo sovrascrive le posizioni locali)
    this.applyWorldSnapshot(message);

    // Dopo aver applicato lo snapshot del server, ferma qualsiasi movimento locale
    // per evitare desincronizzazione - il server è l'unica fonte di verità
    this.stopLocalMovement();

    console.log(`🔄 [CLIENT] Applied server snapshot - local movement stopped`);

    // Aggiorna tick server
    this.serverTick = message.serverTick;

    // Notifica sistemi interessati
    this.onSnapshotReceived?.(message);
  }


  /**
   * Applica uno snapshot del mondo ricevuto dal server
   */
  private applyWorldSnapshot(message: WorldSnapshotMessage): void {
    // Converte i dati dello snapshot in un'istanza ECSSnapshot
    const snapshot = this.createSnapshotFromMessage(message);

    // Applica lo snapshot usando il sistema ECS esistente
    this.gameContext.applySnapshot(snapshot);
  }

  /**
   * Crea un'istanza ECSSnapshot dai dati del messaggio
   */
  private createSnapshotFromMessage(message: WorldSnapshotMessage): ECSSnapshot {
    const snapshot = new ECSSnapshot(message.serverTick, message.timestamp);

    // Gestisci sia il formato ECSSnapshot che il formato semplice del server.js
    if (message.snapshot && message.snapshot.entityStates) {
      console.log(`📦 Processing ${message.snapshot.entityStates.length} entity states from server`);

      for (const entityState of message.snapshot.entityStates) {
        // Supporta sia il formato ECSSnapshot che il formato semplice del server.js
        let entityId: number;
        let components: any[];

        if (typeof entityState.entityId === 'number') {
          // Formato ECSSnapshot (TypeScript)
          entityId = entityState.entityId;
          components = entityState.components;
        } else if (entityState.id && typeof entityState.id === 'string') {
          // Formato semplice del server.js - converti in formato ECSSnapshot
          entityId = parseInt(entityState.id.split('_').pop() || '0'); // Estrai ID numerico
          components = this.convertSimpleEntityToComponents(entityState);
        } else {
          console.warn('⚠️ Invalid entityState received:', entityState);
          continue;
        }

        console.log(`🔄 Adding entity ${entityId} to snapshot`);
        snapshot.addEntityState(entityId, components);
      }

      console.log(`✅ Created snapshot with ${snapshot.getEntityCount()} entities`);
    } else {
      console.warn('⚠️ No entityStates in snapshot message');
    }

    return snapshot;
  }

  /**
   * Ferma qualsiasi movimento locale del player dopo aver applicato uno snapshot del server.
   * Il server è l'unica fonte di verità, quindi il movimento locale deve essere fermato
   * per evitare desincronizzazione.
   */
  private stopLocalMovement(): void {
    // Trova l'entità del player locale (quella senza componente NPC)
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform, Velocity)
      .filter(entity => !this.ecs.hasComponent(entity, Npc));

    if (playerEntities.length > 0) {
      const playerEntity = playerEntities[0];
      const velocity = this.ecs.getComponent(playerEntity, Velocity);

      if (velocity) {
        // Azzera la velocità per fermare il movimento locale
        velocity.vx = 0;
        velocity.vy = 0;
        console.log(`🛑 [CLIENT] Stopped local movement after server sync`);
      }
    }
  }

  /**
   * Converte un'entità nel formato semplice del server.js in componenti ECSSnapshot
   */
  private convertSimpleEntityToComponents(entityState: any): any[] {
    const components: any[] = [];

    // Converti posizione in componente Transform
    if (typeof entityState.x === 'number' && typeof entityState.y === 'number') {
      components.push({
        componentType: 'Transform',
        data: {
          x: entityState.x,
          y: entityState.y,
          rotation: entityState.rotation || 0
        }
      });
    }

    // Converti velocità in componente Velocity
    if (typeof entityState.vx === 'number' && typeof entityState.vy === 'number') {
      components.push({
        componentType: 'Velocity',
        data: {
          vx: entityState.vx,
          vy: entityState.vy,
          angularVelocity: 0
        }
      });
    }

    // Converti health/shield in componenti corrispondenti
    if (typeof entityState.health === 'number') {
      components.push({
        componentType: 'Health',
        data: {
          current: entityState.health,
          max: entityState.maxHealth || entityState.health
        }
      });
    }

    if (typeof entityState.shield === 'number') {
      components.push({
        componentType: 'Shield',
        data: {
          current: entityState.shield,
          max: entityState.maxShield || entityState.shield
        }
      });
    }

    // Aggiungi componente Npc se è un NPC
    if (entityState.type === 'npc' || entityState.type === 'scouter' || entityState.type === 'frigate') {
      components.push({
        componentType: 'Npc',
        data: {
          npcType: entityState.type,
          defaultBehavior: 'idle'
        }
      });
    }

    return components;
  }

  /**
   * Trova un'entità per ID in modo affidabile
   */
  private findEntityById(entityId: string | number): any {
    const numericId = typeof entityId === 'string' ? parseInt(entityId) : entityId;

    // Cerca per ID numerico diretto
    if (this.ecs.entities.has(numericId)) {
      return this.ecs.getEntity(numericId);
    }

    // Fallback per player: cerca entità senza componente NPC
    if (typeof entityId === 'string' && (entityId.startsWith('player_') || entityId.includes('player'))) {
      const playerEntities = this.ecs.getEntitiesWithComponents(Transform, Velocity)
        .filter(entity => !this.ecs.hasComponent(entity, Npc));
      if (playerEntities.length > 0) {
        console.log(`🔍 Found local player entity for remote ID ${entityId}`);
        return playerEntities[0];
      }
    }

    return null;
  }

  private handleTickSync(message: TickSyncMessage): void {
    const currentTick = this.gameContext.tickManager.getCurrentTick();
    const serverTick = message.serverTick;
    const tickDifference = serverTick - currentTick;

    console.log(`🎯 Tick sync: client=${currentTick}, server=${serverTick}, diff=${tickDifference}`);

    // Gestisci desync significativo
    if (Math.abs(tickDifference) > 5) {
      if (tickDifference > 0) {
        // Server avanti - accelera per raggiungere
        console.log(`⏩ Client behind, advancing to tick ${serverTick}`);
        this.gameContext.tickManager.advanceToTick(serverTick);
      } else {
        // Client avanti - rewind limitato per evitare problemi
        const rewindTarget = Math.max(serverTick - 10, 0);
        console.log(`⏪ Client ahead, rewinding to tick ${rewindTarget}`);
        this.gameContext.tickManager.rewindToTick(rewindTarget);

        // Se siamo molto avanti, potrebbe essere necessario un rollback dello stato
        if (Math.abs(tickDifference) > 15 && this.lastServerSnapshot) {
          console.log(`🔄 Major desync detected, applying server state`);
          this.applyWorldSnapshot(this.lastServerSnapshot);
        }
      }
    }

    // Aggiorna latenza stimata
    const rtt = Date.now() - message.serverTime;
    this.latency = rtt / 2;

    this.serverTick = serverTick;
    this.onTickSync?.(message);
  }

  private handlePong(message: any): void {
    // Calcola latenza (in futuro)
    // this.latency = Date.now() - message.timestamp;
  }

  private handleError(message: ErrorMessage): void {
    console.error('🚨 Server error:', message.errorCode, message.message);
    this.onError?.(message);
  }

  /**
   * Gestisce la riconnessione automatica
   */
  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(error => {
        console.error('❌ Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Invia messaggio di join al server
   */
  private sendJoinMessage(): void {
    const message = NetworkMessageFactory.createClientJoin(
      this.gameContext.playerId,
      this.gameContext.playerNickname || 'Player'
    );
    this.sendMessage(message);
  }

  /**
   * Invia messaggio di leave al server
   */
  private sendLeaveMessage(): void {
    const message = NetworkMessageFactory.createClientLeave(this.gameContext.playerId);
    this.sendMessage(message);
  }

  /**
   * Invia messaggio al server
   */
  private sendMessage(message: NetworkMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ Cannot send message: socket not ready');
      return;
    }

    try {
      const data = NetworkProtocol.serialize(message);
      console.log(`📤 [CLIENT] Sending raw data (${data.length} bytes):`, data.substring(0, 200) + '...');
      this.socket.send(data);
      console.log(`✅ [CLIENT] Raw data sent successfully`);
    } catch (error) {
      console.error('❌ Failed to send message:', error);
    }
  }

  /**
   * Imposta callback per connessione
   */
  setOnConnected(callback: () => void): void {
    this.onConnected = callback;
  }

  /**
   * Imposta callback per disconnessione
   */
  setOnDisconnected(callback: () => void): void {
    this.onDisconnected = callback;
  }

  /**
   * Imposta callback per snapshot ricevuto
   */
  setOnSnapshotReceived(callback: (snapshot: WorldSnapshotMessage) => void): void {
    this.onSnapshotReceived = callback;
  }

  /**
   * Imposta callback per tick sync
   */
  setOnTickSync(callback: (tickSync: TickSyncMessage) => void): void {
    this.onTickSync = callback;
  }

  /**
   * Imposta callback per errori
   */
  setOnError(callback: (error: ErrorMessage) => void): void {
    this.onError = callback;
  }

  /**
   * Verifica se connesso
   */
  isConnectedToServer(): boolean {
    return this.isConnected && this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Ottiene latenza corrente (ms)
   */
  getLatency(): number {
    return this.latency;
  }

  /**
   * Ottiene tick corrente del server
   */
  getServerTick(): number {
    return this.serverTick;
  }

  update(deltaTime: number, tick: number): void {
    // Gestione heartbeat e timeout
    const now = Date.now();

    if (this.isConnected) {
      // Invia ping periodicamente
      if (now - this.lastMessageTime > NETWORK_PROTOCOL_CONFIG.HEARTBEAT_INTERVAL) {
        this.sendPing();
      }

      // Controlla timeout connessione
      if (now - this.lastMessageTime > NETWORK_PROTOCOL_CONFIG.TIMEOUT_THRESHOLD) {
        console.warn('⚠️ Connection timeout, disconnecting');
        this.disconnect();
      }
    }
  }

  private sendPing(): void {
    const message = NetworkMessageFactory.createPing(++this.pingSequence);
    this.sendMessage(message);
  }
}
