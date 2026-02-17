// ProjectileCollision - Rilevamento collisioni proiettili
// Responsabilità: Verifica collisioni con NPC, player, target specifici
// Dipendenze: logger.cjs, mapServer

const { logger } = require('../../logger.cjs');
const PLAYER_HITBOX_RADIUS = 30;

class ProjectileCollision {
  constructor(mapServer) {
    this.mapServer = mapServer;
  }

  /**
   * Calcola raggio di collisione dinamico basato sulla velocità relativa
   * @param {number} relativeSpeed - Velocità relativa tra proiettile e target
   * @param {boolean} isNpcTarget - true se target è NPC (usa raggio dinamico)
   * @returns {number} Raggio di collisione
   */
  calculateCollisionRadius(relativeSpeed, isNpcTarget = false) {
    // Raggio base standardizzato per precisione (era 80, ora 40 per match visivo migliore)
    let collisionRadius = 40;

    // Per NPC: aumenta raggio dinamicamente se si muove velocemente
    // Per ogni 100 px/s di velocità relativa, aggiungi 10px al raggio (max +80px)
    if (isNpcTarget && relativeSpeed > 200) {
      const speedBonus = Math.min(80, (relativeSpeed - 200) / 100 * 10);
      collisionRadius += speedBonus;
    }

    return collisionRadius;
  }

  /**
   * Verifica collisione con NPC
   * @param {Object} projectile - Proiettile
   * @returns {Object|null} NPC colpito o null
   */
  checkNpcCollision(projectile) {
    const npcs = this.mapServer.npcManager.getAllNpcs();
    for (const npc of npcs) {
      // CRITICO: Escludi l'NPC che ha sparato il proiettile (evita auto-danno)
      if (projectile.playerId && projectile.playerId === npc.id) {
        continue; // Salta l'NPC che ha sparato questo proiettile
      }

      const distance = Math.sqrt(
        Math.pow(projectile.position.x - npc.position.x, 2) +
        Math.pow(projectile.position.y - npc.position.y, 2)
      );

      // Distanza di collisione dinamica basata sulla velocità relativa
      // Calcola velocità dell'NPC
      const npcVelX = npc.velocity?.x || 0;
      const npcVelY = npc.velocity?.y || 0;
      const npcSpeed = Math.sqrt(npcVelX * npcVelX + npcVelY * npcVelY);

      // Velocità del proiettile
      const projVelX = projectile.velocity.x || 0;
      const projVelY = projectile.velocity.y || 0;
      const projSpeed = Math.sqrt(projVelX * projVelX + projVelY * projVelY);

      // Velocità relativa (quanto velocemente si avvicinano)
      const relativeSpeed = Math.max(npcSpeed, projSpeed);

      // Raggio di collisione dinamico
      const collisionRadius = this.calculateCollisionRadius(relativeSpeed, true);

      if (distance < collisionRadius) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Verifica collisione proiettile con giocatori
   * @param {Object} projectile - Proiettile
   * @returns {Object|null} {playerData, clientId} o null
   */
  checkPlayerCollision(projectile) {
    for (const [clientId, playerData] of this.mapServer.players.entries()) {
      // Salta il giocatore che ha sparato il proiettile
      // projectile.playerId è sempre il clientId (standardizzato)
      if (clientId === projectile.playerId) {
        continue;
      }

      // Salta giocatori morti o senza posizione
      if (!playerData.position || playerData.isDead) continue;

      const distance = Math.sqrt(
        Math.pow(projectile.position.x - playerData.position.x, 2) +
        Math.pow(projectile.position.y - playerData.position.y, 2)
      );
      const collisionRadius = PLAYER_HITBOX_RADIUS;

      if (distance < collisionRadius) {
        return { playerData, clientId };
      }
    }
    return null;
  }

  /**
   * Verifica collisione proiettile con il suo target specifico
   * @param {Object} projectile - Proiettile
   * @returns {Object|null} {entity, type} o null
   */
  checkSpecificTargetCollision(projectile) {
    const targetId = projectile.targetId;

    // Determina se il target è un NPC o un player basandosi sul formato dell'ID
    // NPC hanno ID come "npc_0", "npc_1", etc.
    // Player hanno clientId come UUID stringhe
    const isNpcTarget = typeof targetId === 'string' && targetId.startsWith('npc_');
    const isPlayerTarget = !isNpcTarget && typeof targetId === 'string';

    // Se è un proiettile NPC, il target dovrebbe essere sempre un player
    // Se è un proiettile player, il target potrebbe essere un NPC
    const isNpcProjectile = projectile.playerId && typeof projectile.playerId === 'string' && projectile.playerId.startsWith('npc_');

    if (isNpcTarget || (!isPlayerTarget && !isNpcProjectile)) {
      // Cerca tra gli NPC solo se il target è chiaramente un NPC
      const npcs = this.mapServer.npcManager.getAllNpcs();
      for (const npc of npcs) {
        if (npc.id === targetId) {
          // CRITICO: Escludi l'NPC che ha sparato il proiettile
          if (projectile.playerId === npc.id) {
            continue; // L'NPC non può colpire se stesso
          }

          const distance = Math.sqrt(
            Math.pow(projectile.position.x - npc.position.x, 2) +
            Math.pow(projectile.position.y - npc.position.y, 2)
          );

          // Distanza di collisione dinamica basata sulla velocità relativa
          // Calcola velocità dell'NPC
          const npcVelX = npc.velocity?.x || 0;
          const npcVelY = npc.velocity?.y || 0;
          const npcSpeed = Math.sqrt(npcVelX * npcVelX + npcVelY * npcVelY);

          // Velocità del proiettile
          const projVelX = projectile.velocity.x || 0;
          const projVelY = projectile.velocity.y || 0;
          const projSpeed = Math.sqrt(projVelX * projVelX + projVelY * projVelY);

          // Velocità relativa (quanto velocemente si avvicinano)
          const relativeSpeed = Math.max(npcSpeed, projSpeed);

          // Raggio di collisione dinamico
          let collisionRadius = this.calculateCollisionRadius(relativeSpeed, true);

          // SUPER-HITBOX per missili RIMOSSA su richiesta user per precisione
          // Ora usa il raggio standard calcolato sopra

          if (distance < collisionRadius) {
            return { entity: npc, type: 'npc' };
          }
          break; // Trovato l'NPC target, non cercare altri
        }
      }
    }

    // Cerca tra i giocatori (sempre valido per proiettili NPC, o se target è un player)
    if (isPlayerTarget || isNpcProjectile) {
      for (const [clientId, playerData] of this.mapServer.players.entries()) {
        // Salta il giocatore che ha sparato il proiettile
        // projectile.playerId è sempre il clientId (standardizzato)
        if (clientId === projectile.playerId) {
          continue;
        }

        // Controlla se questo giocatore è il target
        if (clientId === targetId || playerData.playerId?.toString() === targetId?.toString()) {
          // Salta giocatori morti o senza posizione
          if (!playerData.position || playerData.isDead) continue;

          const distance = Math.sqrt(
            Math.pow(projectile.position.x - playerData.position.x, 2) +
            Math.pow(projectile.position.y - playerData.position.y, 2)
          );
          const collisionRadius = PLAYER_HITBOX_RADIUS;

          if (distance < collisionRadius) {
            return { entity: playerData, type: 'player' };
          }
          break; // Trovato il giocatore target, non cercare altri
        }
      }
    }

    return null; // Target specifico non trovato o non in range
  }
}

module.exports = ProjectileCollision;
