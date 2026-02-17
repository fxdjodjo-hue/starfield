import type { ECS } from '../../../../infrastructure/ecs/ECS';
import { Health } from '../../../../entities/combat/Health';
import { Shield } from '../../../../entities/combat/Shield';
import { Pet } from '../../../../entities/player/Pet';
import { RemotePet } from '../../../../entities/player/RemotePet';
import type { PetStatePayload } from '../../../../config/NetworkConfig';

interface NormalizedPetCombatState {
  petId: string;
  petNickname: string;
  isActive: boolean;
  currentHealth: number;
  maxHealth: number;
  currentShield: number;
  maxShield: number;
}

function normalizePetCombatState(petState: PetStatePayload): NormalizedPetCombatState | null {
  if (!petState || typeof petState !== 'object') return null;

  const petId = String(petState.petId || '').trim();
  if (!petId) return null;
  const petNickname = String(petState.petNickname ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24)
    .trim();

  const maxHealth = Math.max(1, Math.floor(Number(petState.maxHealth || 1)));
  const currentHealth = Math.max(
    0,
    Math.min(maxHealth, Math.floor(Number(petState.currentHealth ?? maxHealth)))
  );

  // Keep shield max >= 1 to avoid division-by-zero in HUD percentage rendering.
  const maxShield = Math.max(1, Math.floor(Number(petState.maxShield || 0)));
  const currentShield = Math.max(
    0,
    Math.min(maxShield, Math.floor(Number(petState.currentShield ?? maxShield)))
  );

  return {
    petId,
    petNickname: petNickname || petId,
    isActive: petState.isActive !== false,
    currentHealth,
    maxHealth,
    currentShield,
    maxShield
  };
}

function findLocalPetEntity(ecs: ECS, expectedPetId: string): any | null {
  const petEntities = ecs.getEntitiesWithComponents(Pet);
  if (!Array.isArray(petEntities) || petEntities.length === 0) return null;

  const matchedEntity = petEntities.find((entity) => {
    if (ecs.hasComponent(entity, RemotePet)) return false;
    const petComponent = ecs.getComponent(entity, Pet);
    return petComponent && String(petComponent.petId || '') === expectedPetId;
  });

  if (matchedEntity) return matchedEntity;

  const fallbackLocalPet = petEntities.find((entity) => !ecs.hasComponent(entity, RemotePet));
  return fallbackLocalPet || null;
}

export function syncLocalPetCombatStats(ecs: ECS | null, petState: PetStatePayload): void {
  if (!ecs) return;

  const normalizedState = normalizePetCombatState(petState);
  if (!normalizedState) return;

  const petEntity = findLocalPetEntity(ecs, normalizedState.petId);
  if (!petEntity) return;
  const petComponent = ecs.getComponent(petEntity, Pet);
  if (petComponent && typeof petComponent.setNickname === 'function') {
    petComponent.setNickname(normalizedState.petNickname);
    if (typeof petComponent.setActiveState === 'function') {
      petComponent.setActiveState(normalizedState.isActive);
    } else {
      (petComponent as any).isActive = normalizedState.isActive;
    }
  }

  const healthComponent = ecs.getComponent(petEntity, Health);
  if (healthComponent) {
    healthComponent.setHealth(normalizedState.currentHealth, normalizedState.maxHealth);
  } else {
    ecs.addComponent(
      petEntity,
      Health,
      new Health(normalizedState.currentHealth, normalizedState.maxHealth)
    );
  }

  const shieldComponent = ecs.getComponent(petEntity, Shield);
  if (shieldComponent) {
    shieldComponent.setShield(normalizedState.currentShield, normalizedState.maxShield);
  } else {
    ecs.addComponent(
      petEntity,
      Shield,
      new Shield(normalizedState.currentShield, normalizedState.maxShield)
    );
  }
}
