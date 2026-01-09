import { describe, it, expect } from 'vitest';
import { DamageSystem } from '../../../systems/combat/DamageSystem';
import { ECS } from '../../../infrastructure/ecs/ECS';
import { Entity } from '../../../infrastructure/ecs/Entity';

describe('DamageSystem', () => {
  let ecs: ECS;
  let damageSystem: DamageSystem;
  let testEntity: Entity;

  beforeEach(() => {
    ecs = new ECS();
    damageSystem = new DamageSystem(ecs);
    testEntity = ecs.createEntity();
  });

  it('should create instance', () => {
    expect(damageSystem).toBeDefined();
    expect(damageSystem).toBeInstanceOf(DamageSystem);
  });

  it('should create damage text', () => {
    // Mock delle entità necessarie
    const entitiesWithDamageText = ecs.getEntitiesWithComponents();
    const initialCount = entitiesWithDamageText.length;

    damageSystem.createDamageText(testEntity, 50);

    // Dovrebbe aver creato un'entità per il testo di danno
    const entitiesAfter = ecs.getEntitiesWithComponents();
    expect(entitiesAfter.length).toBeGreaterThan(initialCount);
  });

  it('should track active damage texts', () => {
    damageSystem.createDamageText(testEntity, 25);
    damageSystem.createDamageText(testEntity, 50);

    // Dovrebbe tracciare 2 testi attivi
    expect((damageSystem as any).activeDamageTexts.get(testEntity.id)).toBe(2);
  });

  it('should decrement damage text count', () => {
    damageSystem.createDamageText(testEntity, 25);
    damageSystem.createDamageText(testEntity, 50);

    // Dovrebbe avere 2 testi attivi
    expect((damageSystem as any).activeDamageTexts.get(testEntity.id)).toBe(2);

    // Decrementa il contatore
    damageSystem.decrementDamageTextCount(testEntity.id);

    // Dovrebbe avere 1 testo attivo
    expect((damageSystem as any).activeDamageTexts.get(testEntity.id)).toBe(1);
  });

  it('should cleanup on destroy', () => {
    damageSystem.createDamageText(testEntity, 25);
    damageSystem.createDamageText(testEntity, 50);

    // Verifica che ci siano testi attivi
    expect((damageSystem as any).activeDamageTexts.size).toBeGreaterThan(0);

    // Cleanup
    damageSystem.destroy();

    // Tutti i testi dovrebbero essere stati rimossi
    expect((damageSystem as any).activeDamageTexts.size).toBe(0);
  });
});