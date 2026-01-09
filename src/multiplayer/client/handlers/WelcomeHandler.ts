import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { PlayerUpgrades } from '../../../entities/player/PlayerUpgrades';

/**
 * Handles welcome messages from the server
 * Sets the local client ID and initial state when the server welcomes the player
 * (Server Authoritative - riceve lo stato iniziale dal server)
 */
export class WelcomeHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.WELCOME);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
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

      const { inventory, upgrades } = message.initialState;

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

      // Sincronizza gli upgrade del player con lo stato server
      const playerSystem = networkSystem.getPlayerSystem();
      if (playerSystem && upgrades) {
        const playerEntity = playerSystem.getPlayerEntity();
        if (playerEntity) {
          const playerUpgrades = networkSystem.getECS().getComponent(playerEntity, PlayerUpgrades);
          if (playerUpgrades) {
            // Imposta gli upgrade ricevuti dal server
            playerUpgrades.setUpgrades(upgrades.hpUpgrades, upgrades.shieldUpgrades, upgrades.speedUpgrades, upgrades.damageUpgrades);
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
