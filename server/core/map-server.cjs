// MapServer - Contesto per ogni mappa del gioco
// Dipendenze consentite: logger.cjs, managers (npc, combat, projectile)

const { logger } = require('../logger.cjs');
const { SERVER_CONSTANTS, NPC_CONFIG } = require('../config/constants.cjs');
const ServerNpcManager = require('../managers/npc-manager.cjs');
const ServerCombatManager = require('../managers/combat-manager.cjs');
const ServerProjectileManager = require('../managers/projectile-manager.cjs');

class MapServer {
  constructor(mapId, config = {}) {
    this.mapId = mapId;

    // Dimensioni mappa (configurabili per mappe diverse)
    this.WORLD_WIDTH = config.WORLD_WIDTH || 21000;
    this.WORLD_HEIGHT = config.WORLD_HEIGHT || 13100;

    // Managers specifici della mappa
    this.npcManager = new ServerNpcManager(this);
    this.projectileManager = new ServerProjectileManager(this);

    // Players connessi a questa mappa
    this.players = new Map();

    // Queue per aggiornamenti posizione per ridurre race conditions
    this.positionUpdateQueue = new Map(); // clientId -> Array di aggiornamenti

    // Configurazione NPC per questa mappa
    this.npcConfig = config.npcConfig || { scouterCount: 25, frigateCount: 25 };
  }

  // Inizializzazione della mappa
  initialize() {
    logger.info('MAP', `Initializing map ${this.mapId}...`);
    this.npcManager.initializeWorldNpcs(
      this.npcConfig.scouterCount,
      this.npcConfig.frigateCount
    );
  }

  // Gestione giocatori
  addPlayer(clientId, playerData) {
    this.players.set(clientId, playerData);
    logger.info('MAP', `Player ${clientId} joined map ${this.mapId}`);
  }

  removePlayer(clientId) {
    this.players.delete(clientId);
    logger.info('MAP', `Player ${clientId} left map ${this.mapId}`);
  }

  // Metodi delegati ai managers
  getAllNpcs() { return this.npcManager.getAllNpcs(); }
  getNpc(npcId) { return this.npcManager.getNpc(npcId); }
  createNpc(type, x, y) { return this.npcManager.createNpc(type, x, y); }

  // Tick unificato per la mappa (20 Hz)
  tick() {
    try {
      // 1. Movimento NPC
      this.updateNpcMovements();

      // 2. Logica di combat NPC (attacchi automatici)
      if (this.combatManager) {
        this.combatManager.updateCombat();
      }

      // 3. Collisioni proiettili
      this.projectileManager.checkCollisions();

      // 3.5. Aggiornamenti posizione proiettili homing
      this.projectileManager.broadcastHomingProjectileUpdates();

      // 4. Broadcast aggiornamenti NPC significativi
      this.broadcastNpcUpdates();

      // 5. Processa aggiornamenti posizione giocatori
      this.processPositionUpdates();

    } catch (error) {
      console.error(`❌ [MapServer:${this.mapId}] Error in tick:`, error);
    }
  }

  // Broadcasting specifico della mappa
  broadcastToMap(message, excludeClientId = null) {
    const payload = JSON.stringify(message);
    let sentCount = 0;
    let excludedCount = 0;
    let closedCount = 0;

    for (const [clientId, playerData] of this.players.entries()) {
      if (excludeClientId && clientId === excludeClientId) {
        excludedCount++;
        continue;
      }

      if (playerData.ws.readyState === WebSocket.OPEN) {
        try {
          playerData.ws.send(payload);
          sentCount++;
        } catch (error) {
          console.error(`[MapServer] Error sending to ${clientId}:`, error);
        }
      } else {
        closedCount++;
      }
    }

    if (message.type === 'chat_message') {
      const { logger } = require('../logger.cjs');
      logger.info('MAP', `Chat broadcast: sent=${sentCount}, excluded=${excludedCount}, closed=${closedCount}, total=${this.players.size}`);
    }
  }

  // Broadcasting con interest radius (solo giocatori entro il raggio)
  broadcastNear(position, radius, message, excludeClientId = null) {
    const payload = JSON.stringify(message);
    const radiusSq = radius * radius; // Evita sqrt per performance

    for (const [clientId, playerData] of this.players.entries()) {
      if (excludeClientId && clientId === excludeClientId) continue;
      if (!playerData.position || playerData.ws.readyState !== WebSocket.OPEN) continue;

      // Calcola distanza quadrata
      const dx = playerData.position.x - position.x;
      const dy = playerData.position.y - position.y;
      const distSq = dx * dx + dy * dy;

      // Invia solo se entro il raggio
      if (distSq <= radiusSq) {
        playerData.ws.send(payload);
      }
    }
  }

  // Sistema di movimento NPC semplice (server-side)
  updateNpcMovements() {
    const allNpcs = this.npcManager.getAllNpcs();

    for (const npc of allNpcs) {
      const deltaTime = 1000 / 60; // Fixed timestep per fisica server

      // Validazione posizione iniziale
      if (!Number.isFinite(npc.position.x) || !Number.isFinite(npc.position.y)) {
        console.warn(`⚠️ [SERVER] NPC ${npc.id} has invalid initial position: (${npc.position.x}, ${npc.position.y}), skipping`);
        continue;
      }

      // Salva posizione iniziale per calcolare movimento significativo
      const startX = npc.position.x;
      const startY = npc.position.y;

    // Movimento semplice con velocity
    const speed = NPC_CONFIG[npc.type].stats.speed;

    // Validazione velocità: assicurati che siano finite
    if (!Number.isFinite(npc.velocity.x) || !Number.isFinite(npc.velocity.y)) {
      console.warn(`⚠️ [SERVER] NPC ${npc.id} velocity became NaN, resetting. Speed: ${speed}, deltaTime: ${deltaTime}`);
      npc.velocity.x = (Math.random() - 0.5) * 100;
      npc.velocity.y = (Math.random() - 0.5) * 100;
    }

    // Validazione parametri movimento
    if (!Number.isFinite(speed) || speed <= 0) {
      console.warn(`⚠️ [SERVER] NPC ${npc.id} invalid speed: ${speed}`);
      return; // Salta questo NPC
    }

    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
      console.warn(`⚠️ [SERVER] NPC ${npc.id} invalid deltaTime: ${deltaTime}`);
      return; // Salta questo NPC
    }

      // Calcola info su player nel range di attacco
      const now = Date.now();
      const attackRange = NPC_CONFIG[npc.type].stats.range || 600;
      const attackRangeSq = attackRange * attackRange;
      let hasPlayerInRange = false;

      for (const [clientId, playerData] of this.players.entries()) {
        if (!playerData.position) continue;
        const dx = playerData.position.x - npc.position.x;
        const dy = playerData.position.y - npc.position.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq <= attackRangeSq) {
          hasPlayerInRange = true;
          break;
        }
      }

      // Traccia ultimo momento in cui aveva un player nel range
      if (hasPlayerInRange) {
        npc.lastPlayerInRange = now;
      }

      // Aggiorna comportamento NPC:
      // - flee: salute < 50%
      // - aggressive: ha visto un player nel range negli ultimi DAMAGE_TIMEOUT ms
      //               O è stato danneggiato di recente
      // - cruise: altrimenti
      const healthPercent = npc.maxHealth > 0 ? npc.health / npc.maxHealth : 1;

      if (healthPercent < 0.5) {
        // Salute bassa: fuga
        npc.behavior = 'flee';
      } else if (
        (npc.lastPlayerInRange && (now - npc.lastPlayerInRange) < SERVER_CONSTANTS.TIMEOUTS.DAMAGE_TIMEOUT) ||
        (npc.lastDamage && (now - npc.lastDamage) < SERVER_CONSTANTS.TIMEOUTS.DAMAGE_TIMEOUT)
      ) {
        // Player recentemente nel range O danno recente: aggressive
        npc.behavior = 'aggressive';
      } else {
        // Nessun player nel range / danno da troppo: torna in cruise
        npc.behavior = 'cruise';
      }

      // Calcola movimento basato sul comportamento
      let deltaX = 0;
      let deltaY = 0;

      switch (npc.behavior) {
        case 'aggressive': {
          // In aggressive: mantieni una certa distanza dal player
          // - se troppo lontano: avvicinati
          // - se troppo vicino: allontanati
          // - se nel range ideale: movimento più naturale con direzione persistente + jitter leggero
          let targetPlayerPos = null;

          // 1) Prova con l'ultimo attacker noto
          if (npc.lastAttackerId) {
            const attackerData = this.players.get(npc.lastAttackerId);
            if (attackerData && attackerData.position) {
              targetPlayerPos = { x: attackerData.position.x, y: attackerData.position.y };
            }
          }

          // 2) Se non c'è attacker valido, fallback al player più vicino
          if (!targetPlayerPos) {
            let closestPlayerPos = null;
            let closestDistSq = Infinity;

            for (const [clientId, playerData] of this.players.entries()) {
              if (!playerData.position) continue;
              const dx = playerData.position.x - npc.position.x;
              const dy = playerData.position.y - npc.position.y;
              const distanceSq = dx * dx + dy * dy;
              if (distanceSq < closestDistSq) {
                closestDistSq = distanceSq;
                closestPlayerPos = { x: playerData.position.x, y: playerData.position.y };
              }
            }

            if (closestPlayerPos) {
              targetPlayerPos = closestPlayerPos;
            }
          }

          if (targetPlayerPos) {
            const dx = targetPlayerPos.x - npc.position.x;
            const dy = targetPlayerPos.y - npc.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const dirX = dx / dist;
            const dirY = dy / dist;

            // Usa l'attackRange come riferimento di distanza (fascia più ampia per evitare flip continui)
            const minDistance = attackRange * 0.7;        // troppo vicino
            const maxDistance = attackRange * 1.4;        // troppo lontano
            const dtSec = deltaTime / 1000;

            if (dist > maxDistance) {
              // Troppo lontano: avvicinati verso il player
              const moveSpeed = speed * dtSec;
              deltaX = dirX * moveSpeed;
              deltaY = dirY * moveSpeed;
              npc.velocity.x = dirX * speed;
              npc.velocity.y = dirY * speed;
            } else if (dist < minDistance) {
              // Troppo vicino: allontanati dal player
              const moveSpeed = speed * dtSec;
              deltaX = -dirX * moveSpeed;
              deltaY = -dirY * moveSpeed;
              npc.velocity.x = -dirX * speed;
              npc.velocity.y = -dirY * speed;
            } else {
              // Nel range ideale: segui il player a distanza mantenendo la prua verso di lui
              const moveSpeed = speed * 0.5 * dtSec;
              deltaX = dirX * moveSpeed;
              deltaY = dirY * moveSpeed;
              npc.velocity.x = dirX * speed * 0.5;
              npc.velocity.y = dirY * speed * 0.5;
            }

            // In aggressive, lo sprite deve risultare "agganciato" al player:
            // la rotazione segue sempre la direzione verso il player
            npc.position.rotation = Math.atan2(dy, dx) + Math.PI / 2;
          } else {
            // Nessun player valido: fallback a movimento tipo cruise
            const cruiseSpeed = speed * 0.5;

            // Se la velocity è quasi nulla, assegna una direzione casuale
            if (Math.abs(npc.velocity.x) < 0.1 && Math.abs(npc.velocity.y) < 0.1) {
              const angle = Math.random() * Math.PI * 2;
              npc.velocity.x = Math.cos(angle) * cruiseSpeed;
              npc.velocity.y = Math.sin(angle) * cruiseSpeed;
            }

            deltaX = npc.velocity.x * (deltaTime / 1000);
            deltaY = npc.velocity.y * (deltaTime / 1000);
          }
          break;
        }
        case 'flee': {
          // Fuga: cerca sempre il player più vicino per decidere direzione e rotazione
          let closestPlayerPos = null;
          let closestDistSq = Infinity;

          for (const [clientId, playerData] of this.players.entries()) {
            if (!playerData.position) continue;
            const dx = playerData.position.x - npc.position.x;
            const dy = playerData.position.y - npc.position.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq < closestDistSq) {
              closestDistSq = distanceSq;
              closestPlayerPos = { x: playerData.position.x, y: playerData.position.y };
            }
          }

          if (closestPlayerPos) {
            const dxToPlayer = closestPlayerPos.x - npc.position.x;
            const dyToPlayer = closestPlayerPos.y - npc.position.y;
            const distToPlayer = Math.sqrt(dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer) || 1;

            // Se velocity quasi nulla, imposta fuga opposta alla direzione player
            if (Math.abs(npc.velocity.x) < 0.1 && Math.abs(npc.velocity.y) < 0.1) {
              const fleeDx = -dxToPlayer;
              const fleeDy = -dyToPlayer;
              const fleeLen = Math.sqrt(fleeDx * fleeDx + fleeDy * fleeDy) || 1;
              const fleeSpeed = speed * 1.5;
              npc.velocity.x = (fleeDx / fleeLen) * fleeSpeed;
              npc.velocity.y = (fleeDy / fleeLen) * fleeSpeed;
            }

            // Se il player è nel range di attacco, lo sprite guarda il player
            // Altrimenti guarda nella direzione di fuga
            if (distToPlayer <= attackRange) {
              npc.position.rotation = Math.atan2(dyToPlayer, dxToPlayer) + Math.PI / 2;
            } else {
              // Fuori range: guarda nella direzione di fuga (velocity)
              const fleeDirLen = Math.sqrt(npc.velocity.x * npc.velocity.x + npc.velocity.y * npc.velocity.y) || 1;
              const fleeDirX = npc.velocity.x / fleeDirLen;
              const fleeDirY = npc.velocity.y / fleeDirLen;
              npc.position.rotation = Math.atan2(fleeDirY, fleeDirX) + Math.PI / 2;
            }
          }

          deltaX = npc.velocity.x * (deltaTime / 1000);
          deltaY = npc.velocity.y * (deltaTime / 1000);
          break;
        }
        case 'cruise': {
          // Cruise: se non hai una velocity significativa, assegna una direzione casuale
          if (Math.abs(npc.velocity.x) < 0.1 && Math.abs(npc.velocity.y) < 0.1) {
            const angle = Math.random() * Math.PI * 2;
            const cruiseSpeed = speed * 0.5;
            npc.velocity.x = Math.cos(angle) * cruiseSpeed;
            npc.velocity.y = Math.sin(angle) * cruiseSpeed;
          }

          deltaX = npc.velocity.x * (deltaTime / 1000);
          deltaY = npc.velocity.y * (deltaTime / 1000);
          break;
        }
        default: {
          // Default: usa velocity corrente se presente
          deltaX = npc.velocity.x * (deltaTime / 1000);
          deltaY = npc.velocity.y * (deltaTime / 1000);
          break;
        }
      }

      // Calcola nuova posizione
      const newX = npc.position.x + deltaX;
      const newY = npc.position.y + deltaY;

      // Validazione: assicurati che le posizioni siano finite
      if (!Number.isFinite(newX) || !Number.isFinite(newY)) {
        console.warn(`⚠️ [SERVER] NPC ${npc.id} position became NaN! old_pos: (${npc.position.x}, ${npc.position.y}) delta: (${deltaX}, ${deltaY}) vel: (${npc.velocity.x}, ${npc.velocity.y}) speed: ${speed} deltaTime: ${deltaTime}`);
        console.warn(`⚠️ [SERVER] Resetting NPC ${npc.id} to (0, 0)`);
        npc.position.x = 0;
        npc.position.y = 0;
        npc.velocity.x = (Math.random() - 0.5) * 100;
        npc.velocity.y = (Math.random() - 0.5) * 100;
        continue; // Salta l'aggiornamento per questo NPC
      }

      // Applica movimento e controlla confini
      if (newX >= this.npcManager.WORLD_LEFT && newX <= this.npcManager.WORLD_RIGHT) {
        npc.position.x = newX;
      } else {
        // Rimbalza sui confini X
        npc.velocity.x = -npc.velocity.x;
        npc.position.x = Math.max(this.npcManager.WORLD_LEFT, Math.min(this.npcManager.WORLD_RIGHT, newX));
      }

      if (newY >= this.npcManager.WORLD_TOP && newY <= this.npcManager.WORLD_BOTTOM) {
        npc.position.y = newY;
      } else {
        // Rimbalza sui confini Y
        npc.velocity.y = -npc.velocity.y;
        npc.position.y = Math.max(this.npcManager.WORLD_TOP, Math.min(this.npcManager.WORLD_BOTTOM, newY));
      }

      // Calcola movimento significativo (solo se spostamento > 5px)
      const dx = npc.position.x - startX;
      const dy = npc.position.y - startY;
      const distSq = dx * dx + dy * dy;

      if (distSq > 25) { // 5px threshold
        npc.lastSignificantMove = Date.now();
      }

      // Aggiorna rotazione dello sprite:
      // - per aggressive usiamo già la direzione verso il player nel branch sopra
      // - per gli altri comportamenti, riflettiamo la direzione del movimento
      if (npc.behavior !== 'aggressive') {
        if (deltaX !== 0 || deltaY !== 0) {
          npc.position.rotation = Math.atan2(deltaY, deltaX) + Math.PI / 2;
        }
      }

      npc.lastUpdate = Date.now();
    }
  }

  // Broadcast aggiornamenti NPC
  broadcastNpcUpdates() {
    const npcs = this.npcManager.getAllNpcs();
    if (npcs.length === 0) return;

    const radius = SERVER_CONSTANTS.NETWORK.WORLD_RADIUS; // Raggio del mondo
    const radiusSq = radius * radius;

    // Per ogni giocatore connesso, invia NPC nel suo raggio di interesse ampio
    for (const [clientId, playerData] of this.players.entries()) {
      if (!playerData.position || playerData.ws.readyState !== WebSocket.OPEN) continue;

      // Filtra NPC entro il raggio ampio
      const relevantNpcs = npcs.filter(npc => {
        const dx = npc.position.x - playerData.position.x;
        const dy = npc.position.y - playerData.position.y;
        return (dx * dx + dy * dy) <= radiusSq;
      });

      if (relevantNpcs.length === 0) continue;

      const message = {
        type: 'npc_bulk_update',
        npcs: relevantNpcs.map(npc => ({
          id: npc.id,
          position: npc.position,
          health: { current: npc.health, max: npc.maxHealth },
          shield: { current: npc.shield, max: npc.maxShield },
          behavior: npc.behavior
        })),
        timestamp: Date.now()
      };

      playerData.ws.send(JSON.stringify(message));
    }
  }

  // Processa aggiornamenti posizione giocatori
  processPositionUpdates() {
    for (const [clientId, updates] of this.positionUpdateQueue) {
      if (updates.length === 0) continue;

      const latestUpdate = updates[updates.length - 1];

      const positionBroadcast = {
        type: 'remote_player_update',
        clientId,
        position: {
          x: latestUpdate.x,
          y: latestUpdate.y,
          velocityX: latestUpdate.velocityX || 0,
          velocityY: latestUpdate.velocityY || 0
        },
        rotation: latestUpdate.rotation,
        tick: latestUpdate.tick,
        nickname: latestUpdate.nickname,
        playerId: latestUpdate.playerId
      };

      this.broadcastToMap(positionBroadcast, clientId);
      this.positionUpdateQueue.delete(clientId);
    }
  }
}

module.exports = MapServer;
