import PET_CONFIG from '../../shared/pets.json';

export interface PlayerPetDefinition {
  id: string;
  displayName: string;
  assetBasePath: string;
  spriteScale: number;
  frameRotationDirection: 1 | -1;
  frameRotationOffsetRad: number;
  followDistance: number;
  lateralOffset: number;
  stopDistance: number;
  catchUpDistance: number;
  maxFollowSpeed: number;
  rotationFollowSpeed: number;
  hoverAmplitude: number;
  hoverFrequency: number;
}

interface SharedPetDefinition {
  id?: string;
  displayName?: string;
  assetBasePath?: string;
  spriteScale?: number;
  frameRotationDirection?: number;
  frameRotationOffsetRad?: number;
  followDistance?: number;
  lateralOffset?: number;
  stopDistance?: number;
  catchUpDistance?: number;
  maxFollowSpeed?: number;
  rotationFollowSpeed?: number;
  hoverAmplitude?: number;
  hoverFrequency?: number;
}

interface SharedPetConfig {
  defaultPetId?: string;
  pets?: SharedPetDefinition[];
}

const SHARED_PET_CONFIG = PET_CONFIG as SharedPetConfig;
const FALLBACK_PET_ID = 'ship50';

const PLAYER_PET_DEFINITIONS: PlayerPetDefinition[] = Array.isArray(SHARED_PET_CONFIG.pets)
  ? SHARED_PET_CONFIG.pets
    .filter((pet): pet is SharedPetDefinition & { id: string } => !!pet && typeof pet.id === 'string')
    .map((pet) => {
      const id = String(pet.id || '').trim();
      const followDistance = Number.isFinite(Number(pet.followDistance))
        ? Math.max(40, Math.floor(Number(pet.followDistance)))
        : 160;
      const stopDistance = Number.isFinite(Number(pet.stopDistance))
        ? Math.max(0, Math.floor(Number(pet.stopDistance)))
        : 24;
      const frameRotationDirection: 1 | -1 = Number(pet.frameRotationDirection) === 1 ? 1 : -1;
      const frameRotationOffsetRad = Number.isFinite(Number(pet.frameRotationOffsetRad))
        ? Number(pet.frameRotationOffsetRad)
        : 0;

      return {
        id,
        displayName: typeof pet.displayName === 'string' && pet.displayName.length > 0
          ? pet.displayName
          : id,
        assetBasePath: typeof pet.assetBasePath === 'string'
          ? pet.assetBasePath
          : '',
        spriteScale: Number.isFinite(Number(pet.spriteScale))
          ? Math.max(0.01, Number(pet.spriteScale))
          : 0.35,
        frameRotationDirection,
        frameRotationOffsetRad,
        followDistance,
        lateralOffset: Number.isFinite(Number(pet.lateralOffset))
          ? Number(pet.lateralOffset)
          : 90,
        stopDistance,
        catchUpDistance: Number.isFinite(Number(pet.catchUpDistance))
          ? Math.max(followDistance + stopDistance, Math.floor(Number(pet.catchUpDistance)))
          : Math.max(640, followDistance * 3),
        maxFollowSpeed: Number.isFinite(Number(pet.maxFollowSpeed))
          ? Math.max(10, Math.floor(Number(pet.maxFollowSpeed)))
          : 900,
        rotationFollowSpeed: Number.isFinite(Number(pet.rotationFollowSpeed))
          ? Math.max(0.1, Number(pet.rotationFollowSpeed))
          : 8,
        hoverAmplitude: Number.isFinite(Number(pet.hoverAmplitude))
          ? Math.max(0, Number(pet.hoverAmplitude))
          : 12,
        hoverFrequency: Number.isFinite(Number(pet.hoverFrequency))
          ? Math.max(0, Number(pet.hoverFrequency))
          : 2.2
      };
    })
    .filter((pet) => pet.id.length > 0)
  : [];

const PLAYER_PET_INDEX = new Map<string, PlayerPetDefinition>(
  PLAYER_PET_DEFINITIONS.map((pet) => [pet.id, pet])
);

function resolveDefaultPlayerPetId(): string {
  const configDefaultPetId = String(SHARED_PET_CONFIG.defaultPetId || '').trim();
  if (configDefaultPetId && PLAYER_PET_INDEX.has(configDefaultPetId)) {
    return configDefaultPetId;
  }

  if (PLAYER_PET_INDEX.has(FALLBACK_PET_ID)) {
    return FALLBACK_PET_ID;
  }

  const first = PLAYER_PET_DEFINITIONS[0];
  return first?.id || FALLBACK_PET_ID;
}

export const DEFAULT_PLAYER_PET_ID = resolveDefaultPlayerPetId();

export function listPlayerPetDefinitions(): PlayerPetDefinition[] {
  return PLAYER_PET_DEFINITIONS;
}

export function getPlayerPetById(petId?: string | null): PlayerPetDefinition | null {
  if (!petId) return null;
  return PLAYER_PET_INDEX.get(petId) || null;
}

export function getDefaultPlayerPet(): PlayerPetDefinition | null {
  return getPlayerPetById(DEFAULT_PLAYER_PET_ID);
}
