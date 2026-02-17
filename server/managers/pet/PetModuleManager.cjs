const ServerLoggerWrapper = require('../../core/infrastructure/ServerLoggerWrapper.cjs');
const { normalizePlayerPetState } = require('../../config/PetCatalog.cjs');

const PET_MODULE_IDS = Object.freeze({
  COLLECTION: 'pet_module_collection',
  DEFENSE: 'pet_module_defense'
});

class PetModuleManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.collectionCooldownByPlayerId = new Map();
    this.defenseCooldownByPlayerId = new Map();
    this.lastCleanupAt = 0;

    this.COLLECTION_COOLDOWN_MS = 1200;
    this.COLLECTION_RANGE_PX = 520;

    this.DEFENSE_REACTION_COOLDOWN_MS = 1300;
    this.DEFENSE_REACTION_RANGE_PX = 1800;
    this.DEFENSE_BASE_DAMAGE = 900;
    this.DEFENSE_LEVEL_DAMAGE_STEP = 0.08;
    this.DEFENSE_PROJECTILE_TYPE = 'laser';
  }

  update(now = Date.now()) {
    this.cleanupStaleEntries(now);

    const players = this.mapServer?.players;
    if (!(players instanceof Map) || players.size === 0) return;

    for (const [clientId, playerData] of players.entries()) {
      if (!this.canRunPetModules(playerData)) continue;
      if (!this.hasModule(playerData.petState, PET_MODULE_IDS.COLLECTION)) continue;
      this.tryAutoCollectResource(clientId, playerData, now);
    }
  }

  handleDefenseReaction(attackerNpc, playerData, now = Date.now()) {
    if (!this.canRunPetModules(playerData)) return false;
    if (!this.hasModule(playerData.petState, PET_MODULE_IDS.DEFENSE)) return false;

    const playerId = String(playerData?.clientId || '').trim();
    if (!playerId) return false;

    const cooldownUntil = Number(this.defenseCooldownByPlayerId.get(playerId) || 0);
    if (now < cooldownUntil) return false;

    const targetNpc = attackerNpc && typeof attackerNpc === 'object'
      ? attackerNpc
      : null;
    const npcId = String(targetNpc?.id || '').trim();
    if (!targetNpc || !npcId || !targetNpc.position) return false;
    if (!this.mapServer?.npcManager?.getNpc(npcId)) return false;

    const petPosition = this.resolvePetPosition(playerData);
    if (!petPosition) return false;

    const npcX = Number(targetNpc.position.x);
    const npcY = Number(targetNpc.position.y);
    if (!Number.isFinite(npcX) || !Number.isFinite(npcY)) return false;

    const distanceSq = this.distanceSq(petPosition.x, petPosition.y, npcX, npcY);
    if (distanceSq > (this.DEFENSE_REACTION_RANGE_PX * this.DEFENSE_REACTION_RANGE_PX)) {
      return false;
    }

    const combatManager = this.mapServer?.combatManager;
    if (!combatManager || typeof combatManager.performAttack !== 'function') return false;

    const defenseDamage = this.resolveDefenseDamage(playerData.petState);
    const projectileId = combatManager.performAttack(
      playerId,
      petPosition,
      targetNpc.position,
      defenseDamage,
      this.DEFENSE_PROJECTILE_TYPE,
      npcId
    );

    if (!projectileId) return false;

    this.defenseCooldownByPlayerId.set(playerId, now + this.DEFENSE_REACTION_COOLDOWN_MS);

    if (process.env.DEBUG_PET_MODULES === 'true') {
      ServerLoggerWrapper.debug(
        'PET_MODULE',
        `Defense reaction fired by player ${playerId} against ${npcId} with projectile ${projectileId}`
      );
    }

    return true;
  }

  removePlayer(clientId) {
    const normalizedClientId = String(clientId || '').trim();
    if (!normalizedClientId) return;
    this.collectionCooldownByPlayerId.delete(normalizedClientId);
    this.defenseCooldownByPlayerId.delete(normalizedClientId);
  }

  cleanupStaleEntries(now = Date.now()) {
    if (now - this.lastCleanupAt < 5000) return;
    this.lastCleanupAt = now;

    const activePlayerIds = new Set(
      Array.from(this.mapServer?.players?.keys?.() || []).map((clientId) => String(clientId || '').trim())
    );

    for (const playerId of this.collectionCooldownByPlayerId.keys()) {
      if (!activePlayerIds.has(playerId)) {
        this.collectionCooldownByPlayerId.delete(playerId);
      }
    }

    for (const playerId of this.defenseCooldownByPlayerId.keys()) {
      if (!activePlayerIds.has(playerId)) {
        this.defenseCooldownByPlayerId.delete(playerId);
      }
    }
  }

  tryAutoCollectResource(clientId, playerData, now = Date.now()) {
    const normalizedClientId = String(clientId || '').trim();
    if (!normalizedClientId) return;

    const cooldownUntil = Number(this.collectionCooldownByPlayerId.get(normalizedClientId) || 0);
    if (now < cooldownUntil) return;

    const resourceManager = this.mapServer?.resourceManager;
    if (!resourceManager || typeof resourceManager.autoCollectNearestResource !== 'function') {
      return;
    }

    const petPosition = this.resolvePetPosition(playerData);
    if (!petPosition) return;

    const collectResult = resourceManager.autoCollectNearestResource(
      playerData,
      petPosition,
      this.COLLECTION_RANGE_PX,
      {
        collectorType: 'pet',
        reason: 'pet_auto_collect'
      }
    );

    if (!collectResult?.ok) return;

    this.collectionCooldownByPlayerId.set(
      normalizedClientId,
      now + this.COLLECTION_COOLDOWN_MS
    );

    if (process.env.DEBUG_PET_MODULES === 'true') {
      ServerLoggerWrapper.debug(
        'PET_MODULE',
        `Collection auto-pick for ${normalizedClientId}: ${collectResult.resourceType || 'resource'}`
      );
    }
  }

  canRunPetModules(playerData) {
    if (!playerData || typeof playerData !== 'object') return false;
    if (playerData.isDead) return false;

    const normalizedPetState = normalizePlayerPetState(playerData.petState);
    playerData.petState = normalizedPetState;

    const petId = String(normalizedPetState?.petId || '').trim();
    if (!petId) return false;
    if (normalizedPetState.isActive === false) return false;
    return true;
  }

  resolvePetPosition(playerData) {
    const petX = Number(playerData?.petPosition?.x);
    const petY = Number(playerData?.petPosition?.y);
    const petRotation = Number(playerData?.petPosition?.rotation);
    if (Number.isFinite(petX) && Number.isFinite(petY)) {
      return {
        x: petX,
        y: petY,
        rotation: Number.isFinite(petRotation) ? petRotation : 0
      };
    }

    const playerX = Number(playerData?.position?.x ?? playerData?.x);
    const playerY = Number(playerData?.position?.y ?? playerData?.y);
    const playerRotation = Number(playerData?.position?.rotation ?? playerData?.rotation);
    if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) {
      return null;
    }

    const fallbackRotation = Number.isFinite(playerRotation) ? playerRotation : 0;
    const offset = 80;
    const offsetAngle = fallbackRotation + Math.PI;

    return {
      x: playerX + Math.cos(offsetAngle) * offset,
      y: playerY + Math.sin(offsetAngle) * offset,
      rotation: fallbackRotation
    };
  }

  hasModule(rawPetState, moduleId) {
    const normalizedModuleId = String(moduleId || '').trim().toLowerCase();
    if (!normalizedModuleId) return false;

    const petState = normalizePlayerPetState(rawPetState);
    const equippedModuleId = String(petState?.moduleSlot?.itemId || '').trim().toLowerCase();
    if (equippedModuleId !== normalizedModuleId) {
      return false;
    }

    const petInventory = Array.isArray(petState?.inventory) ? petState.inventory : [];
    if (!petInventory.length) {
      // Backward compatibility with legacy states where modules were tracked only in moduleSlot.
      return true;
    }

    return petInventory.some((item) => {
      const itemId = String(item?.itemId || '').trim().toLowerCase();
      const quantity = Math.max(0, Math.floor(Number(item?.quantity || 0)));
      return itemId === normalizedModuleId && quantity > 0;
    });
  }

  resolveDefenseDamage(rawPetState) {
    const petState = normalizePlayerPetState(rawPetState);
    const level = Math.max(1, Math.floor(Number(petState?.level || 1)));
    const levelMultiplier = 1 + ((level - 1) * this.DEFENSE_LEVEL_DAMAGE_STEP);
    return Math.max(1, Math.floor(this.DEFENSE_BASE_DAMAGE * levelMultiplier));
  }

  distanceSq(x1, y1, x2, y2) {
    const dx = Number(x1) - Number(x2);
    const dy = Number(y1) - Number(y2);
    return (dx * dx) + (dy * dy);
  }
}

module.exports = PetModuleManager;
