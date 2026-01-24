// HazardManager - Gestione pericoli ambientali server-authoritative
// Responsabilità: Verifica confini mappa e applica danno da radiazioni

const ServerLoggerWrapper = require('../core/infrastructure/ServerLoggerWrapper.cjs');

class HazardManager {
    constructor(mapServer) {
        this.mapServer = mapServer;
        this.playerHazardStates = new Map(); // clientId -> { lastDamageTime }
        this.DAMAGE_INTERVAL = 1000;
        this.RADIATION_DAMAGE = 1000;
    }

    /**
     * Aggiorna logica hazards per tutti i player
     */
    updateHazards(now) {
        const BOUNDS_LEFT = -this.mapServer.WORLD_WIDTH / 2;
        const BOUNDS_RIGHT = this.mapServer.WORLD_WIDTH / 2;
        const BOUNDS_TOP = -this.mapServer.WORLD_HEIGHT / 2;
        const BOUNDS_BOTTOM = this.mapServer.WORLD_HEIGHT / 2;

        for (const [clientId, playerData] of this.mapServer.players.entries()) {
            if (playerData.isDead || !playerData.position || !playerData.isFullyLoaded) continue;

            const { x, y } = playerData.position;
            const isOutOfBounds = x < BOUNDS_LEFT || x > BOUNDS_RIGHT || y < BOUNDS_TOP || y > BOUNDS_BOTTOM;

            if (isOutOfBounds) {
                let state = this.playerHazardStates.get(clientId);
                if (!state) {
                    state = { lastDamageTime: now - this.DAMAGE_INTERVAL }; // Danno immediato al primo tick fuori
                    this.playerHazardStates.set(clientId, state);
                }

                if (now - state.lastDamageTime >= this.DAMAGE_INTERVAL) {
                    this.applyRadiationDamage(clientId, playerData, now);
                    state.lastDamageTime = now;
                }
            } else {
                if (this.playerHazardStates.has(clientId)) {
                    this.playerHazardStates.delete(clientId);
                }
            }
        }
    }

    /**
     * Applica danno da radiazioni
     */
    applyRadiationDamage(clientId, playerData, now) {
        // Usa damagePlayer standard (gestisce shield, HP e morte)
        const isDead = this.mapServer.npcManager.damagePlayer(clientId, this.RADIATION_DAMAGE, 'radiation_zone');

        // Se è ancora vivo, broadcastiamo l'aggiornamento HP
        // Se è morto, damagePlayer chiama già handlePlayerDeath che gestisce tutto il necessario
        if (!isDead) {
            this.broadcastHazardDamage(clientId, playerData);
        } else {
            ServerLoggerWrapper.combat(`Player ${playerData.nickname} (${clientId}) died from radiation`);

            // Notifica la distruzione dell'entità per triggerare esplosione e death popup sul client
            if (this.mapServer.projectileManager && this.mapServer.projectileManager.broadcaster) {
                this.mapServer.projectileManager.broadcaster.broadcastEntityDestroyed(playerData, 'radiation_hazard', 'player');
            }

            // Pulisci lo stato hazard
            this.playerHazardStates.delete(clientId);
        }
    }

    /**
     * Broadcast aggiornamento danno hazard
     */
    broadcastHazardDamage(clientId, playerData) {
        const broadcastMessage = {
            type: 'entity_damaged',
            entityId: clientId,
            entityType: 'player',
            damage: this.RADIATION_DAMAGE,
            attackerId: 'radiation',
            newHealth: playerData.health,
            newShield: playerData.shield,
            maxHealth: playerData.maxHealth,
            maxShield: playerData.maxShield,
            position: playerData.position,
            projectileType: 'radiation' // Client può usare questo per effetti specifici
        };

        if (this.mapServer.broadcastToMap) {
            this.mapServer.broadcastToMap(broadcastMessage);
        }
    }

    /**
     * Cleanup quando un player disconnette
     */
    removePlayer(clientId) {
        this.playerHazardStates.delete(clientId);
    }
}

module.exports = HazardManager;
