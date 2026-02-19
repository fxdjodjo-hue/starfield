import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { ProjectileFiredMessage, MissileTier } from '../../../config/NetworkConfig';
import { ProjectileFactory } from '../../../core/domain/ProjectileFactory';
import { Damage } from '../../../entities/combat/Damage';

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

        /*
        console.log('[DEBUG_PROJECTILE] Received projectile_fired message:', {
          projectileId: message.projectileId,
          playerId: message.playerId,
          position: message.position,
          projectileType: message.projectileType,
          isLocalPlayer: isLocalPlayer,
          localAuthId: localAuthId,
          localClientId: localClientId
        });
        */

        // Missile logic removed - missiles are no longer supported

        // Helper to check if projectile is a missile
        const isMissile = message.projectileType === 'missile' ||
            message.projectileType === 'm1' ||
            message.projectileType === 'm2' ||
            message.projectileType === 'm3';

        // Gestisci audio e visualizzazione per tutti i proiettili
        const audioSystem = networkSystem.getAudioSystem();
        if (audioSystem) {
            if (message.playerId.startsWith('npc_')) {
                // FIX SPAZIALE: Usa playSoundAt per i proiettili NPC per attenuare quelli lontani
                audioSystem.playSoundAt(
                    'scouterLaser',
                    message.position.x,
                    message.position.y,
                    { volume: 0.05, allowMultiple: true, category: 'effects' }
                );
            } else if (isMissile) {
                // NUOVO: Suono lancio missile (sia per local player che remoti)
                // Usa playSoundAt per spazialità
                audioSystem.playSoundAt(
                    'missile',
                    message.position.x,
                    message.position.y,
                    { volume: 0.1, allowMultiple: true, category: 'effects' }
                );
            } else if (message.projectileType === 'pet_laser') {
                audioSystem.playSoundAt(
                    'laser',
                    message.position.x,
                    message.position.y,
                    { volume: 0.05, allowMultiple: true, category: 'effects' }
                );
            }
            // Suono laser player gestito lato client nei laser visivi per responsività immediata
        }

        // COOLDOWN UI & AMMO CONSUMPTION: Per i missili del player locale
        if (isLocalPlayer && isMissile) {
            const playerSystem = networkSystem.getPlayerSystem();
            if (playerSystem) {
                const playerEntity = playerSystem.getPlayerEntity();
                if (playerEntity) {
                    const ecs = networkSystem.getECS();
                    if (ecs) {
                        const playerDamage = ecs.getComponent(playerEntity, Damage);
                        if (playerDamage) {
                            (playerDamage as any).lastMissileTime = Date.now();
                        }
                    }
                }
            }

            // CRITICAL FIX: Consuma munizioni missile lato client inviando richiesta di vendita
            // Questo è un workaround perché il server non sembra scalare le munizioni correttamente
            let tier: MissileTier = 'm1';
            if (message.projectileType === 'm2') tier = 'm2';
            if (message.projectileType === 'm3') tier = 'm3';

            // Invia richiesta di consumo (vendita 1 unità)
            networkSystem.sendSellMissileRequest(tier, 1);
        }

        // OTTIMIZZAZIONE: Per i laser del giocatore locale, ignoriamo il messaggio di ritorno dal server
        // perché abbiamo già creato il laser locale per responsività immediata in CombatStateSystem.
        // MA per i MISSILI (che sono auto-fire dal server), dobbiamo processarli anche per il player locale!
        if (isLocalPlayer && !isMissile) {
            // Skip self-broadcast to avoid duplication - local laser already created
            return;
        }

        // OTTIMIZZAZIONE: Per i laser dei giocatori (locali o remoti), usiamo la simulazione locale
        // in CombatStateSystem. Ignoriamo il messaggio 'projectile_fired' dal server per i laser
        // per evitare duplicazioni, flicker e lag visivo.
        if (message.projectileType === 'laser' || message.projectileType.startsWith('lb')) {
            // if (import.meta.env.DEV) console.log(`[DEBUG_PROJECTILE] Skipping visual for ${isLocalPlayer ? 'local' : 'remote'} player laser (handled by simulation)`);
            return;
        }

        // Mostra proiettile per gli altri casi (NPC o proiettili non-laser)
        this.showProjectile(message, networkSystem, isLocalPlayer);
    }

    private showProjectile(message: ProjectileFiredMessage, networkSystem: ClientNetworkSystem, isLocalPlayer: boolean): void {
        /*
        console.log('[DEBUG_PROJECTILE] showProjectile called for:', {
          projectileId: message.projectileId,
          playerId: message.playerId,
          projectileType: message.projectileType,
          isLocalPlayer: isLocalPlayer
        });
        */

        // UNIFICATO: Crea proiettili remoti direttamente con ProjectileFactory
        // Ora tutti i proiettili seguono lo stesso flusso del ProjectileSystem

        const ecs = networkSystem.getECS();
        if (!ecs) {
            // console.log('[DEBUG_PROJECTILE] ECS not available');
            return;
        }

        // Per i proiettili del giocatore locale, usa posizione centrata sul player locale
        // per evitare disallineamenti dovuti alla latenza di rete
        let projectilePosition = message.position;

        if (isLocalPlayer && message.projectileType === 'missile') {
            // Usa posizione del player locale invece di quella del server
            const localPlayerPos = networkSystem.getLocalPlayerPosition();
            projectilePosition = {
                x: localPlayerPos.x,
                y: localPlayerPos.y
            };
            // console.log('[DEBUG_PROJECTILE] Using local player position:', localPlayerPos);
        }


        // Ottieni AssetManager dal GameContext (robusto contro minificazione in produzione)
        const assetManager = networkSystem.gameContext.assetManager;

        // console.log('[DEBUG_PROJECTILE] Creating remote projectile via RemoteProjectileSystem');

        // FIX: Usa RemoteProjectileSystem per creare e TRACCIARE il proiettile
        // Questo è fondamentale affinché possa essere rimosso successivamente da ProjectileDestroyedHandler
        const remoteProjectileSystem = networkSystem.getRemoteProjectileSystem();
        if (remoteProjectileSystem) {
            remoteProjectileSystem.addRemoteProjectile(
                message.projectileId,
                message.playerId,
                projectilePosition,
                message.velocity,
                message.damage,
                message.projectileType,
                message.targetId || undefined,
                isLocalPlayer,
                assetManager,
                networkSystem.getLocalClientId(),
                networkSystem.gameContext.authId ? String(networkSystem.gameContext.authId) : null,
                message.hitTime ?? null,
                !!message.isDeterministic
            );
        } else {
            console.error('[ProjectileFiredHandler] RemoteProjectileSystem not found! Projectile will NOT be tracked.');
            // Fallback (non tracciato, quindi non potrà essere distrutto esplicitamente)
            ProjectileFactory.createRemoteUnified(
                ecs,
                message.projectileId,
                message.playerId,
                projectilePosition,
                message.velocity,
                message.damage,
                message.projectileType,
                message.targetId || undefined,
                undefined,
                assetManager
            );
        }
    }
}
