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

    console.log(`=== COMBAT SYSTEM UPDATE ===`);
    console.log(`Delta time: ${deltaTime}`);

    // Rimuovi tutte le entità morte
    this.removeDeadEntities();

    // Combattimento automatico per NPC selezionati
    this.processPlayerCombat();

    // NPC attaccano automaticamente il player quando nel range (tutti gli NPC, non solo selezionati)
    const allNpcs = this.ecs.getEntitiesWithComponents(Npc, Damage, Transform);
    console.log(`Found ${allNpcs.length} NPCs that can attack`);

    for (const attackerEntity of allNpcs) {
      this.processNpcCombat(attackerEntity);
    }

    console.log(`=== COMBAT SYSTEM UPDATE END ===`);
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

    if (!playerEntity) {
      console.log('No player entity found for NPC combat');
      return;
    }

    const targetTransform = this.ecs.getComponent(playerEntity, Transform);
    const targetHealth = this.ecs.getComponent(playerEntity, Health);

    if (!targetTransform || !targetHealth) {
      console.log('Missing player components for combat');
      return;
    }

    // Verifica se il player è nel range di attacco dell'NPC
    const distance = Math.sqrt(
      Math.pow(attackerTransform.x - targetTransform.x, 2) +
      Math.pow(attackerTransform.y - targetTransform.y, 2)
    );

    console.log(`NPC ${attackerEntity.id} at (${attackerTransform.x.toFixed(0)}, ${attackerTransform.y.toFixed(0)}) checking combat with player at (${targetTransform.x.toFixed(0)}, ${targetTransform.y.toFixed(0)}), distance: ${distance.toFixed(0)}, range: ${attackerDamage.attackRange}`);

    if (attackerDamage.isInRange(
      attackerTransform.x, attackerTransform.y,
      targetTransform.x, targetTransform.y
    )) {
      console.log(`Player is in range! Checking if NPC can attack...`);
      // Verifica se l'NPC può attaccare (cooldown)
      if (attackerDamage.canAttack(this.lastUpdateTime)) {
        console.log(`NPC can attack! Performing attack...`);
        // Esegui l'attacco
        this.performAttack(attackerEntity, attackerTransform, attackerDamage, targetTransform, playerEntity);
        console.log(`NPC fired projectile at player! Distance: ${distance.toFixed(0)}, range: ${attackerDamage.attackRange}`);
      } else {
        console.log(`NPC attack on cooldown`);
      }
    } else {
      console.log(`Player out of range for NPC attack`);
    }
  }

  /**
   * Crea un proiettile dall'attaccante verso il target
   */
  private performAttack(attackerEntity: any, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform, targetEntity: any): void {
    console.log(`=== PERFORM ATTACK STARTED ===`);
    console.log(`Attacker: ${attackerEntity.id}, Target position: (${targetTransform.x.toFixed(0)}, ${targetTransform.y.toFixed(0)})`);

    // Calcola direzione del proiettile (verso il target)
    const dx = targetTransform.x - attackerTransform.x;
    const dy = targetTransform.y - attackerTransform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    console.log(`Distance to target: ${distance.toFixed(0)}, damage: ${attackerDamage.damage}`);

    // Normalizza la direzione
    const directionX = dx / distance;
    const directionY = dy / distance;

    // Crea il proiettile leggermente avanti all'attaccante per evitare auto-collisione
    const projectileX = attackerTransform.x + directionX * 25; // 25 pixel avanti (dimensione nave)
    const projectileY = attackerTransform.y + directionY * 25;

    console.log(`Projectile spawn position: (${projectileX.toFixed(0)}, ${projectileY.toFixed(0)})`);

    // Crea l'entità proiettile
    const projectileEntity = this.ecs.createEntity();
    console.log(`✅ Created projectile entity with ID: ${projectileEntity.id}`);

    // Aggiungi componenti al proiettile
    const projectileTransform = new Transform(projectileX, projectileY, 0, 1, 1);
    const projectile = new Projectile(attackerDamage.damage, 400, directionX, directionY, attackerEntity.id, targetEntity.id, 3000);

    this.ecs.addComponent(projectileEntity, Transform, projectileTransform);
    this.ecs.addComponent(projectileEntity, Projectile, projectile);

    console.log(`✅ Added Transform and Projectile components to entity ${projectileEntity.id}`);
    console.log(`Projectile details: damage=${projectile.damage}, speed=${projectile.speed}, lifetime=${projectile.lifetime}`);

    // Registra l'attacco per il cooldown
    attackerDamage.performAttack(this.lastUpdateTime);

    console.log(`=== PERFORM ATTACK COMPLETED ===`);
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
        console.log(`Player fired projectile at NPC!`);

        // Controlla se l'NPC è morto
        if (npcHealth.isDead()) {
          console.log('NPC is dead! Removing from world...');
          // Rimuovi l'NPC morto dal mondo
          this.ecs.removeEntity(selectedNpc);
          console.log('NPC removed from world');
        }
      }
    }
  }

  /**
   * Forza un attacco immediato per testare i proiettili
   */
  forceAttack(): void {
    console.log('=== FORCE ATTACK CALLED ===');

    // Trova il primo NPC disponibile
    const allNpcs = this.ecs.getEntitiesWithComponents(Npc, Damage, Transform);
    if (allNpcs.length === 0) {
      console.log('No NPCs found for force attack');
      return;
    }

    const npcEntity = allNpcs[0];
    console.log(`Forcing attack with NPC ${npcEntity.id}`);

    // Trova il player
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform, Health, Damage);
    const playerEntity = playerEntities.find(entity => {
      return !this.ecs.hasComponent(entity, SelectedNpc);
    });

    if (!playerEntity) {
      console.log('No player found for force attack');
      return;
    }

    const npcTransform = this.ecs.getComponent(npcEntity, Transform);
    const npcDamage = this.ecs.getComponent(npcEntity, Damage);
    const playerTransform = this.ecs.getComponent(playerEntity, Transform);

    if (!npcTransform || !npcDamage || !playerTransform) {
      console.log('Missing components for force attack');
      return;
    }

    // Forza l'attacco ignorando range e cooldown
    console.log(`Forcing attack from NPC at (${npcTransform.x.toFixed(0)}, ${npcTransform.y.toFixed(0)}) to player at (${playerTransform.x.toFixed(0)}, ${playerTransform.y.toFixed(0)})`);
    this.performAttack(npcEntity, npcTransform, npcDamage, playerTransform, playerEntity);
  }

  /**
   * Permette al player di attaccare un NPC selezionato (per uso futuro)
   */
  attackSelectedNpc(): void {
    console.log('CombatSystem.attackSelectedNpc() called');

    // Trova l'NPC selezionato
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    console.log(`Found ${selectedNpcs.length} selected NPCs`);

    if (selectedNpcs.length === 0) return;

    const selectedNpc = selectedNpcs[0];

    // Trova il player (entità senza SelectedNpc ma con Damage e Health)
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform, Health, Damage);
    const playerEntity = playerEntities.find(entity => {
      return !this.ecs.hasComponent(entity, SelectedNpc);
    });

    console.log(`Found ${playerEntities.length} player entities, selected: ${!!playerEntity}`);

    if (!playerEntity) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const playerDamage = this.ecs.getComponent(playerEntity, Damage);
    const npcHealth = this.ecs.getComponent(selectedNpc, Health);

    if (!playerTransform || !playerDamage || !npcHealth) {
      console.log('Missing components:', {
        playerTransform: !!playerTransform,
        playerDamage: !!playerDamage,
        npcHealth: !!npcHealth
      });
      return;
    }

    // Controlla se il player è nel range di attacco
    const npcTransform = this.ecs.getComponent(selectedNpc, Transform);
    if (!npcTransform) {
      console.log('Missing NPC transform');
      return;
    }

    const distance = Math.sqrt(
      Math.pow(playerTransform.x - npcTransform.x, 2) +
      Math.pow(playerTransform.y - npcTransform.y, 2)
    );

    if (playerDamage.isInRange(
      playerTransform.x, playerTransform.y,
      npcTransform.x, npcTransform.y
    )) {
      console.log(`Player attacking NPC - distance: ${distance.toFixed(0)}, range: ${playerDamage.attackRange}`);
      if (playerDamage.canAttack(this.lastUpdateTime)) {
        console.log('Player can attack!');

        // Ruota il player verso l'NPC prima di attaccare
        this.faceTarget(playerTransform, npcTransform);

        // Il player spara un proiettile verso l'NPC
        this.performAttack(playerEntity, playerTransform, playerDamage, npcTransform, selectedNpc);
        console.log(`Player fired projectile at NPC!`);

        // Controlla se l'NPC è morto
        if (npcHealth.isDead()) {
          console.log('NPC is dead! Removing from world...');
          // Rimuovi l'NPC morto dal mondo
          this.ecs.removeEntity(selectedNpc);
          console.log('NPC removed from world');
        } else {
          console.log(`NPC still alive with ${npcHealth.current} HP`);
        }
      } else {
        console.log('Player attack on cooldown');
      }
    } else {
      console.log('NPC is out of attack range');
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
        console.log(`Entity ${entity.id} is dead, removing from world`);
        this.ecs.removeEntity(entity);
      }
    }
  }
}
