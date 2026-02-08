// WebSocketConnectionManager - Gestione base delle connessioni WebSocket
// Responsabilità: Setup connessioni, event handlers, message routing
// Dipendenze: logger.cjs, mapServer, messageCount, InputValidator, BoundaryEnforcement

const { logger } = require('../../logger.cjs');
const ServerLoggerWrapper = require('../infrastructure/ServerLoggerWrapper.cjs');
const ServerInputValidator = require('../InputValidator.cjs');
const { BoundaryEnforcement } = require('../../../shared/SecurityBoundary.cjs');
const WebSocket = require('ws');
const { routeMessage } = require('./MessageRouter.cjs');

/**
 * Gestisce le connessioni WebSocket base e il routing dei messaggi
 * TODO: Spostare da websocket-manager.cjs:
 *   - setupConnectionHandling() (linee 336-1179)
 *   - setupShutdownHandling() (linee 1222-1236)
 *   - filterChatMessage() (linee 1262-1284)
 *   - Logica di routing messaggi (tutti i if data.type === ...)
 */
class WebSocketConnectionManager {
  constructor(wss, mapManager, messageCount) {
    this.wss = wss;
    this.mapManager = mapManager;
    this.messageCount = messageCount;
    this.inputValidator = new ServerInputValidator();

    // Logging throttling per performance
    this.validationWarningCount = 0;
    this.lastValidationWarning = 0;
    this.securityWarningCount = 0;
    this.lastSecurityWarning = 0;

    // Dependency injection - verranno impostati dopo la creazione
    this.playerDataManager = null;
    this.authManager = null;
    this.messageBroadcaster = null;
  }

  /**
   * Configura la gestione della chiusura del server
   */
  setupShutdownHandling() {
    process.on('SIGINT', () => {
      ServerLoggerWrapper.info('SERVER', 'Shutting down server...');

      // Cleanup risorse
      if (this.mapManager && this.mapManager.maps) {
        for (const mapInstance of this.mapManager.maps.values()) {
          if (mapInstance.npcManager) {
            mapInstance.npcManager.destroy();
          }
        }
      }

      this.wss.close();
      // Nota: server.close() sarà chiamato dal chiamante (server.cjs)

      logger.info('SERVER', '✅ WebSocket connections closed gracefully');
    });
  }

  /**
   * Filtra i messaggi di chat per sicurezza e appropriatezza
   * Rimuove HTML, filtra parole inappropriate, ecc.
   */
  filterChatMessage(content) {
    // Rimuovi tag HTML per sicurezza
    let filtered = content.replace(/<[^>]*>/g, '');

    // Lista base di parole inappropriate (espandi secondo necessità)
    const badWords = [
      // Aggiungi parole inappropriate qui quando necessario
      // Esempio: 'badword1', 'badword2'
    ];

    // Filtraggio parole inappropriate (case insensitive)
    badWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      filtered = filtered.replace(regex, '***');
    });

    // Limita lunghezza massima per sicurezza
    if (filtered.length > 200) {
      filtered = filtered.substring(0, 200) + '...';
    }

    return filtered;
  }

  /**
   * Configura la gestione delle connessioni WebSocket
   * Gestisce tutti i tipi di messaggio e il routing
   */
  setupConnectionHandling() {
    if (!this.playerDataManager || !this.authManager || !this.messageBroadcaster) {
      throw new Error('WebSocketConnectionManager: playerDataManager, authManager, and messageBroadcaster must be set before setupConnectionHandling()');
    }

    this.wss.on('connection', (ws) => {
      // PLAYTEST: Limite massimo distibuted across maps
      const defaultMap = this.mapManager.getMap('palantir');
      if (defaultMap && defaultMap.players.size >= 15) {
        ServerLoggerWrapper.warn('SERVER', `🚫 Connection rejected: Default map full (${defaultMap.players.size}/15 players)`);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Server pieno (playtest) - Riprova più tardi',
          code: 'SERVER_FULL'
        }));
        ws.close(1013, 'Server full'); // 1013 = Try Again Later
        return;
      }

      // Client connection logging removed for cleaner production console
      let playerData = null;

      // Gestisce messaggi dal client
      ws.on('message', async (message) => {
        // SECURITY BOUNDARY: treat all inbound fields as untrusted client input.
        this.messageCount.increment();
        try {
          const data = JSON.parse(message.toString());

          // INPUT VALIDATION: valida struttura messaggio
          const structureValidation = this.inputValidator.validateMessageStructure(data);
          if (!structureValidation.isValid) {
            ServerLoggerWrapper.debug('VALIDATION', `Invalid message structure from ${data.clientId || 'unknown'}: ${structureValidation.errors.join(', ')}`);
            return;
          }

          // INPUT VALIDATION: valida contenuto specifico
          const contentValidation = this.inputValidator.validate(data.type, data);
          if (!contentValidation.isValid) {
            // LOGGING THROTTLING: limita logging per performance ma permetti throughput
            this.validationWarningCount++;
            const now = Date.now();
            if (now - this.lastValidationWarning > 5000 || this.validationWarningCount % 50 === 0) {
              const clientInfo = data.clientId || 'unknown';
              const summary = `${this.validationWarningCount} invalid messages in last period`;
              ServerLoggerWrapper.debug('VALIDATION', `Invalid content from ${clientInfo} (${data.type}): ${contentValidation.errors[0]}... (${summary})`);
              this.lastValidationWarning = now;
              this.validationWarningCount = 0; // Reset counter
            }
            return;
          }

          // SECURITY BOUNDARY: verifica intent del client
          const intentValidation = BoundaryEnforcement.validateClientIntent(data.type, data);
          if (!intentValidation.allowed) {
            // LOGGING THROTTLING: limita logging security per performance
            this.securityWarningCount++;
            const now = Date.now();
            if (now - this.lastSecurityWarning > 5000 || this.securityWarningCount % 5 === 0) {
              const clientInfo = data.clientId || 'unknown';
              const summary = `${this.securityWarningCount} security violations in last period`;
              ServerLoggerWrapper.warn('SECURITY', `Intent violation from ${clientInfo}: ${intentValidation.reason} (${summary})`);
              this.lastSecurityWarning = now;
              this.securityWarningCount = 0; // Reset counter
            }
            return;
          }

          // Usa dati sanitizzati per elaborazione successiva
          const sanitizedData = contentValidation.sanitizedData;

          // Route messaggio al handler appropriato
          const playerMapInfo = this.mapManager.findPlayerMap(data.clientId);
          const currentMapServer = playerMapInfo ? playerMapInfo.mapInstance : this.mapManager.getMap('palantir');

          const context = {
            ws,
            playerData,
            mapServer: currentMapServer,
            mapManager: this.mapManager,
            playerDataManager: this.playerDataManager,
            authManager: this.authManager,
            messageBroadcaster: this.messageBroadcaster,
            filterChatMessage: (content) => this.filterChatMessage(content)
          };

          // Gestisce join separatamente perché ritorna playerData
          if (data.type === 'join') {
            const result = await routeMessage({
              type: data.type,
              data,
              sanitizedData,
              context
            });
            // join ritorna playerData se successo, null se errore
            if (result) {
              playerData = result;
            }
          } else {
            // Aggiorna playerData nel context prima di route (per messaggi dopo join)
            context.playerData = playerData || (currentMapServer ? currentMapServer.players.get(data.clientId) : null);

            // Route tutti gli altri messaggi
            await routeMessage({
              type: data.type,
              data,
              sanitizedData,
              context
            });
          }

        } catch (error) {
          // Enhanced error handling for WebSocket messages
          const errorDetails = {
            message: error.message,
            stack: error.stack,
            rawMessage: message.toString().substring(0, 200), // Limit log size
            timestamp: new Date().toISOString(),
            clientInfo: 'unknown'
          };

          // Try to extract client info from raw message for better debugging
          try {
            const rawData = JSON.parse(message.toString());
            if (rawData.clientId) {
              errorDetails.clientInfo = rawData.clientId;
            }
          } catch (parseError) {
            // Raw message wasn't valid JSON, keep as 'unknown'
          }

          ServerLoggerWrapper.error('WEBSOCKET', `Message processing error from ${errorDetails.clientInfo}`, {
            error: error.message,
            rawMessage: errorDetails.rawMessage,
            timestamp: errorDetails.timestamp
          });

          // For critical errors, consider disconnecting the client
          if (error.message.includes('Invalid JSON') || error.message.includes('Maximum call stack')) {
            ServerLoggerWrapper.warn('WEBSOCKET', `Disconnecting client ${errorDetails.clientInfo} due to critical error`);
            try {
              ws.close(1003, 'Protocol error'); // 1003 = Unsupported data
            } catch (closeError) {
              ServerLoggerWrapper.error('WEBSOCKET', `Failed to close WebSocket connection: ${closeError.message}`);
            }
          }
        }
      });

      ws.on('close', async () => {
        if (playerData) {
          ServerLoggerWrapper.info('PLAYER', `Player left: ${playerData.playerId}`);

          // Salva i dati del giocatore prima della disconnessione
          try {
            ServerLoggerWrapper.database(`Saving player data on disconnect for ${playerData.userId}`);
            await this.playerDataManager.savePlayerData(playerData);
          } catch (saveError) {
            ServerLoggerWrapper.error('DATABASE', `Failed to save player data on disconnect: ${saveError.message}`);
          }

          // CLEANUP: Rimuovi SEMPRE il giocatore dalla mappa, anche se il salvataggio fallisce
          const playerMapInfo = this.mapManager.findPlayerMap(playerData.clientId);
          if (playerMapInfo) {
            const mapServer = playerMapInfo.mapInstance;

            // Broadcast player left
            try {
              const playerLeftMsg = this.messageBroadcaster.formatPlayerLeftMessage(playerData.clientId);
              mapServer.broadcastToMap(playerLeftMsg);
            } catch (broadcastError) {
              ServerLoggerWrapper.error('WEBSOCKET', `Failed to broadcast player left: ${broadcastError.message}`);
            }

            mapServer.removePlayer(playerData.clientId);

            // Rimuovi anche dalla queue degli aggiornamenti posizione
            mapServer.positionUpdateQueue.delete(playerData.clientId);

            // Rimuovi stato riparazione
            if (mapServer.repairManager) {
              mapServer.repairManager.removePlayer(playerData.clientId);
            }

            ServerLoggerWrapper.debug('SERVER', `Remaining players in ${playerMapInfo.mapId}: ${mapServer.players.size}`);
          }
        } else {
          ServerLoggerWrapper.warn('PLAYER', 'Unknown client disconnected');
        }
      });

      ws.on('error', (error) => {
        ServerLoggerWrapper.error('WEBSOCKET', `WebSocket error: ${error.message}`);
      });
    });
  }

  /**
   * Imposta il PlayerDataManager per operazioni database
   */
  setPlayerDataManager(playerDataManager) {
    this.playerDataManager = playerDataManager;
  }

  /**
   * Imposta l'AuthenticationManager per security e helper
   */
  setAuthManager(authManager) {
    this.authManager = authManager;
  }

  /**
   * Imposta il MessageBroadcaster per invio messaggi
   */
  setMessageBroadcaster(messageBroadcaster) {
    this.messageBroadcaster = messageBroadcaster;
  }
}

module.exports = WebSocketConnectionManager;
