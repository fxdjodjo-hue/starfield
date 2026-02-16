import RESOURCE_CONFIG from '../../shared/resource-config.json';

export interface ResourceDefinition {
  id: string;
  displayName: string;
  assetBasePath: string;
  spriteScale: number;
  debugHitbox: boolean;
  clickRadius: number;
  collectDistance: number;
}

export interface ResourceSpawnPlan {
  resourceType: string;
  count: number;
}

interface ResourceConfigSchema {
  defaultCollectDistance?: number;
  resources?: Array<Partial<ResourceDefinition> & { id?: string }>;
  mapSpawns?: Record<string, Array<Partial<ResourceSpawnPlan>>>;
}

const SHARED_RESOURCE_CONFIG = RESOURCE_CONFIG as ResourceConfigSchema;

export const DEFAULT_RESOURCE_COLLECT_DISTANCE = Math.max(
  60,
  Math.floor(Number(SHARED_RESOURCE_CONFIG.defaultCollectDistance || 520))
);

const RESOURCE_DEFINITIONS: ResourceDefinition[] = Array.isArray(SHARED_RESOURCE_CONFIG.resources)
  ? SHARED_RESOURCE_CONFIG.resources
    .filter((resource): resource is Partial<ResourceDefinition> & { id: string } => !!resource && typeof resource.id === 'string')
    .map((resource) => ({
      id: resource.id,
      displayName: typeof resource.displayName === 'string' && resource.displayName.length > 0
        ? resource.displayName
        : resource.id,
      assetBasePath: typeof resource.assetBasePath === 'string' ? resource.assetBasePath : '',
      spriteScale: Number.isFinite(Number(resource.spriteScale))
        ? Math.max(0.01, Number(resource.spriteScale))
        : 1,
      debugHitbox: resource.debugHitbox === true,
      clickRadius: Number.isFinite(Number(resource.clickRadius))
        ? Math.max(10, Number(resource.clickRadius))
        : 95,
      collectDistance: Number.isFinite(Number(resource.collectDistance))
        ? Math.max(60, Number(resource.collectDistance))
        : DEFAULT_RESOURCE_COLLECT_DISTANCE
    }))
  : [];

const RESOURCE_INDEX = new Map<string, ResourceDefinition>(
  RESOURCE_DEFINITIONS.map((resource) => [resource.id, resource])
);

export function listResourceDefinitions(): ResourceDefinition[] {
  return RESOURCE_DEFINITIONS;
}

export function getResourceDefinition(resourceType: string): ResourceDefinition | null {
  return RESOURCE_INDEX.get(resourceType) || null;
}

export function listMapResourceSpawnPlans(mapId: string): ResourceSpawnPlan[] {
  const mapSpawns = SHARED_RESOURCE_CONFIG.mapSpawns || {};
  const raw = Array.isArray(mapSpawns[mapId]) ? mapSpawns[mapId] : [];

  return raw
    .filter((entry) => entry && typeof entry.resourceType === 'string')
    .map((entry) => ({
      resourceType: String(entry.resourceType),
      count: Math.max(0, Math.floor(Number(entry.count || 0)))
    }))
    .filter((entry) => entry.count > 0 && RESOURCE_INDEX.has(entry.resourceType));
}
