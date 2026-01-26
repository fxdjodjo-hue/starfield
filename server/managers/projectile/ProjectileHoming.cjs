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
  /**
   * Aggiorna direzione di un proiettile homing verso il suo target
   * Logica avanzata: Steering Behavior (non snap istantaneo) per movimento fluido
   * @param {Object} projectile - Proiettile da aggiornare
   * @param {number} deltaTime - Tempo trascorso dall'ultimo frame (secondi)
   * @returns {boolean} true se target trovato e homing applicato, false se target scomparso
   */
  updateProjectileHoming(projectile, deltaTime = 0.016) {
    const isNpcProjectile = projectile.playerId && typeof projectile.playerId === 'string' && projectile.playerId.startsWith('npc_');

    // Trova posizione corrente del target
    const targetData = this.getTargetData(projectile.targetId);
    if (!targetData || !targetData.position) {
      return false;
    }

    const targetPosition = targetData.position;
    const targetVelocity = targetData.velocity || { x: 0, y: 0 };

    // Calcola velocità corrente del proiettile
    const currentSpeed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + projectile.velocity.y * projectile.velocity.y);
    const useSpeed = currentSpeed > 0 ? currentSpeed : 250; // Fallback speed

    // Calcola direzione verso target
    let dx = targetPosition.x - projectile.position.x;
    let dy = targetPosition.y - projectile.position.y;
    const distanceToTarget = Math.sqrt(dx * dx + dy * dy);

    // Calcola differenza angolo (shortest path)
    const desiredAngle = Math.atan2(dy, dx);
    const currentAngle = Math.atan2(projectile.velocity.y, projectile.velocity.x);

    // Calcola differenza angolo (shortest path)
    let angleDiff = desiredAngle - currentAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Turn Rate (radianti al secondo)
    // Valore più alto = curva più stretta. 
    // Per missili lenti (250px/s), un turn rate di 2-3 rad/s dà curve ampie ma decise.
    const turnRate = 4.0;
    const maxTurn = turnRate * deltaTime;

    // Clampa la rotazione al massimo consentito
    const actualTurn = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));

    // Nuovo angolo
    const newAngle = currentAngle + actualTurn;

    // Aggiorna velocità mantenendo magnitude
    projectile.velocity.x = Math.cos(newAngle) * useSpeed;
    projectile.velocity.y = Math.sin(newAngle) * useSpeed;

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
