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
    this.defenseTargetByPlayerId = new Map();
    this.lastCleanupAt = 0;

    this.COLLECTION_COOLDOWN_MS = 1200;
    this.COLLECTION_RANGE_PX = 520;

    this.DEFENSE_REACTION_COOLDOWN_MS = 1300;
    this.DEFENSE_REACTION_RANGE_PX = 1800;
    this.DEFENSE_TARGET_STALE_MS = 18000;
    this.DEFENSE_PLAYER_DISENGAGE_RANGE_PX = 3400;
    this.DEFENSE_BASE_DAMAGE = 900;
    this.DEFENSE_LEVEL_DAMAGE_STEP = 0.08;
    this.DEFENSE_PROJECTILE_TYPE = 'pet_laser';
  }

  update(now = Date.now()) {
    this.cleanupStaleEntries(now);

    const players = this.mapServer?.players;
    if (!(players instanceof Map) || players.size === 0) return;

    for (const [clientId, playerData] of players.entries()) {
      const playerId = this.resolvePlayerId(clientId, playerData);
      if (!this.canRunPetModules(playerData)) {
        this.clearDefenseState(playerId);
        continue;
      }

      if (this.hasModule(playerData.petState, PET_MODULE_IDS.COLLECTION)) {
        this.tryAutoCollectResource(clientId, playerData, now);
      }

      if (this.hasModule(playerData.petState, PET_MODULE_IDS.DEFENSE)) {
        this.trySustainDefense(clientId, playerData, now);
      } else {
        this.clearDefenseState(playerId);
      }
    }
  }

  handleDefenseReaction(attackerNpc, playerData, now = Date.now()) {
    if (!this.canRunPetModules(playerData)) return false;
    if (!this.hasModule(playerData.petState, PET_MODULE_IDS.DEFENSE)) return false;

    const playerId = this.resolvePlayerId(null, playerData);
    if (!playerId) return false;

    const targetNpc = attackerNpc && typeof attackerNpc === 'object'
      ? attackerNpc
      : null;
    const npcId = String(targetNpc?.id || '').trim();
    if (!targetNpc || !npcId || !targetNpc.position) return false;
    if (!this.mapServer?.npcManager?.getNpc(npcId)) return false;

    this.setDefenseTarget(playerId, npcId, now);

    const projectileId = this.tryFireDefenseProjectile(playerId, playerData, targetNpc, now);
    if (process.env.DEBUG_PET_MODULES === 'true') {
      ServerLoggerWrapper.debug(
        'PET_MODULE',
        projectileId
          ? `Defense reaction fired by player ${playerId} against ${npcId} with projectile ${projectileId}`
          : `Defense target locked for player ${playerId}: ${npcId}`
      );
    }

    return !!projectileId;
  }

  removePlayer(clientId) {
    const normalizedClientId = String(clientId || '').trim();
    if (!normalizedClientId) return;
    this.collectionCooldownByPlayerId.delete(normalizedClientId);
    this.defenseCooldownByPlayerId.delete(normalizedClientId);
    this.defenseTargetByPlayerId.delete(normalizedClientId);
  }

  cleanupStaleEntries(now = Date.now()) {
    if (now - this.lastCleanupAt < 5000) return;
    this.lastCleanupAt = now;

    const activePlayerIds = new Set();
    const players = this.mapServer?.players;
    if (players instanceof Map) {
      for (const [clientId, playerData] of players.entries()) {
        const byClientId = String(clientId || '').trim();
        if (byClientId) {
          activePlayerIds.add(byClientId);
        }

        const byPlayerData = String(playerData?.clientId || '').trim();
        if (byPlayerData) {
          activePlayerIds.add(byPlayerData);
        }
      }
    }

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

    for (const [playerId, lockState] of this.defenseTargetByPlayerId.entries()) {
      if (!activePlayerIds.has(playerId)) {
        this.defenseTargetByPlayerId.delete(playerId);
        continue;
      }

      const lastSeenAt = Number(lockState?.lastSeenAt || 0);
      if (now - lastSeenAt > this.DEFENSE_TARGET_STALE_MS) {
        this.defenseTargetByPlayerId.delete(playerId);
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

  trySustainDefense(clientId, playerData, now = Date.now()) {
    const playerId = this.resolvePlayerId(clientId, playerData);
    if (!playerId) return false;

    const targetNpc = this.resolveDefenseTargetNpc(playerId, playerData, now);
    if (!targetNpc) return false;

    const projectileId = this.tryFireDefenseProjectile(playerId, playerData, targetNpc, now);
    return !!projectileId;
  }

  resolveDefenseTargetNpc(playerId, playerData, now = Date.now()) {
    if (!playerId) return null;

    const existingLock = this.defenseTargetByPlayerId.get(playerId);
    const existingNpcId = String(existingLock?.npcId || '').trim();
    if (existingNpcId) {
      const lockedNpc = this.mapServer?.npcManager?.getNpc(existingNpcId);
      if (!lockedNpc || !lockedNpc.position) {
        this.clearDefenseState(playerId);
      } else if (this.isTargetInPlayerDefenseWindow(playerData, lockedNpc)) {
        this.setDefenseTarget(playerId, existingNpcId, now);
        return lockedNpc;
      } else {
        this.clearDefenseState(playerId);
      }
    }
    return null;
  }

  isTargetInPlayerDefenseWindow(playerData, targetNpc) {
    const playerX = Number(playerData?.position?.x ?? playerData?.x);
    const playerY = Number(playerData?.position?.y ?? playerData?.y);
    const npcX = Number(targetNpc?.position?.x);
    const npcY = Number(targetNpc?.position?.y);

    if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) return true;
    if (!Number.isFinite(npcX) || !Number.isFinite(npcY)) return false;

    const distanceSq = this.distanceSq(playerX, playerY, npcX, npcY);
    const maxDistanceSq = this.DEFENSE_PLAYER_DISENGAGE_RANGE_PX * this.DEFENSE_PLAYER_DISENGAGE_RANGE_PX;
    return distanceSq <= maxDistanceSq;
  }

  tryFireDefenseProjectile(playerId, playerData, targetNpc, now = Date.now()) {
    if (!playerId || !targetNpc || !targetNpc.position) return null;

    const cooldownUntil = Number(this.defenseCooldownByPlayerId.get(playerId) || 0);
    if (now < cooldownUntil) return null;

    const petPosition = this.resolvePetPosition(playerData);
    if (!petPosition) return null;

    const npcX = Number(targetNpc.position.x);
    const npcY = Number(targetNpc.position.y);
    if (!Number.isFinite(npcX) || !Number.isFinite(npcY)) return null;

    const distanceSq = this.distanceSq(petPosition.x, petPosition.y, npcX, npcY);
    if (distanceSq > (this.DEFENSE_REACTION_RANGE_PX * this.DEFENSE_REACTION_RANGE_PX)) {
      return null;
    }

    const targetNpcId = String(targetNpc.id || '').trim();
    if (!targetNpcId) return null;

    const combatManager = this.mapServer?.combatManager;
    if (!combatManager || typeof combatManager.performAttack !== 'function') return null;

    const defenseDamage = this.resolveDefenseDamage(playerData.petState);
    const projectileId = combatManager.performAttack(
      playerId,
      petPosition,
      targetNpc.position,
      defenseDamage,
      this.DEFENSE_PROJECTILE_TYPE,
      targetNpcId
    );

    if (!projectileId) return null;

    this.defenseCooldownByPlayerId.set(playerId, now + this.DEFENSE_REACTION_COOLDOWN_MS);
    this.setDefenseTarget(playerId, targetNpcId, now);
    return projectileId;
  }

  setDefenseTarget(playerId, npcId, now = Date.now()) {
    const normalizedPlayerId = String(playerId || '').trim();
    const normalizedNpcId = String(npcId || '').trim();
    if (!normalizedPlayerId || !normalizedNpcId) return;

    this.defenseTargetByPlayerId.set(normalizedPlayerId, {
      npcId: normalizedNpcId,
      lastSeenAt: now
    });
  }

  getDefenseTargetNpcId(playerId, now = Date.now()) {
    const normalizedPlayerId = String(playerId || '').trim();
    if (!normalizedPlayerId) return null;

    const lockState = this.defenseTargetByPlayerId.get(normalizedPlayerId);
    const npcId = String(lockState?.npcId || '').trim();
    if (!npcId) return null;

    const lastSeenAt = Number(lockState?.lastSeenAt || 0);
    if (Number.isFinite(lastSeenAt) && now - lastSeenAt > this.DEFENSE_TARGET_STALE_MS) {
      this.clearDefenseState(normalizedPlayerId);
      return null;
    }

    const npc = this.mapServer?.npcManager?.getNpc(npcId);
    if (!npc || !npc.position) {
      this.clearDefenseState(normalizedPlayerId);
      return null;
    }

    return npcId;
  }

  clearDefenseState(playerId) {
    const normalizedPlayerId = String(playerId || '').trim();
    if (!normalizedPlayerId) return;
    this.defenseCooldownByPlayerId.delete(normalizedPlayerId);
    this.defenseTargetByPlayerId.delete(normalizedPlayerId);
  }

  resolvePlayerId(clientId, playerData) {
    const byPlayerData = String(playerData?.clientId || '').trim();
    if (byPlayerData) return byPlayerData;

    const byClientId = String(clientId || '').trim();
    if (byClientId) return byClientId;
    return null;
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
