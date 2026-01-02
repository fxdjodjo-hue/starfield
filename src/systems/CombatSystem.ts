import { BaseSystem } from '../ecs/System';
import { ECS } from '../ecs/ECS';
import { Health } from '../components/Health';
import { Damage } from '../components/Damage';
import { Transform } from '../components/Transform';
import { SelectedNpc } from '../components/SelectedNpc';
import { Npc } from '../components/Npc';
import { Projectile } from '../components/Projectile';

/**
 * Sistema di combattimento - gestisce gli scontri tra entità
 * Gestisce attacchi, danni e logica di combattimento
 */
export class CombatSystem extends BaseSystem {
  private lastUpdateTime: number = 0;

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    this.lastUpdateTime += deltaTime;

    // Rimuovi tutte le entità morte
    this.removeDeadEntities();

    // Combattimento automatico per NPC selezionati
    this.processPlayerCombat();

    // NPC attaccano automaticamente il player quando nel range (tutti gli NPC, non solo selezionati)
    const allNpcs = this.ecs.getEntitiesWithComponents(Npc, Damage, Transform);

    for (const attackerEntity of allNpcs) {
      this.processNpcCombat(attackerEntity);
    }
  }

  /**
   * Elabora il combattimento per un NPC che attacca il player quando nel range
   */
  private processNpcCombat(attackerEntity: any): void {
    const attackerTransform = this.ecs.getComponent(attackerEntity, Transform);
    const attackerDamage = this.ecs.getComponent(attackerEntity, Damage);

    if (!attackerTransform || !attackerDamage) return;

    // Trova il player come target
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform, Health, Damage);
    // Il player è l'entità con Damage ma senza SelectedNpc
    const playerEntity = playerEntities.find(entity => {
      return !this.ecs.hasComponent(entity, SelectedNpc);
    });

    if (!playerEntity) return;

    const targetTransform = this.ecs.getComponent(playerEntity, Transform);
    const targetHealth = this.ecs.getComponent(playerEntity, Health);

    if (!targetTransform || !targetHealth) return;

    // Verifica se l'NPC può attaccare (cooldown e range)
    if (attackerDamage.isInRange(attackerTransform.x, attackerTransform.y, targetTransform.x, targetTransform.y) &&
        attackerDamage.canAttack(this.lastUpdateTime)) {
      // Esegui l'attacco
      this.performAttack(attackerEntity, attackerTransform, attackerDamage, targetTransform, playerEntity);
    }
  }

  /**
   * Crea un proiettile dall'attaccante verso il target
   */
  private performAttack(attackerEntity: any, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform, targetEntity: any): void {
    // Calcola direzione del proiettile (verso il target)
    const dx = targetTransform.x - attackerTransform.x;
    const dy = targetTransform.y - attackerTransform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalizza la direzione
    const directionX = dx / distance;
    const directionY = dy / distance;

    // Crea il proiettile leggermente avanti all'attaccante per evitare auto-collisione
    const projectileX = attackerTransform.x + directionX * 25; // 25 pixel avanti (dimensione nave)
    const projectileY = attackerTransform.y + directionY * 25;

    // Crea l'entità proiettile
    const projectileEntity = this.ecs.createEntity();

    // Aggiungi componenti al proiettile
    const projectileTransform = new Transform(projectileX, projectileY, 0, 1, 1);
    const projectile = new Projectile(attackerDamage.damage, 400, directionX, directionY, attackerEntity.id, targetEntity.id, 3000);

    this.ecs.addComponent(projectileEntity, Transform, projectileTransform);
    this.ecs.addComponent(projectileEntity, Projectile, projectile);

    // Registra l'attacco per il cooldown
    attackerDamage.performAttack(this.lastUpdateTime);
  }

  /**
   * Ruota l'entità attaccante per puntare verso il target
   */
  private faceTarget(attackerTransform: Transform, targetTransform: Transform): void {
    const dx = targetTransform.x - attackerTransform.x;
    const dy = targetTransform.y - attackerTransform.y;

    // Calcola l'angolo e ruota la nave
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    attackerTransform.rotation = angle;
  }

  /**
   * Elabora il combattimento automatico del player contro NPC selezionati
   */
  private processPlayerCombat(): void {
    // Trova l'NPC selezionato
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    if (selectedNpcs.length === 0) return;

    const selectedNpc = selectedNpcs[0];

    // Trova il player
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform, Health, Damage);
    const playerEntity = playerEntities.find(entity => {
      return !this.ecs.hasComponent(entity, SelectedNpc);
    });

    if (!playerEntity) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const playerDamage = this.ecs.getComponent(playerEntity, Damage);
    const npcHealth = this.ecs.getComponent(selectedNpc, Health);

    if (!playerTransform || !playerDamage || !npcHealth) return;

    // Controlla se il player è nel range di attacco
    const npcTransform = this.ecs.getComponent(selectedNpc, Transform);
    if (!npcTransform) return;

    if (playerDamage.isInRange(
      playerTransform.x, playerTransform.y,
      npcTransform.x, npcTransform.y
    )) {
      if (playerDamage.canAttack(this.lastUpdateTime)) {
        // Ruota il player verso l'NPC prima di attaccare
        this.faceTarget(playerTransform, npcTransform);

        // Il player spara un proiettile verso l'NPC
        this.performAttack(playerEntity, playerTransform, playerDamage, npcTransform, selectedNpc);
      }
    }
  }

  /**
   * Forza un attacco immediato per testare i proiettili
   */
  forceAttack(): void {
    // Trova il primo NPC disponibile
    const allNpcs = this.ecs.getEntitiesWithComponents(Npc, Damage, Transform);
    if (allNpcs.length === 0) return;

    const npcEntity = allNpcs[0];

    // Trova il player
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform, Health, Damage);
    const playerEntity = playerEntities.find(entity => {
      return !this.ecs.hasComponent(entity, SelectedNpc);
    });

    if (!playerEntity) return;

    const npcTransform = this.ecs.getComponent(npcEntity, Transform);
    const npcDamage = this.ecs.getComponent(npcEntity, Damage);
    const playerTransform = this.ecs.getComponent(playerEntity, Transform);

    if (!npcTransform || !npcDamage || !playerTransform) return;

    // Forza l'attacco ignorando range e cooldown
    this.performAttack(npcEntity, npcTransform, npcDamage, playerTransform, playerEntity);
  }

  /**
   * Permette al player di attaccare un NPC selezionato (per uso futuro)
   */
  attackSelectedNpc(): void {
    // Trova l'NPC selezionato
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    if (selectedNpcs.length === 0) return;

    const selectedNpc = selectedNpcs[0];

    // Trova il player (entità senza SelectedNpc ma con Damage e Health)
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform, Health, Damage);
    const playerEntity = playerEntities.find(entity => {
      return !this.ecs.hasComponent(entity, SelectedNpc);
    });

    if (!playerEntity) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const playerDamage = this.ecs.getComponent(playerEntity, Damage);
    const npcHealth = this.ecs.getComponent(selectedNpc, Health);

    if (!playerTransform || !playerDamage || !npcHealth) return;

    // Controlla se il player è nel range di attacco
    const npcTransform = this.ecs.getComponent(selectedNpc, Transform);
    if (!npcTransform) return;

    if (playerDamage.isInRange(
      playerTransform.x, playerTransform.y,
      npcTransform.x, npcTransform.y
    )) {
      if (playerDamage.canAttack(this.lastUpdateTime)) {
        // Ruota il player verso l'NPC prima di attaccare
        this.faceTarget(playerTransform, npcTransform);

        // Il player spara un proiettile verso l'NPC
        this.performAttack(playerEntity, playerTransform, playerDamage, npcTransform, selectedNpc);
      }
    }
  }

  /**
   * Rimuove tutte le entità morte dal mondo
   */
  private removeDeadEntities(): void {
    // Trova tutte le entità con componente Health
    const entitiesWithHealth = this.ecs.getEntitiesWithComponents(Health);

    for (const entity of entitiesWithHealth) {
      const health = this.ecs.getComponent(entity, Health);
      if (health && health.isDead()) {
        this.ecs.removeEntity(entity);
      }
    }
  }
}
