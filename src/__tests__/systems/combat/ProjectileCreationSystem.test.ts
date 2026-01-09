import { describe, it, expect } from 'vitest';
import { ProjectileCreationSystem } from '../../../systems/combat/ProjectileCreationSystem';
import { ECS } from '../../../infrastructure/ecs/ECS';
import { Entity } from '../../../infrastructure/ecs/Entity';
import { Transform } from '../../../entities/spatial/Transform';
import { Damage } from '../../../entities/combat/Damage';
import { PlayerSystem } from '../../../systems/player/PlayerSystem';

describe('ProjectileCreationSystem', () => {
  let ecs: ECS;
  let projectileSystem: ProjectileCreationSystem;
  let playerSystem: PlayerSystem;
  let attackerEntity: Entity;
  let targetEntity: Entity;

  beforeEach(() => {
    ecs = new ECS();
    projectileSystem = new ProjectileCreationSystem(ecs);
    playerSystem = new PlayerSystem(ecs);

    // Crea entità di test
    attackerEntity = ecs.createEntity();
    targetEntity = ecs.createEntity();

    // Aggiungi componenti necessari
    ecs.addComponent(attackerEntity, Transform, new Transform(100, 100, 0));
    ecs.addComponent(attackerEntity, Damage, new Damage(50, 1000, 600));
    ecs.addComponent(targetEntity, Transform, new Transform(200, 100, 0));

    // Collega il PlayerSystem
    projectileSystem.setPlayerSystem(playerSystem);
  });

  it('should create instance', () => {
    expect(projectileSystem).toBeDefined();
    expect(projectileSystem).toBeInstanceOf(ProjectileCreationSystem);
  });

  it('should perform attack and create projectile', () => {
    // Imposta l'attacker come player nel PlayerSystem
    (playerSystem as any).playerEntity = attackerEntity;

    const attackerTransform = ecs.getComponent(attackerEntity, Transform)!;
    const attackerDamage = ecs.getComponent(attackerEntity, Damage)!;
    const targetTransform = ecs.getComponent(targetEntity, Transform)!;

    // Conta entità prima dell'attacco
    const entitiesBefore = ecs.getEntitiesWithComponents().length;

    // Esegui attacco
    projectileSystem.performAttack(attackerEntity, attackerTransform, attackerDamage, targetTransform, targetEntity);

    // Dovrebbe aver creato nuove entità (proiettile)
    const entitiesAfter = ecs.getEntitiesWithComponents().length;
    expect(entitiesAfter).toBeGreaterThan(entitiesBefore);
  });

  it('should cleanup on destroy', () => {
    // Imposta alcuni sistemi
    projectileSystem.setPlayerSystem(playerSystem);

    // Verifica che i riferimenti siano impostati
    expect((projectileSystem as any).playerSystem).toBe(playerSystem);

    // Cleanup
    projectileSystem.destroy();

    // I riferimenti dovrebbero essere null
    expect((projectileSystem as any).clientNetworkSystem).toBeNull();
    expect((projectileSystem as any).audioSystem).toBeNull();
    expect((projectileSystem as any).playerSystem).toBeNull();
  });
});