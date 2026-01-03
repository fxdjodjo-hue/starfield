import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Projectile } from '../../entities/combat/Projectile';

/**
 * Pool di proiettili per riuso efficiente delle entità
 * Riduce la creazione/distruzione continua di entità migliorando le performance
 */
export class ProjectilePool {
  private ecs: ECS;
  private availableProjectiles: any[] = [];
  private activeProjectiles: Set<any> = new Set();
  private poolSize: number;

  constructor(ecs: ECS, initialPoolSize: number = 50) {
    this.ecs = ecs;
    this.poolSize = initialPoolSize;
    this.initializePool();
  }

  /**
   * Inizializza il pool con entità proiettili preallocate
   */
  private initializePool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const projectileEntity = this.createProjectileEntity();
      this.availableProjectiles.push(projectileEntity);
    }
  }

  /**
   * Crea una nuova entità proiettile per il pool
   */
  private createProjectileEntity(): any {
    const entity = this.ecs.createEntity();

    // Aggiungi componenti base (inizializzati ma non attivi)
    const transform = new Transform(0, 0, 0, 1, 1);
    const projectile = new Projectile(0, 0, 0, 0, 0, 0, 0);

    this.ecs.addComponent(entity, Transform, transform);
    this.ecs.addComponent(entity, Projectile, projectile);

    return entity;
  }

  /**
   * Ottiene un proiettile dal pool, o ne crea uno nuovo se necessario
   */
  getProjectile(damage: number, speed: number, directionX: number, directionY: number, ownerId: number, targetId: number, lifetime: number): any {
    let projectileEntity: any;

    // Prima prova a prendere dal pool disponibile
    if (this.availableProjectiles.length > 0) {
      projectileEntity = this.availableProjectiles.pop();
    } else {
      // Se il pool è vuoto, crea una nuova entità
      projectileEntity = this.createProjectileEntity();
    }

    // Attiva il proiettile con i parametri forniti
    this.activateProjectile(projectileEntity, damage, speed, directionX, directionY, ownerId, targetId, lifetime);

    // Aggiungi al set degli attivi
    this.activeProjectiles.add(projectileEntity);

    return projectileEntity;
  }

  /**
   * Attiva un proiettile con i parametri specificati
   */
  private activateProjectile(entity: any, damage: number, speed: number, directionX: number, directionY: number, ownerId: number, targetId: number, lifetime: number): void {
    const transform = this.ecs.getComponent(entity, Transform);
    const projectile = this.ecs.getComponent(entity, Projectile);

    if (transform && projectile) {
      // Imposta i valori del proiettile
      projectile.damage = damage;
      projectile.speed = speed;
      projectile.directionX = directionX;
      projectile.directionY = directionY;
      projectile.ownerId = ownerId;
      projectile.targetId = targetId;
      projectile.lifetime = lifetime;
    }
  }

  /**
   * Restituisce un proiettile al pool per il riuso
   */
  returnProjectile(projectileEntity: any): void {
    if (this.activeProjectiles.has(projectileEntity)) {
      // Rimuovi dal set degli attivi
      this.activeProjectiles.delete(projectileEntity);

      // Resetta il proiettile
      this.deactivateProjectile(projectileEntity);

      // Rimetti nel pool disponibile
      this.availableProjectiles.push(projectileEntity);
    }
  }

  /**
   * Disattiva un proiettile resettandone i valori
   */
  private deactivateProjectile(entity: any): void {
    const transform = this.ecs.getComponent(entity, Transform);
    const projectile = this.ecs.getComponent(entity, Projectile);

    if (transform && projectile) {
      // Resetta posizione fuori schermo
      transform.x = -1000;
      transform.y = -1000;

      // Resetta valori del proiettile
      projectile.damage = 0;
      projectile.speed = 0;
      projectile.directionX = 0;
      projectile.directionY = 0;
      projectile.ownerId = 0;
      projectile.targetId = 0;
      projectile.lifetime = 0;
    }
  }

  /**
   * Ottiene il numero di proiettili attivi
   */
  getActiveCount(): number {
    return this.activeProjectiles.size;
  }

  /**
   * Ottiene il numero di proiettili disponibili nel pool
   */
  getAvailableCount(): number {
    return this.availableProjectiles.length;
  }

  /**
   * Espande il pool se necessario (per gestire picchi di utilizzo)
   */
  expandPool(additionalSize: number = 25): void {
    for (let i = 0; i < additionalSize; i++) {
      const projectileEntity = this.createProjectileEntity();
      this.availableProjectiles.push(projectileEntity);
    }
    this.poolSize += additionalSize;
  }

  /**
   * Cleanup del pool (rimuove tutti i proiettili)
   */
  cleanup(): void {
    // Rimuovi tutte le entità dal pool
    for (const entity of this.availableProjectiles) {
      this.ecs.removeEntity(entity);
    }

    for (const entity of this.activeProjectiles) {
      this.ecs.removeEntity(entity);
    }

    this.availableProjectiles = [];
    this.activeProjectiles.clear();
  }
}
