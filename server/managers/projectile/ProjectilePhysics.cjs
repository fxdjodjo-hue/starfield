// ProjectilePhysics - Simulazione fisica e movimento proiettili
// Responsabilità: Movimento, aggiornamento posizione, calcolo lifetime
// Dipendenze: logger.cjs, mapServer

const { logger } = require('../../logger.cjs');

class ProjectilePhysics {
  constructor(mapServer) {
    this.mapServer = mapServer;
  }

  /**
   * Aggiorna posizione di un proiettile
   * @param {Object} projectile - Proiettile da aggiornare
   * @param {Object} position - Nuova posizione {x, y}
   */
  updateProjectile(projectile, position) {
    if (!projectile) return;

    projectile.position = { ...position };
    projectile.lastUpdate = Date.now();
  }

  /**
   * Simula movimento del proiettile (aggiorna posizione basata su velocità)
   * @param {Object} projectile - Proiettile da muovere
   * @param {number} deltaTime - Tempo trascorso in secondi
   */
  simulateMovement(projectile, deltaTime) {
    projectile.position.x += projectile.velocity.x * deltaTime;
    projectile.position.y += projectile.velocity.y * deltaTime;
    projectile.lastUpdate = Date.now();
  }

  /**
   * Calcola il tempo di vita massimo di un proiettile basato sul suo tipo
   * @param {Object} projectile - Proiettile
   * @returns {number} Lifetime massimo in millisecondi
   */
  calculateProjectileLifetime(projectile) {
    const isNpcProjectile = projectile.playerId && typeof projectile.playerId === 'string' && projectile.playerId.startsWith('npc_');
    
    if (projectile.targetId && projectile.initialDistance) {
      // Per proiettili homing: tempo basato sulla distanza + margine
      const speed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + projectile.velocity.y * projectile.velocity.y);
      const baseTime = (projectile.initialDistance / speed) * 1000; // millisecondi
      const marginTime = Math.min(3000, baseTime * 0.5); // fino al 50% di margine, max 3 secondi

      // Proiettili NPC hanno più tempo per raggiungere il player (può muoversi velocemente)
      const maxLifetime = isNpcProjectile ? 12000 : 8000; // NPC: 12s, player: 8s
      return Math.min(baseTime + marginTime, maxLifetime);
    } else {
      // Per proiettili normali: timeout fisso
      return 10000; // 10 secondi
    }
  }

  /**
   * Verifica se posizione è fuori dai confini del mondo
   * @param {Object} position - Posizione {x, y}
   * @returns {boolean} true se fuori dai confini
   */
  isOutOfBounds(position) {
    const worldSize = 25000; // Raggio del mondo
    return Math.abs(position.x) > worldSize || Math.abs(position.y) > worldSize;
  }
}

module.exports = ProjectilePhysics;
