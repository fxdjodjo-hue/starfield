import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { GameContext } from '../../infrastructure/engine/GameContext';
import {
  NetworkMessage,
  NetworkMessageType,
  NetworkMessageFactory,
  ClientJoinMessage,
  ClientLeaveMessage,
  InputCommandMessage,
  ServerWelcomeMessage,
  WorldSnapshotMessage,
  TickSyncMessage,
  ErrorMessage
} from '../protocol/NetworkMessage';
import { NetworkProtocol, NETWORK_PROTOCOL_CONFIG } from '../protocol/NetworkProtocol';

/**
 * Stato di un client connesso
 */
interface ConnectedClient {
  id: string;
  playerId: string;
  playerName: string;
  socket: any; // WebSocket
  lastMessageTime: number;
  latency: number;
}

/**
 * Sistema di rete per il server
 * Gestisce connessioni client, elabora comandi input, simula mondo
 */
export class ServerNetworkSystem extends BaseSystem {
  private gameContext: GameContext;
  private server: any = null; // WebSocket.Server
  private port: number;
  private clients = new Map<string, ConnectedClient>();
  private maxPlayers: number;

  // Stato simulazione
  private lastSnapshotTick = 0;
  private processedCommandIds = new Set<string>();
  private commandBuffer: InputCommandMessage[] = [];
  private lastProcessedTick = 0;

  // Callbacks
  private onClientConnected?: (clientId: string, playerId: string) => void;
  private onClientDisconnected?: (clientId: string, playerId: string) => void;
  private onCommandReceived?: (command: InputCommandMessage) => void;

  constructor(ecs: ECS, gameContext: GameContext, port: number = 8080, maxPlayers: number = 4) {
    super(ecs);
    this.gameContext = gameContext;
    this.port = port;
    this.maxPlayers = maxPlayers;
  }

  /**
   * Avvia il server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // In un ambiente reale: const WebSocket = require('ws');
        // const server = new WebSocket.Server({ port: this.port });
        // Per ora simuliamo l'avvio
        console.log(`🚀 Starting server on port ${this.port} (max ${this.maxPlayers} players)`);

        // Simula server avviato
        this.server = {
          on: (event: string, callback: Function) => {
            if (event === 'connection') {
              // Simula connessione (in produzione sarebbe il vero WebSocket)
              console.log('🔌 Server ready for connections');
            }
          },
          close: () => {
            console.log('🛑 Server stopped');
          }
        };

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Ferma il server
   */
  stop(): void {
    // Chiudi tutte le connessioni
    for (const [clientId, client] of this.clients) {
      this.disconnectClient(clientId, 'Server shutdown');
    }
    this.clients.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
    }

    console.log('🛑 Server stopped');
  }

  /**
   * Simula connessione di un client (per testing)
   */
  simulateClientConnection(clientId: string, playerId: string, playerName: string): void {
    if (this.clients.size >= this.maxPlayers) {
      console.warn('⚠️ Max players reached, rejecting connection');
      return;
    }

    const mockSocket = {
      send: (data: string) => {
        // Simula invio messaggio al client
        console.log(`📤 Sent to ${clientId}:`, data.length, 'bytes');
      },
      close: (code: number, reason: string) => {
        console.log(`🔌 Client ${clientId} disconnected:`, reason);
      },
      readyState: 1 // OPEN
    };

    const client: ConnectedClient = {
      id: clientId,
      playerId,
      playerName,
      socket: mockSocket,
      lastMessageTime: Date.now(),
      latency: 0
    };

    this.clients.set(clientId, client);
    console.log(`👋 Client ${clientId} (${playerName}) connected`);

    // Invia welcome message
    this.sendWelcomeMessage(client);

    this.onClientConnected?.(clientId, playerId);
  }

  /**
   * Simula ricezione messaggio da un client (per testing)
   */
  simulateClientMessage(clientId: string, message: NetworkMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`⚠️ Unknown client: ${clientId}`);
      return;
    }

    client.lastMessageTime = Date.now();

    try {
      switch (message.type) {
        case NetworkMessageType.CLIENT_JOIN:
          this.handleClientJoin(client, message as ClientJoinMessage);
          break;

        case NetworkMessageType.CLIENT_LEAVE:
          this.handleClientLeave(client, message as ClientLeaveMessage);
          break;

        case NetworkMessageType.INPUT_COMMAND:
          this.handleInputCommand(client, message as InputCommandMessage);
          break;

        case NetworkMessageType.PING:
          this.handlePing(client, message as any);
          break;

        default:
          console.warn(`⚠️ Unknown message type from ${clientId}:`, message.type);
      }
    } catch (error) {
      console.error(`❌ Error handling message from ${clientId}:`, error);
      this.sendErrorMessage(client, 'INVALID_MESSAGE', 'Failed to process message');
    }
  }

  /**
   * Simula disconnessione client
   */
  simulateClientDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.disconnectClient(clientId, 'Client disconnect');
    }
  }

  private handleClientJoin(client: ConnectedClient, message: ClientJoinMessage): void {
    // Aggiorna info client se necessario
    client.playerName = message.playerName;
    console.log(`🎮 Player ${message.playerId} joined as ${message.playerName}`);
  }

  private handleClientLeave(client: ConnectedClient, message: ClientLeaveMessage): void {
    this.disconnectClient(client.id, 'Client leave');
  }

  private handleInputCommand(client: ConnectedClient, message: InputCommandMessage): void {
    // Valida comando
    if (message.playerId !== client.playerId) {
      this.sendErrorMessage(client, 'INVALID_PLAYER_ID', 'Player ID mismatch');
      return;
    }

    // Evita duplicati (command replay)
    if (this.processedCommandIds.has(message.command.id)) {
      console.log(`🔄 Duplicate command ${message.command.id} ignored`);
      return;
    }

    // Valida tick con tolleranza aumentata per latenza
    const serverTick = this.gameContext.tickManager.getCurrentTick();
    const tickDifference = message.clientTick - serverTick;

    if (Math.abs(tickDifference) > 15) { // Tolleranza aumentata a 15 tick
      console.warn(`⚠️ Command from ${client.id} rejected: tick diff ${tickDifference} (${message.clientTick} vs ${serverTick})`);
      this.sendErrorMessage(client, 'INVALID_TICK', `Command tick too old/future: ${tickDifference}`);
      return;
    }

    // Buffer comando per esecuzione ordinata
    this.bufferCommand(message);

    // Elabora immediatamente se siamo nel tick corrente (per compatibilità con test)
    const currentTick = this.gameContext.tickManager.getCurrentTick();
    if (message.clientTick <= currentTick) {
      this.executeBufferedCommand(message);
      this.commandBuffer.shift(); // Rimuovi dal buffer se già elaborato
    }

    console.log(`📦 Buffered command from ${client.id}: ${message.command.type} (tick: ${message.clientTick})`);
  }

  /**
   * Aggiunge un comando al buffer ordinato per tick
   */
  private bufferCommand(message: InputCommandMessage): void {
    // Inserisci comando nel buffer mantenendo ordine per tick
    const insertIndex = this.commandBuffer.findIndex(cmd => cmd.clientTick > message.clientTick);
    if (insertIndex === -1) {
      this.commandBuffer.push(message);
    } else {
      this.commandBuffer.splice(insertIndex, 0, message);
    }
  }

  /**
   * Processa i comandi bufferizzati per il tick corrente
   */
  private processBufferedCommands(): void {
    const currentTick = this.gameContext.tickManager.getCurrentTick();

    // Processa comandi fino al tick corrente (evitando duplicati)
    while (this.commandBuffer.length > 0) {
      const nextCommand = this.commandBuffer[0];
      if (nextCommand.clientTick > currentTick) break;

      // executeBufferedCommand gestisce già i duplicati
      this.executeBufferedCommand(nextCommand);
      this.commandBuffer.shift();
    }
  }

  /**
   * Esegue un comando bufferizzato
   */
  private executeBufferedCommand(message: InputCommandMessage): void {
    // Evita elaborazione duplicata
    if (this.processedCommandIds.has(message.command.id)) {
      return;
    }

    // Marca come elaborato
    this.processedCommandIds.add(message.command.id);

    console.log(`⚙️ Executing buffered command: ${message.command.type} at tick ${message.clientTick}`);

    // Notifica sistemi interessati per elaborazione
    this.onCommandReceived?.(message);
  }

  private handlePing(client: ConnectedClient, message: any): void {
    // Rispondi con pong
    const pongMessage = NetworkMessageFactory.createPong(message.sequence);
    this.sendMessage(client, pongMessage);
  }

  private sendWelcomeMessage(client: ConnectedClient): void {
    const message = NetworkMessageFactory.createServerWelcome(
      this.gameContext.tickManager.getCurrentTick(),
      NETWORK_PROTOCOL_CONFIG.SNAPSHOT_INTERVAL,
      this.maxPlayers,
      Array.from(this.clients.keys()),
      client.playerId // Passa il playerId assegnato al client
    );

    // Includi lo stato completo del mondo per la riconnessione
    const fullSnapshot = this.gameContext.createSnapshot();
    if (fullSnapshot) {
      (message as any).initialWorldState = {
        entityStates: fullSnapshot.getAllEntityStates(),
        tick: fullSnapshot.tick,
        timestamp: fullSnapshot.timestamp
      };
    }

    this.sendMessage(client, message);
  }

  private sendErrorMessage(client: ConnectedClient, errorCode: string, errorMessage: string): void {
    const message = NetworkMessageFactory.createError(errorCode, errorMessage);
    this.sendMessage(client, message);
  }

  private sendMessage(client: ConnectedClient, message: NetworkMessage): void {
    try {
      const data = NetworkProtocol.serialize(message);
      client.socket.send(data);
    } catch (error) {
      console.error(`❌ Failed to send message to ${client.id}:`, error);
    }
  }

  /**
   * Invia snapshot a tutti i client connessi
   */
  broadcastSnapshot(): void {
    const currentTick = this.gameContext.tickManager.getCurrentTick();

    // Invia snapshot solo ogni N tick
    if (currentTick - this.lastSnapshotTick < NETWORK_PROTOCOL_CONFIG.SNAPSHOT_INTERVAL) {
      return;
    }

    const snapshot = this.gameContext.createSnapshot();
    if (!snapshot) return;

    console.log(`📡 Broadcasting snapshot: tick ${currentTick}, ${snapshot.getEntityCount()} entities`);

    const processedCommands = Array.from(this.processedCommandIds);
    const message = NetworkMessageFactory.createWorldSnapshot(
      currentTick,
      snapshot,
      processedCommands
    );

    // Invia a tutti i client
    for (const [clientId, client] of this.clients) {
      try {
        this.sendMessage(client, message);
        console.log(`📤 Sent snapshot to ${clientId}`);
      } catch (error) {
        console.error(`❌ Failed to send snapshot to ${clientId}:`, error);
        this.disconnectClient(clientId, 'Send failed');
      }
    }

    this.lastSnapshotTick = currentTick;

    // Pulisci vecchi command ID (mantieni ultimi 1000)
    if (this.processedCommandIds.size > 1000) {
      // In un'implementazione reale, manterremmo solo gli ultimi N
      this.processedCommandIds.clear();
    }
  }

  /**
   * Invia sincronizzazione tick a tutti i client
   */
  broadcastTickSync(): void {
    const message = NetworkMessageFactory.createTickSync(
      this.gameContext.tickManager.getCurrentTick(),
      Date.now()
    );

    for (const [clientId, client] of this.clients) {
      try {
        this.sendMessage(client, message);
      } catch (error) {
        console.error(`❌ Failed to send tick sync to ${clientId}:`, error);
        this.disconnectClient(clientId, 'Send failed');
      }
    }
  }

  private disconnectClient(clientId: string, reason: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.socket.close(1000, reason);
      this.clients.delete(clientId);
      this.onClientDisconnected?.(clientId, client.playerId);
      console.log(`👋 Client ${clientId} disconnected: ${reason}`);
    }
  }

  /**
   * Imposta callback per connessione client
   */
  setOnClientConnected(callback: (clientId: string, playerId: string) => void): void {
    this.onClientConnected = callback;
  }

  /**
   * Imposta callback per disconnessione client
   */
  setOnClientDisconnected(callback: (clientId: string, playerId: string) => void): void {
    this.onClientDisconnected = callback;
  }

  /**
   * Imposta callback per comando ricevuto
   */
  setOnCommandReceived(callback: (command: InputCommandMessage) => void): void {
    this.onCommandReceived = callback;
  }

  /**
   * Ottiene numero di client connessi
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Ottiene lista player connessi
   */
  getConnectedPlayerIds(): string[] {
    return Array.from(this.clients.values()).map(c => c.playerId);
  }

  /**
   * Verifica se server è in esecuzione
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  update(deltaTime: number, tick: number): void {
    // Processa comandi bufferizzati prima di tutto
    this.processBufferedCommands();

    // Broadcasting periodico
    this.broadcastSnapshot();

    // Tick sync ogni tanto (opzionale, per ora disabilitato)
    // this.broadcastTickSync();

    // Gestione timeout client
    const now = Date.now();
    for (const [clientId, client] of this.clients) {
      if (now - client.lastMessageTime > NETWORK_PROTOCOL_CONFIG.TIMEOUT_THRESHOLD) {
        console.warn(`⚠️ Client ${clientId} timeout`);
        this.disconnectClient(clientId, 'Timeout');
      }
    }
  }
}
