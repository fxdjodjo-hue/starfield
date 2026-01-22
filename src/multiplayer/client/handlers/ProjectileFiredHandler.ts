import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { ProjectileFiredMessage } from '../../../config/NetworkConfig';
import { ProjectileFactory } from '../../../core/domain/ProjectileFactory';
import { CombatStateSystem } from '../../../systems/combat/CombatStateSystem';

/**
 * Gestisce il messaggio projectile_fired quando un giocatore spara
 */
export class ProjectileFiredHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PROJECTILE_FIRED);
  }

  handle(message: ProjectileFiredMessage, networkSystem: ClientNetworkSystem): void {
    // Identifica il giocatore locale usando controllo ibrido (authId + localClientId)
    // Per robustezza: usa entrambi gli identificatori per evitare mismatch
    const localAuthId = networkSystem.gameContext.authId;
    const localClientId = networkSystem.getLocalClientId();
    const isLocalPlayer = message.playerId === String(localAuthId) || message.playerId === String(localClientId);

    console.log('[DEBUG_PROJECTILE] Received projectile_fired message:', {
      projectileId: message.projectileId,
      playerId: message.playerId,
      position: message.position,
      projectileType: message.projectileType,
      isLocalPlayer: isLocalPlayer,
      localAuthId: localAuthId,
      localClientId: localClientId
    });

    // Missile logic removed - missiles are no longer supported

    // Gestisci audio e visualizzazione per tutti i proiettili
    const audioSystem = networkSystem.getAudioSystem();
    if (audioSystem) {
      if (message.playerId.startsWith('npc_')) {
        // Suono NPC gestito quando arrivano i loro proiettili dal server
        audioSystem.playSound('scouterLaser', 0.05, false, true);
      }
      // Suono laser player gestito lato client nei laser visivi per responsività immediata
    }

    // ✅ OTTIMIZZAZIONE: Per il giocatore locale, ignoriamo il messaggio di ritorno dal server
    // perché abbiamo già creato il laser locale per responsività immediata in CombatStateSystem.
    // Questo evita duplicazioni e il bug del "laser fermo" (static laser).
    if (isLocalPlayer) {
      if (import.meta.env.DEV) console.log('[DEBUG_PROJECTILE] Skipping self-broadcast to avoid duplication');
      return;
    }

    // ✅ OTTIMIZZAZIONE: Per i laser dei giocatori (locali o remoti), usiamo la simulazione locale
    // in CombatStateSystem. Ignoriamo il messaggio 'projectile_fired' dal server per i laser
    // per evitare duplicazioni, flicker e lag visivo.
    if (message.projectileType === 'laser') {
      if (import.meta.env.DEV) console.log(`[DEBUG_PROJECTILE] Skipping visual for ${isLocalPlayer ? 'local' : 'remote'} player laser (handled by simulation)`);
      return;
    }

    // Mostra proiettile per gli altri casi (NPC o proiettili non-laser)
    this.showProjectile(message, networkSystem, isLocalPlayer);
  }

  private showProjectile(message: ProjectileFiredMessage, networkSystem: ClientNetworkSystem, isLocalPlayer: boolean): void {
    console.log('[DEBUG_PROJECTILE] showProjectile called for:', {
      projectileId: message.projectileId,
      playerId: message.playerId,
      projectileType: message.projectileType,
      isLocalPlayer: isLocalPlayer
    });

    // ✅ UNIFICATO: Crea proiettili remoti direttamente con ProjectileFactory
    // Ora tutti i proiettili seguono lo stesso flusso del ProjectileSystem

    const ecs = networkSystem.getECS();
    if (!ecs) {
      console.log('[DEBUG_PROJECTILE] ECS not available');
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
      console.log('[DEBUG_PROJECTILE] Using local player position:', localPlayerPos);
    }


    // Ottieni AssetManager dal RenderSystem
    let assetManager = null;
    try {
      const systems = ecs.getSystems();
      console.log('[DEBUG_PROJECTILE] Looking for RenderSystem among', systems.length, 'systems');
      for (const system of systems) {
        console.log('[DEBUG_PROJECTILE] System:', system.constructor.name);
        if (system.constructor.name === 'RenderSystem') {
          console.log('[DEBUG_PROJECTILE] Found RenderSystem, calling getAssetManager');
          assetManager = (system as any).getAssetManager();
          console.log('[DEBUG_PROJECTILE] AssetManager from RenderSystem:', !!assetManager);
          break;
        }
      }
    } catch (error) {
      console.log('[DEBUG_PROJECTILE] Could not find AssetManager:', error);
    }

    console.log('[DEBUG_PROJECTILE] Creating remote projectile via ProjectileFactory, hasAssetManager:', !!assetManager);
    const entity = ProjectileFactory.createRemoteUnified(
      ecs,
      message.projectileId,
      message.playerId,
      projectilePosition,
      message.velocity,
      message.damage,
      message.projectileType,
      message.targetId || undefined,
      undefined, // ownerId - not used for remote projectiles
      assetManager
    );
    console.log('[DEBUG_PROJECTILE] Remote projectile created, entity ID:', entity.id);

    // ✅ NOTA: Non creiamo più il beam effect qui per i laser dei giocatori remoti
    // perché ora usiamo la Soluzione 2 (Simulazione Locale) in CombatStateSystem.
    // Il ProjectileFactory.createRemoteUnified sopra crea già l'entità "fisica"
    // corrispondente al proiettile del server se fosse necessario per altri scopi.

    // Per i laser NPC (non simulati via CombatStateSystem), il ProjectileFactory 
    // ha già aggiunto lo sprite necessario nel blocco create().
  }


}
