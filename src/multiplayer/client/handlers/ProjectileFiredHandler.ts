import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { ProjectileFiredMessage } from '../../../config/NetworkConfig';

/**
 * Gestisce il messaggio projectile_fired quando un giocatore spara
 */
export class ProjectileFiredHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PROJECTILE_FIRED);
  }

  handle(message: ProjectileFiredMessage, networkSystem: ClientNetworkSystem): void {
    // DEBUG: Log per vedere se i messaggi vengono ricevuti
    console.log(`[PROJECTILE_DEBUG] Received projectile: id=${message.projectileId}, playerId=${message.playerId}, type=${message.projectileType}, isLocalPlayer=${message.playerId === String(networkSystem.gameContext.authId) || message.playerId === String(networkSystem.getLocalClientId())}`);

    // Identifica il giocatore locale usando controllo ibrido (authId + localClientId)
    // Per robustezza: usa entrambi gli identificatori per evitare mismatch
    const localAuthId = networkSystem.gameContext.authId;
    const localClientId = networkSystem.getLocalClientId();
    const isLocalPlayer = message.playerId === String(localAuthId) || message.playerId === String(localClientId);

    // DEBUG: Log per identificare mismatch negli ID
    if (message.projectileType === 'laser' && !message.playerId.startsWith('npc_')) {
      console.log(`[PLAYER_PROJECTILE_DEBUG] Player projectile - message.playerId=${message.playerId}, localAuthId=${localAuthId}, localClientId=${localClientId}, isLocalPlayer=${isLocalPlayer}`);
    }

    // Per missili del giocatore locale, non aggiungere a RemoteProjectileSystem
    // perché sono già creati localmente via ProjectileFactory
    if (isLocalPlayer && message.projectileType === 'missile') {
      return;
    }

    // Registra quando un missile viene sparato per evitare di riprodurre il suono di esplosione troppo presto
    if (message.projectileType === 'missile') {
      const destroyedHandler = networkSystem.getMessageRouter()?.getHandler(MESSAGE_TYPES.PROJECTILE_DESTROYED);
      if (destroyedHandler && typeof (destroyedHandler as any).registerMissileFire === 'function') {
        (destroyedHandler as any).registerMissileFire(message.projectileId, Date.now());
      }
    }

    // Gestisci audio e visualizzazione per tutti i proiettili
    const audioSystem = networkSystem.getAudioSystem();
    if (audioSystem) {
      if (message.playerId.startsWith('npc_')) {
        audioSystem.playSound('scouterLaser', 0.05, false, true);
      } else if (message.projectileType === 'missile') {
        audioSystem.playSound('rocketStart', 0.02, false, true);
      } else if (isLocalPlayer) {
        audioSystem.playSound('laser', 0.05, false, true);
      }
    }

    // Mostra proiettile per tutti (player locale incluso)
    // Tutti i proiettili vengono gestiti dal server e RemoteProjectileSystem
    if (message.projectileType !== 'missile' || !isLocalPlayer) {
      // Missili locali sono già creati dal MissileManager, evita duplicazione
      this.showProjectile(message, networkSystem, isLocalPlayer);
    }
  }

  private showProjectile(message: ProjectileFiredMessage, networkSystem: ClientNetworkSystem, isLocalPlayer: boolean): void {
    // DEBUG: Log per vedere se viene chiamato
    console.log(`[CLIENT_PROJECTILE_DEBUG] Showing projectile: id=${message.projectileId}, playerId=${message.playerId}, isLocalPlayer=${isLocalPlayer}`);

    // ✅ TUTTI i proiettili (incluso quelli del player) vengono gestiti dal RemoteProjectileSystem
    // Il server è autoritativo per tutti i proiettili - niente creazione locale per il player

    const remoteProjectileSystem = networkSystem.getRemoteProjectileSystem();
    if (!remoteProjectileSystem) {
      return;
    }

    // Per i proiettili del giocatore locale, usa posizione centrata sul player locale
    // per evitare disallineamenti dovuti alla latenza di rete
    let projectilePosition = message.position;

    if (isLocalPlayer) {
      // Usa posizione del player locale invece di quella del server
      const localPlayerPos = networkSystem.getLocalPlayerPosition();
      projectilePosition = {
        x: localPlayerPos.x,
        y: localPlayerPos.y
      };
    }

    remoteProjectileSystem.addRemoteProjectile(
      message.projectileId,
      message.playerId,
      projectilePosition,
      message.velocity,
      message.damage,
      message.projectileType,
      message.targetId,
      isLocalPlayer // Passa flag per indicare se è il player locale
    );
  }
}
