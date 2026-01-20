// ProjectileHoming - Logica homing avanzata per proiettili
// Responsabilità: Calcolo direzione homing, predizione target, gestione target data
// Dipendenze: logger.cjs, mapServer

const { logger } = require('../../logger.cjs');

class ProjectileHoming {
  constructor(mapServer) {
    this.mapServer = mapServer;
  }

  /**
   * Aggiorna direzione di un proiettile homing verso il suo target
   * Logica semplificata: direzione diretta verso target con predizione base
   * @param {Object} projectile - Proiettile da aggiornare
   * @returns {boolean} true se target trovato e homing applicato, false se target scomparso
   */
  updateProjectileHoming(projectile) {
    const isNpcProjectile = projectile.playerId && typeof projectile.playerId === 'string' && projectile.playerId.startsWith('npc_');

    // Trova posizione corrente del target
    const targetData = this.getTargetData(projectile.targetId);
    if (!targetData || !targetData.position) {
      console.log(`[SERVER_HOMING] Target not found for projectile ${projectile.id}, targetId: ${projectile.targetId}, playerId: ${projectile.playerId}`);
      return false;
    }

    const targetPosition = targetData.position;
    const targetVelocity = targetData.velocity || { x: 0, y: 0 };
    const projectileSpeed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + projectile.velocity.y * projectile.velocity.y);

    // Calcola direzione verso target
    let dx = targetPosition.x - projectile.position.x;
    let dy = targetPosition.y - projectile.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Predizione semplice: se target si muove, predici posizione futura
    if (distance > 10 && projectileSpeed > 50) {
      const timeToTarget = distance / projectileSpeed;
      const predictionTime = Math.min(timeToTarget * 0.5, 0.5); // 50% del tempo, max 0.5s
      dx = targetPosition.x + targetVelocity.x * predictionTime - projectile.position.x;
      dy = targetPosition.y + targetVelocity.y * predictionTime - projectile.position.y;
    }

    // Normalizza direzione
    const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
    if (distanceToTarget > 0) {
      const directionX = dx / distanceToTarget;
      const directionY = dy / distanceToTarget;

      // Imposta velocità: direzione diretta, velocità costante
      const speed = Math.max(50, Math.min(projectileSpeed, 2000));
      projectile.velocity.x = directionX * speed;
      projectile.velocity.y = directionY * speed;

      // Validazione
      if (!Number.isFinite(projectile.velocity.x) || !Number.isFinite(projectile.velocity.y)) {
        projectile.velocity.x = dx > 0 ? 400 : -400;
        projectile.velocity.y = dy > 0 ? 400 : -400;
      }
    }

    return true;
  }

  /**
   * Ottiene dati completi del target (posizione e velocità per predizione)
   * Calcola velocità in modo più accurato usando la queue di aggiornamenti per player veloci
   * @param {string} targetId - ID del target
   * @returns {Object|null} {position, velocity} o null se non trovato
   */
  getTargetData(targetId) {
    // Prima cerca tra i giocatori
    if (this.mapServer.players.has(targetId)) {
      const playerData = this.mapServer.players.get(targetId);
      if (!playerData.position || playerData.isDead) return null;

      // Calcola velocità più accurata usando la queue di aggiornamenti recenti
      let velocity = {
        x: playerData.position.velocityX || 0,
        y: playerData.position.velocityY || 0
      };

      // Se c'è una queue di aggiornamenti, usa quella per calcolare velocità più accurata
      const positionQueue = this.mapServer.positionUpdateQueue?.get(targetId);
      if (positionQueue && positionQueue.length >= 2) {
        // Usa gli ultimi 2 aggiornamenti per calcolare velocità reale
        const latest = positionQueue[positionQueue.length - 1];
        const previous = positionQueue[positionQueue.length - 2];
        const timeDelta = (latest.timestamp - previous.timestamp) / 1000; // secondi
        
        if (timeDelta > 0 && timeDelta < 0.5) { // Solo se il delta è ragionevole (max 500ms)
          const posDeltaX = latest.x - previous.x;
          const posDeltaY = latest.y - previous.y;
          const calculatedVelX = posDeltaX / timeDelta;
          const calculatedVelY = posDeltaY / timeDelta;
          
          // Usa la velocità calcolata se è più grande (player si muove velocemente)
          // Altrimenti usa quella inviata dal client (più accurata per movimenti lenti)
          const clientSpeed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
          const calculatedSpeed = Math.sqrt(calculatedVelX * calculatedVelX + calculatedVelY * calculatedVelY);
          
          if (calculatedSpeed > clientSpeed * 0.8) { // Se la velocità calcolata è almeno 80% di quella client
            velocity = { x: calculatedVelX, y: calculatedVelY };
          }
        }
      }

      return {
        position: playerData.position,
        velocity: velocity
      };
    }

    // Poi cerca tra gli NPC
    const npcs = this.mapServer.npcManager.getAllNpcs();
    for (const npc of npcs) {
      if (npc.id === targetId) {
        // Log solo quando trova il target (evento raro)
        console.log(`[SERVER_HOMING] Found target NPC: ${npc.id}`);
        return {
          position: npc.position,
          velocity: npc.velocity || { x: 0, y: 0 }
        };
      }
    }

    return null; // Target non trovato
  }

  /**
   * Ottiene posizione corrente di un target (player o NPC)
   * @param {string} targetId - ID del target
   * @returns {Object|null} Posizione {x, y} o null se non trovato
   */
  getTargetPosition(targetId) {
    const targetData = this.getTargetData(targetId);
    return targetData ? targetData.position : null;
  }

  /**
   * Verifica se un proiettile è "orfano" (il suo target non esiste più)
   * Previene memory leaks rimuovendo proiettili che non possono mai colpire
   * @param {Object} projectile - Proiettile da verificare
   * @returns {boolean} true se orfano
   */
  isProjectileOrphaned(projectile) {
    if (!projectile.targetId || projectile.targetId === -1) {
      return false; // Non è un proiettile homing, quindi non orfano
    }

    const targetExists = this.getTargetData(projectile.targetId) !== null;
    return !targetExists;
  }

  /**
   * Calcola la distanza attuale dal target per un proiettile
   * @param {Object} projectile - Proiettile
   * @returns {number} Distanza o Infinity se target non trovato
   */
  getDistanceToTarget(projectile) {
    const targetId = projectile.targetId;
    if (!targetId) return Infinity;

    // STESSO ORDINE di getTargetPosition: prima giocatori, poi NPC
    // Prima cerca tra i giocatori
    for (const [clientId, playerData] of this.mapServer.players.entries()) {
      if (clientId === targetId || playerData.playerId?.toString() === targetId?.toString()) {
        if (!playerData.position || playerData.isDead) continue;
        return Math.sqrt(
          Math.pow(projectile.position.x - playerData.position.x, 2) +
          Math.pow(projectile.position.y - playerData.position.y, 2)
        );
      }
    }

    // Poi cerca tra gli NPC
    const npcs = this.mapServer.npcManager.getAllNpcs();
    for (const npc of npcs) {
      if (npc.id === targetId) {
        return Math.sqrt(
          Math.pow(projectile.position.x - npc.position.x, 2) +
          Math.pow(projectile.position.y - npc.position.y, 2)
        );
      }
    }

    // Target non trovato
    return Infinity;
  }

  /**
   * Calcola la distanza massima consentita dal target per un proiettile
   * Oltre questa distanza, il proiettile viene rimosso per evitare memory leak
   * @param {Object} projectile - Proiettile
   * @returns {number} Distanza massima (2000 unità)
   */
  getMaxTargetDistance(projectile) {
    // Distanza massima: 2000 unità (circa 2 schermi di gioco)
    // Questo previene proiettili che volano all'infinito
    return 2000;
  }
}

module.exports = ProjectileHoming;
