import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { WelcomeMessage } from '../../../config/NetworkConfig';
import { PlayerUpgrades } from '../../../entities/player/PlayerUpgrades';
import { Transform } from '../../../entities/spatial/Transform';
import { ActiveQuest } from '../../../entities/quest/ActiveQuest';
import { Quest } from '../../../entities/quest/Quest';

/**
 * Handles welcome messages from the server
 * Sets the local client ID and initial state when the server welcomes the player
 * (Server Authoritative - riceve lo stato iniziale dal server)
 */
export class WelcomeHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.WELCOME);
  }

  handle(message: WelcomeMessage, networkSystem: ClientNetworkSystem): void {
    console.log('🎉 [WELCOME] WelcomeHandler chiamato con message:', JSON.stringify(message, null, 2));

    // Set the local client ID and player ID from the server
    networkSystem.gameContext.localClientId = message.clientId || networkSystem.clientId;

    // Salva il playerId assegnato dal server (UUID dell'utente)
    if (message.playerId) {
      networkSystem.gameContext.localPlayerId = message.playerId;
      console.log('🎯 [WELCOME] Player ID assegnato dal server:', message.playerId);
    }

    // SERVER AUTHORITATIVE: Ricevi lo stato iniziale dal server
    if (message.initialState) {
      console.log('🎮 [WELCOME] Ricevuto stato iniziale dal server:', message.initialState);

      const { inventory, upgrades, position, quests } = message.initialState;

      // Sincronizza le risorse economiche con lo stato server
      const economySystem = networkSystem.getEconomySystem();
      if (economySystem) {
        console.log('💰 [WELCOME] Applicando stato iniziale server authoritative');

        // Imposta direttamente i valori ricevuti dal server (non somme)
        economySystem.setCredits(inventory.credits, 'server_initial');
        economySystem.setCosmos(inventory.cosmos, 'server_initial');
        economySystem.setExperience(inventory.experience, 'server_initial');
        economySystem.setHonor(inventory.honor, 'server_initial');
        economySystem.setSkillPoints(inventory.skillPoints, 'server_initial');

        console.log('✅ [WELCOME] Stato iniziale sincronizzato con server');
        console.log(`📊 Risorse iniziali: ${inventory.credits} credits, ${inventory.cosmos} cosmos, ${inventory.experience} XP, ${inventory.honor} honor, ${inventory.skillPoints} skillPoints`);
      }

      // IMPORTANTE: Segna che abbiamo ricevuto il welcome, possiamo ora mandare position updates
      networkSystem.setHasReceivedWelcome(true);

      // Se abbiamo una posizione pending, mandala ora
      const pendingPosition = networkSystem.getPendingPosition();
      if (pendingPosition) {
        console.log('📍 [WELCOME] Sending pending position after welcome:', pendingPosition);
        networkSystem.sendPlayerPosition(pendingPosition);
        networkSystem.clearPendingPosition();
      }

      // Sincronizza gli upgrade del player con lo stato server
      const playerSystem = networkSystem.getPlayerSystem();
      let playerEntity: any = null;

      if (playerSystem) {
        playerEntity = playerSystem.getPlayerEntity();

        // IMPORTANTE: Dopo la prima sincronizzazione, NON sovrascrivere mai la posizione del player
      // Il welcome può essere inviato più volte dal server per aggiornamenti, ma il player
      // deve mantenere la sua posizione di gioco corrente

      // Invalidate position cache when receiving welcome (position might have changed)
      // This ensures the position tracker finds the correct current position
      networkSystem.invalidatePositionCache();

      if (playerEntity && position && !networkSystem.getHasReceivedWelcome()) {
        const transform = networkSystem.getECS().getComponent(playerEntity, Transform);
        if (transform) {
          // Solo al primo welcome, applica la posizione iniziale
          console.log('📍 [WELCOME] Applicando posizione iniziale server authoritative:', position);
          transform.x = position.x;
          transform.y = position.y;
          transform.rotation = position.rotation || 0;
          console.log('✅ [WELCOME] Posizione iniziale sincronizzata con server');
        }
      } else if (networkSystem.getHasReceivedWelcome()) {
        console.log('📍 [WELCOME] Welcome già ricevuto, mantenendo posizione corrente del player');
      }

        if (upgrades) {
          if (playerEntity) {
            const playerUpgrades = networkSystem.getECS().getComponent(playerEntity, PlayerUpgrades);
            if (playerUpgrades) {
              // Imposta gli upgrade ricevuti dal server
              playerUpgrades.setUpgrades(upgrades.hpUpgrades, upgrades.shieldUpgrades, upgrades.speedUpgrades, upgrades.damageUpgrades);
            }
          }
        }
      }

      // Sincronizza le quest attive con lo stato server
      if (quests && Array.isArray(quests) && quests.length > 0) {
        if (playerEntity) {
          const activeQuestComponent = networkSystem.getECS().getComponent(playerEntity, ActiveQuest);
          if (activeQuestComponent) {
            console.log('📜 [WELCOME] Sincronizzando quest dal server:', quests.length, 'quest');

            // Converti i dati delle quest in oggetti Quest
            for (const questData of quests) {
              try {
                const quest = new Quest(
                  questData.quest_id || questData.id,
                  questData.title || 'Unknown Quest',
                  questData.description || 'No description',
                  questData.type || 'unknown',
                  questData.objectives || [],
                  questData.rewards || []
                );

                // Imposta lo stato della quest
                if (questData.is_completed) {
                  quest.isCompleted = true;
                  quest.isActive = false;
                } else {
                  quest.isCompleted = false;
                  quest.isActive = true;
                }

                // Aggiungi alla lista delle quest attive
                activeQuestComponent.addQuest(quest);

                console.log(`✅ [WELCOME] Quest caricata: ${quest.title} (${quest.isCompleted ? 'completata' : 'attiva'})`);
              } catch (error) {
                console.error('❌ [WELCOME] Errore caricamento quest:', questData, error);
              }
            }

            console.log('✅ [WELCOME] Quest sincronizzate con server');
          } else {
            console.warn('⚠️ [WELCOME] ActiveQuest component non trovato sul player entity');
          }
        }
      }

      // Potremmo anche sincronizzare health/shield se necessario
      // const { health, maxHealth, shield, maxShield } = message.initialState;
      // ... gestire health/shield se necessario
    }

    // Mostra welcome message nell'interfaccia del gioco (senza "Connected to server")
    const logSystem = networkSystem.getLogSystem();
    if (logSystem && message.message) {
      // Rimuovi "Connected to server" dal messaggio per l'UI
      const uiMessage = message.message.replace(' Connected to server.', '');
      logSystem.logWelcome(uiMessage);
      console.log('🎉 [WELCOME] Player welcomed by server:', message.message);
    }
  }
}
