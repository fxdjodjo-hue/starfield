// PlayerDataManager - Gestione operazioni database per player data
// Responsabilità: Load, save, honor snapshots, periodic save
// Dipendenze: logger.cjs, supabase client

const { logger } = require('../../logger.cjs');
const ServerLoggerWrapper = require('../infrastructure/ServerLoggerWrapper.cjs');
const { createSupabaseClient, getSupabaseConfig } = require('../../config/supabase.cjs');
const playerConfig = require('../../../shared/player-config.json');
const {
  DEFAULT_PLAYER_SHIP_SKIN_ID,
  normalizeUnlockedShipSkinIds,
  resolveSelectedShipSkinId
} = require('../../config/ShipSkinCatalog.cjs');
const {
  DEFAULT_PLAYER_PET_ID,
  createDefaultPlayerPetState,
  normalizePlayerPetState,
  buildPetStateSignature
} = require('../../config/PetCatalog.cjs');
const {
  normalizeAmmoInventory,
  getLegacyAmmoValue
} = require('../combat/AmmoInventory.cjs');
const {
  normalizeMissileInventory
} = require('../combat/MissileInventory.cjs');

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function auditIdentityConsistency(playerData, contextLabel) {
  if (!playerData) return;
  if (playerData._identityAuditLogged) return;

  const issues = [];
  const authId = playerData.userId;
  const playerDbId = playerData.playerId;

  if (!authId || typeof authId !== 'string') {
    issues.push('missing auth_id');
  } else if (!UUID_PATTERN.test(authId)) {
    issues.push('auth_id not UUID');
  }

  const numericPlayerId = Number(playerDbId);
  if (!Number.isFinite(numericPlayerId) || numericPlayerId <= 0) {
    issues.push('invalid player_id');
  }

  if (issues.length === 0) return;

  ServerLoggerWrapper.warn('DATABASE', `[ID AUDIT] ${contextLabel}: ${issues.join(', ')}`, {
    authId,
    playerDbId,
    clientId: playerData.clientId
  });
  playerData._identityAuditLogged = true;
}

// Supabase client - config centralizzata (dotenv.config() deve essere chiamato prima dell'import)
const { url: supabaseUrl, serviceKey: supabaseServiceKey } = getSupabaseConfig();

// Log per debug (solo se non in produzione)
if (process.env.NODE_ENV !== 'production') {
  ServerLoggerWrapper.database(`Supabase client initialized - URL: ${supabaseUrl.substring(0, 30)}..., Key length: ${supabaseServiceKey.length}`);
}

const supabase = createSupabaseClient({
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * Gestisce tutte le operazioni database relative ai player
 * TODO: Spostare da websocket-manager.cjs:
 *   - loadPlayerData() (linee 59-127)
 *   - savePlayerData() (linee 172-261)
 *   - createInitialPlayerRecords() (linee 132-167)
 *   - saveHonorSnapshot() (linee 266-280)
 *   - getRecentHonorAverage() (linee 285-302)
 *   - getDefaultPlayerData() (linee 307-331)
 *   - setupPeriodicSave() (linee 35-54)
 */
class PlayerDataManager {
  constructor(mapServer) {
    this.mapServer = mapServer;
    this.periodicSaveInterval = null;
    this.playerResourcesTableUnavailable = false;
    this.playerResourcesTableUnavailableMarkedAt = 0;
    this.playerResourcesTableRetryIntervalMs = 60000;
    this.lastSavedResourceInventorySignatureByAuthId = new Map();
    this.playerPetsTableUnavailable = false;
    this.playerPetsTableUnavailableMarkedAt = 0;
    this.playerPetsTableRetryIntervalMs = 60000;
    this.playerPetsModuleColumnsUnavailableLogged = false;
    this.playerAmmoTablesUnavailable = false;
    this.playerAmmoTablesUnavailableMarkedAt = 0;
    this.playerAmmoTablesRetryIntervalMs = 60000;
    this.playerAmmoSelectedColumnUnavailableLogged = false;
    this.lastSavedPetStateSignatureByAuthId = new Map();
    this.lastSavedAmmoInventorySignatureByAuthId = new Map();
    this.lastSavedQuestProgressSignatureByAuthId = new Map();
    this.lastSavedInventoryItemsSignatureByAuthId = new Map();
    this.saveInFlightByAuthId = new Map();
    this.savePendingRequestByAuthId = new Set();
    this.savePendingPlayerDataByAuthId = new Map();
  }

  /**
   * Restituisce il client Supabase per uso esterno
   * @returns {Object} Supabase client instance
   */
  getSupabaseClient() {
    return supabase;
  }

  normalizePlayerShipSkinState(shipSkinState) {
    const selectedSkinId = resolveSelectedShipSkinId(
      shipSkinState && typeof shipSkinState.selectedSkinId === 'string'
        ? shipSkinState.selectedSkinId
        : DEFAULT_PLAYER_SHIP_SKIN_ID
    );

    const unlockedSkinIds = normalizeUnlockedShipSkinIds(
      shipSkinState && Array.isArray(shipSkinState.unlockedSkinIds)
        ? shipSkinState.unlockedSkinIds
        : [],
      selectedSkinId
    );

    return {
      selectedSkinId,
      unlockedSkinIds
    };
  }

  async loadPlayerShipSkinState(authId) {
    const fallbackState = this.normalizePlayerShipSkinState({
      selectedSkinId: DEFAULT_PLAYER_SHIP_SKIN_ID,
      unlockedSkinIds: [DEFAULT_PLAYER_SHIP_SKIN_ID]
    });

    try {
      const { data, error } = await supabase
        .from('player_ship_skins')
        .select('selected_skin_id, unlocked_skin_ids')
        .eq('auth_id', authId)
        .maybeSingle();

      if (error) {
        // Table may be missing if migration is not yet applied on environment.
        ServerLoggerWrapper.warn('DATABASE', `[SHIP_SKINS] Failed to load state for ${authId}: ${error.message}`);
        return fallbackState;
      }

      if (!data) {
        return fallbackState;
      }

      let rawUnlockedSkinIds = [];
      if (Array.isArray(data.unlocked_skin_ids)) {
        rawUnlockedSkinIds = data.unlocked_skin_ids;
      } else if (typeof data.unlocked_skin_ids === 'string') {
        try {
          const parsed = JSON.parse(data.unlocked_skin_ids);
          if (Array.isArray(parsed)) rawUnlockedSkinIds = parsed;
        } catch {
          rawUnlockedSkinIds = [];
        }
      }

      return this.normalizePlayerShipSkinState({
        selectedSkinId: data.selected_skin_id,
        unlockedSkinIds: rawUnlockedSkinIds
      });
    } catch (error) {
      ServerLoggerWrapper.warn('DATABASE', `[SHIP_SKINS] Unexpected load error for ${authId}: ${error.message}`);
      return fallbackState;
    }
  }

  async savePlayerShipSkinState(authId, shipSkinState) {
    const normalizedState = this.normalizePlayerShipSkinState(shipSkinState);

    try {
      const { error } = await supabase
        .from('player_ship_skins')
        .upsert(
          {
            auth_id: authId,
            selected_skin_id: normalizedState.selectedSkinId,
            unlocked_skin_ids: normalizedState.unlockedSkinIds,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'auth_id'
          }
        );

      if (error) {
        // Non-blocking: keep core save path alive even if ship skin persistence is unavailable.
        ServerLoggerWrapper.warn('DATABASE', `[SHIP_SKINS] Failed to save state for ${authId}: ${error.message}`);
      }
    } catch (error) {
      ServerLoggerWrapper.warn('DATABASE', `[SHIP_SKINS] Unexpected save error for ${authId}: ${error.message}`);
    }
  }

  isMissingPlayerResourcesTableError(error) {
    if (!error) return false;
    if (String(error.code || '') === '42P01') return true;
    const message = String(error.message || '').toLowerCase();
    return message.includes('player_resources') && message.includes('does not exist');
  }

  markPlayerResourcesTableUnavailable(error, operation) {
    if (this.playerResourcesTableUnavailable) return;
    this.playerResourcesTableUnavailable = true;
    this.playerResourcesTableUnavailableMarkedAt = Date.now();
    ServerLoggerWrapper.warn(
      'DATABASE',
      `[PLAYER_RESOURCES] Table unavailable during ${operation}. Run latest migrations. ${error?.message || 'Unknown error'}`
    );
  }

  shouldSkipPlayerResourcesTableAccess() {
    if (!this.playerResourcesTableUnavailable) return false;

    const markedAt = Number(this.playerResourcesTableUnavailableMarkedAt || 0);
    const elapsed = Date.now() - markedAt;
    if (elapsed < this.playerResourcesTableRetryIntervalMs) {
      return true;
    }

    // Retry automatically after cooldown in case migrations were applied
    // while the server process stayed alive.
    this.playerResourcesTableUnavailable = false;
    this.playerResourcesTableUnavailableMarkedAt = 0;
    return false;
  }

  normalizeResourceInventory(resourceInventory) {
    if (!resourceInventory || typeof resourceInventory !== 'object') return {};

    const normalized = {};
    for (const [rawType, rawQuantity] of Object.entries(resourceInventory)) {
      const resourceType = typeof rawType === 'string' ? rawType.trim() : '';
      if (!resourceType) continue;

      const quantity = Number(rawQuantity);
      if (!Number.isFinite(quantity)) continue;

      const safeQuantity = Math.max(0, Math.floor(quantity));
      if (safeQuantity <= 0) continue;
      normalized[resourceType] = safeQuantity;
    }

    return normalized;
  }

  buildResourceInventorySignature(resourceInventory) {
    const normalizedInventory = this.normalizeResourceInventory(resourceInventory);
    const orderedEntries = Object.keys(normalizedInventory)
      .sort((a, b) => a.localeCompare(b))
      .map((resourceType) => [resourceType, normalizedInventory[resourceType]]);
    return JSON.stringify(orderedEntries);
  }

  buildQuestProgressSignature(quests) {
    if (!Array.isArray(quests)) return '[]';

    const normalizedQuests = quests
      .map((quest) => {
        const questId = String(quest?.quest_id || quest?.id || '').trim();
        if (!questId) return null;

        const objectives = Array.isArray(quest?.objectives)
          ? quest.objectives
            .map((objective) => {
              const objectiveId = String(objective?.id || '').trim();
              if (!objectiveId) return null;
              return {
                id: objectiveId,
                current: Math.max(0, Math.floor(Number(objective?.current || 0))),
                target: Math.max(0, Math.floor(Number(objective?.target || 0))),
                type: String(objective?.type || '').trim().toLowerCase()
              };
            })
            .filter((objective) => !!objective)
            .sort((a, b) => a.id.localeCompare(b.id))
          : [];

        return {
          quest_id: questId,
          is_completed: quest?.is_completed === true || quest?.isCompleted === true || quest?.completed === true,
          objectives
        };
      })
      .filter((quest) => !!quest)
      .sort((a, b) => a.quest_id.localeCompare(b.quest_id));

    return JSON.stringify(normalizedQuests);
  }

  buildInventoryItemsSignature(items) {
    if (!Array.isArray(items)) return '[]';

    const normalizedItems = items
      .map((item) => {
        const itemId = String(item?.id || '').trim();
        const instanceId = String(item?.instanceId || '').trim();
        if (!itemId || !instanceId) return null;

        const normalizedSlot = String(item?.slot || '').trim();
        const acquiredAtDate = new Date(item?.acquiredAt);
        const acquiredAt = Number.isFinite(acquiredAtDate.getTime())
          ? acquiredAtDate.toISOString()
          : null;

        return {
          item_id: itemId,
          instance_id: instanceId,
          slot: normalizedSlot || null,
          acquired_at: acquiredAt
        };
      })
      .filter((item) => !!item)
      .sort((a, b) => a.instance_id.localeCompare(b.instance_id));

    return JSON.stringify(normalizedItems);
  }

  async loadPlayerResourceInventory(authId) {
    if (this.shouldSkipPlayerResourcesTableAccess()) return {};

    try {
      const { data, error } = await supabase
        .from('player_resources')
        .select('resource_type, quantity')
        .eq('auth_id', authId);

      if (error) {
        if (this.isMissingPlayerResourcesTableError(error)) {
          this.markPlayerResourcesTableUnavailable(error, 'load');
          return {};
        }
        ServerLoggerWrapper.warn('DATABASE', `[PLAYER_RESOURCES] Failed to load inventory for ${authId}: ${error.message}`);
        return {};
      }

      const inventory = {};
      for (const row of data || []) {
        const resourceType = String(row?.resource_type || '').trim();
        if (!resourceType) continue;
        const quantity = Math.max(0, Math.floor(Number(row?.quantity || 0)));
        if (quantity <= 0) continue;
        inventory[resourceType] = quantity;
      }

      this.playerResourcesTableUnavailable = false;
      this.playerResourcesTableUnavailableMarkedAt = 0;
      return inventory;
    } catch (error) {
      if (this.isMissingPlayerResourcesTableError(error)) {
        this.markPlayerResourcesTableUnavailable(error, 'load');
        return {};
      }
      ServerLoggerWrapper.warn('DATABASE', `[PLAYER_RESOURCES] Unexpected load error for ${authId}: ${error.message}`);
      return {};
    }
  }

  async savePlayerResourceInventory(authId, resourceInventory) {
    const normalizedInventory = this.normalizeResourceInventory(resourceInventory);
    if (this.shouldSkipPlayerResourcesTableAccess()) return normalizedInventory;

    try {
      const resourceTypes = Object.keys(normalizedInventory);
      const { data: existingRows, error: loadError } = await supabase
        .from('player_resources')
        .select('resource_type')
        .eq('auth_id', authId);

      if (loadError) {
        if (this.isMissingPlayerResourcesTableError(loadError)) {
          this.markPlayerResourcesTableUnavailable(loadError, 'save');
          return normalizedInventory;
        }
        ServerLoggerWrapper.warn('DATABASE', `[PLAYER_RESOURCES] Failed to load existing rows for ${authId}: ${loadError.message}`);
        return normalizedInventory;
      }

      const existingTypes = (existingRows || [])
        .map((row) => String(row?.resource_type || '').trim())
        .filter((type) => type.length > 0);
      const staleTypes = existingTypes.filter((type) => !resourceTypes.includes(type));

      if (staleTypes.length > 0) {
        const { error: deleteError } = await supabase
          .from('player_resources')
          .delete()
          .eq('auth_id', authId)
          .in('resource_type', staleTypes);

        if (deleteError) {
          if (this.isMissingPlayerResourcesTableError(deleteError)) {
            this.markPlayerResourcesTableUnavailable(deleteError, 'save');
            return normalizedInventory;
          }
          ServerLoggerWrapper.warn('DATABASE', `[PLAYER_RESOURCES] Failed deleting stale rows for ${authId}: ${deleteError.message}`);
          return normalizedInventory;
        }
      }

      if (resourceTypes.length > 0) {
        const nowIso = new Date().toISOString();
        const upsertRows = resourceTypes.map((resourceType) => ({
          auth_id: authId,
          resource_type: resourceType,
          quantity: normalizedInventory[resourceType],
          updated_at: nowIso
        }));

        const { error: upsertError } = await supabase
          .from('player_resources')
          .upsert(upsertRows, { onConflict: 'auth_id,resource_type' });

        if (upsertError) {
          if (this.isMissingPlayerResourcesTableError(upsertError)) {
            this.markPlayerResourcesTableUnavailable(upsertError, 'save');
            return normalizedInventory;
          }
          ServerLoggerWrapper.warn('DATABASE', `[PLAYER_RESOURCES] Failed to upsert rows for ${authId}: ${upsertError.message}`);
          return normalizedInventory;
        }
      }
      this.playerResourcesTableUnavailable = false;
      this.playerResourcesTableUnavailableMarkedAt = 0;
    } catch (error) {
      if (this.isMissingPlayerResourcesTableError(error)) {
        this.markPlayerResourcesTableUnavailable(error, 'save');
        return normalizedInventory;
      }
      ServerLoggerWrapper.warn('DATABASE', `[PLAYER_RESOURCES] Unexpected save error for ${authId}: ${error.message}`);
      return normalizedInventory;
    }

    return normalizedInventory;
  }

  isMissingPlayerPetsTableError(error) {
    if (!error) return false;
    if (String(error.code || '') === '42P01') return true;
    const message = String(error.message || '').toLowerCase();
    return message.includes('player_pets') && message.includes('does not exist');
  }

  isMissingPlayerPetsModuleColumnsError(error) {
    if (!error) return false;
    if (String(error.code || '') !== '42703') return false;

    const message = String(error.message || '').toLowerCase();
    if (!message.includes('player_pets')) return false;

    return (
      message.includes('module_slot')
      || message.includes('inventory_capacity')
      || message.includes('inventory')
    );
  }

  markPlayerPetsTableUnavailable(error, operation) {
    if (this.playerPetsTableUnavailable) return;
    this.playerPetsTableUnavailable = true;
    this.playerPetsTableUnavailableMarkedAt = Date.now();
    ServerLoggerWrapper.warn(
      'DATABASE',
      `[PLAYER_PETS] Table unavailable during ${operation}. Run latest migrations. ${error?.message || 'Unknown error'}`
    );
  }

  shouldSkipPlayerPetsTableAccess() {
    if (!this.playerPetsTableUnavailable) return false;

    const markedAt = Number(this.playerPetsTableUnavailableMarkedAt || 0);
    const elapsed = Date.now() - markedAt;
    if (elapsed < this.playerPetsTableRetryIntervalMs) {
      return true;
    }

    this.playerPetsTableUnavailable = false;
    this.playerPetsTableUnavailableMarkedAt = 0;
    return false;
  }

  normalizePetState(petState) {
    return normalizePlayerPetState(petState, { preferredPetId: DEFAULT_PLAYER_PET_ID });
  }

  async loadPlayerPetState(authId) {
    const fallbackState = createDefaultPlayerPetState(DEFAULT_PLAYER_PET_ID);
    if (this.shouldSkipPlayerPetsTableAccess()) return fallbackState;

    try {
      let selectedWithModuleColumns = true;
      let { data, error } = await supabase
        .from('player_pets')
        .select('pet_id, pet_nickname, level, experience, current_health, max_health, current_shield, max_shield, is_active, module_slot, inventory, inventory_capacity, updated_at')
        .eq('auth_id', authId)
        .order('is_active', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(5);

      if (error && this.isMissingPlayerPetsModuleColumnsError(error)) {
        selectedWithModuleColumns = false;

        if (!this.playerPetsModuleColumnsUnavailableLogged) {
          ServerLoggerWrapper.warn(
            'DATABASE',
            `[PLAYER_PETS] module columns unavailable during load. Run latest migrations. ${error.message}`
          );
          this.playerPetsModuleColumnsUnavailableLogged = true;
        }

        const fallbackResult = await supabase
          .from('player_pets')
          .select('pet_id, pet_nickname, level, experience, current_health, max_health, current_shield, max_shield, is_active, updated_at')
          .eq('auth_id', authId)
          .order('is_active', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(5);
        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) {
        if (this.isMissingPlayerPetsTableError(error)) {
          this.markPlayerPetsTableUnavailable(error, 'load');
          return fallbackState;
        }
        ServerLoggerWrapper.warn('DATABASE', `[PLAYER_PETS] Failed to load pet state for ${authId}: ${error.message}`);
        return fallbackState;
      }

      const rows = Array.isArray(data) ? data : [];
      if (rows.length === 0) {
        this.playerPetsTableUnavailable = false;
        this.playerPetsTableUnavailableMarkedAt = 0;
        return fallbackState;
      }

      const activeRow = rows.find((row) => row && row.is_active === true) || rows[0];
      const normalizedState = this.normalizePetState({
        pet_id: activeRow?.pet_id,
        pet_nickname: activeRow?.pet_nickname,
        level: activeRow?.level,
        experience: activeRow?.experience,
        current_health: activeRow?.current_health,
        max_health: activeRow?.max_health,
        current_shield: activeRow?.current_shield,
        max_shield: activeRow?.max_shield,
        isActive: activeRow?.is_active,
        module_slot: selectedWithModuleColumns ? activeRow?.module_slot : undefined,
        pet_inventory: selectedWithModuleColumns ? activeRow?.inventory : undefined,
        inventory_capacity: selectedWithModuleColumns ? activeRow?.inventory_capacity : undefined
      });

      this.playerPetsTableUnavailable = false;
      this.playerPetsTableUnavailableMarkedAt = 0;
      return normalizedState;
    } catch (error) {
      if (this.isMissingPlayerPetsTableError(error)) {
        this.markPlayerPetsTableUnavailable(error, 'load');
        return fallbackState;
      }
      ServerLoggerWrapper.warn('DATABASE', `[PLAYER_PETS] Unexpected load error for ${authId}: ${error.message}`);
      return fallbackState;
    }
  }

  async savePlayerPetState(authId, petState) {
    const normalizedState = this.normalizePetState(petState);
    if (this.shouldSkipPlayerPetsTableAccess()) return normalizedState;

    const nowIso = new Date().toISOString();

    try {
      const { error: deactivateError } = await supabase
        .from('player_pets')
        .update({ is_active: false, updated_at: nowIso })
        .eq('auth_id', authId)
        .neq('pet_id', normalizedState.petId)
        .eq('is_active', true);

      if (deactivateError) {
        if (this.isMissingPlayerPetsTableError(deactivateError)) {
          this.markPlayerPetsTableUnavailable(deactivateError, 'save');
          return normalizedState;
        }
        ServerLoggerWrapper.warn('DATABASE', `[PLAYER_PETS] Failed to deactivate old pets for ${authId}: ${deactivateError.message}`);
        return normalizedState;
      }

      const upsertPayload = {
        auth_id: authId,
        pet_id: normalizedState.petId,
        pet_nickname: normalizedState.petNickname,
        level: normalizedState.level,
        experience: normalizedState.experience,
        current_health: normalizedState.currentHealth,
        max_health: normalizedState.maxHealth,
        current_shield: normalizedState.currentShield,
        max_shield: normalizedState.maxShield,
        module_slot: normalizedState.moduleSlot || null,
        inventory: Array.isArray(normalizedState.inventory) ? normalizedState.inventory : [],
        inventory_capacity: Math.max(4, Math.floor(Number(normalizedState.inventoryCapacity || 8))),
        is_active: true,
        updated_at: nowIso
      };

      let { error: upsertError } = await supabase
        .from('player_pets')
        .upsert(upsertPayload, { onConflict: 'auth_id,pet_id' });

      if (upsertError && this.isMissingPlayerPetsModuleColumnsError(upsertError)) {
        if (!this.playerPetsModuleColumnsUnavailableLogged) {
          ServerLoggerWrapper.warn(
            'DATABASE',
            `[PLAYER_PETS] module columns unavailable during save. Run latest migrations. ${upsertError.message}`
          );
          this.playerPetsModuleColumnsUnavailableLogged = true;
        }

        const legacyUpsertPayload = {
          auth_id: authId,
          pet_id: normalizedState.petId,
          pet_nickname: normalizedState.petNickname,
          level: normalizedState.level,
          experience: normalizedState.experience,
          current_health: normalizedState.currentHealth,
          max_health: normalizedState.maxHealth,
          current_shield: normalizedState.currentShield,
          max_shield: normalizedState.maxShield,
          is_active: true,
          updated_at: nowIso
        };

        const legacyResult = await supabase
          .from('player_pets')
          .upsert(legacyUpsertPayload, { onConflict: 'auth_id,pet_id' });
        upsertError = legacyResult.error;
      }

      if (upsertError) {
        if (this.isMissingPlayerPetsTableError(upsertError)) {
          this.markPlayerPetsTableUnavailable(upsertError, 'save');
          return normalizedState;
        }
        ServerLoggerWrapper.warn('DATABASE', `[PLAYER_PETS] Failed to upsert pet state for ${authId}: ${upsertError.message}`);
        return normalizedState;
      }

      this.playerPetsTableUnavailable = false;
      this.playerPetsTableUnavailableMarkedAt = 0;
      return normalizedState;
    } catch (error) {
      if (this.isMissingPlayerPetsTableError(error)) {
        this.markPlayerPetsTableUnavailable(error, 'save');
        return normalizedState;
      }
      ServerLoggerWrapper.warn('DATABASE', `[PLAYER_PETS] Unexpected save error for ${authId}: ${error.message}`);
      return normalizedState;
    }
  }

  isMissingPlayerAmmoTablesError(error) {
    if (!error) return false;
    if (String(error.code || '') === '42P01') return true;
    const message = String(error.message || '').toLowerCase();
    return (
      (message.includes('player_ammo_inventory')
        || message.includes('player_ammo_transactions')
        || message.includes('ammo_types'))
      && message.includes('does not exist')
    );
  }

  isMissingSelectedAmmoColumnError(error) {
    if (!error) return false;
    if (String(error.code || '') !== '42703') return false;
    const message = String(error.message || '').toLowerCase();
    return message.includes('selected_ammo_code');
  }

  isPermissionDeniedError(error) {
    if (!error) return false;
    if (String(error.code || '') === '42501') return true;
    const message = String(error.message || '').toLowerCase();
    return message.includes('permission denied');
  }

  markPlayerAmmoTablesUnavailable(error, operation) {
    if (this.playerAmmoTablesUnavailable) return;
    this.playerAmmoTablesUnavailable = true;
    this.playerAmmoTablesUnavailableMarkedAt = Date.now();
    ServerLoggerWrapper.warn(
      'DATABASE',
      `[PLAYER_AMMO] Tables unavailable during ${operation}. Run latest migrations. ${error?.message || 'Unknown error'}`
    );
  }

  shouldSkipPlayerAmmoTableAccess() {
    if (!this.playerAmmoTablesUnavailable) return false;

    const markedAt = Number(this.playerAmmoTablesUnavailableMarkedAt || 0);
    const elapsed = Date.now() - markedAt;
    if (elapsed < this.playerAmmoTablesRetryIntervalMs) {
      return true;
    }

    this.playerAmmoTablesUnavailable = false;
    this.playerAmmoTablesUnavailableMarkedAt = 0;
    return false;
  }

  buildAmmoInventorySignature(ammoInventory) {
    const normalizedAmmo = normalizeAmmoInventory(ammoInventory);
    return JSON.stringify({
      selectedTier: normalizedAmmo.selectedTier,
      tiers: {
        x1: Number(normalizedAmmo.tiers?.x1 || 0),
        x2: Number(normalizedAmmo.tiers?.x2 || 0),
        x3: Number(normalizedAmmo.tiers?.x3 || 0),
        m1: Number(normalizedAmmo.tiers?.m1 || 0),
        m2: Number(normalizedAmmo.tiers?.m2 || 0),
        m3: Number(normalizedAmmo.tiers?.m3 || 0)
      }
    });
  }

  async loadPlayerAmmoInventory(authId, fallbackAmmoInventory) {
    const normalizedFallbackInventory = normalizeAmmoInventory(fallbackAmmoInventory);
    if (this.shouldSkipPlayerAmmoTableAccess()) return normalizedFallbackInventory;

    try {
      let selectedAmmoCode = normalizedFallbackInventory.selectedTier;

      const { data: profileRow, error: profileError } = await supabase
        .from('user_profiles')
        .select('selected_ammo_code')
        .eq('auth_id', authId)
        .maybeSingle();

      if (profileError) {
        if (this.isMissingSelectedAmmoColumnError(profileError)) {
          if (!this.playerAmmoSelectedColumnUnavailableLogged) {
            ServerLoggerWrapper.warn(
              'DATABASE',
              `[PLAYER_AMMO] selected_ammo_code column unavailable during load. Run latest migrations. ${profileError.message}`
            );
            this.playerAmmoSelectedColumnUnavailableLogged = true;
          }
        } else if (this.isMissingPlayerAmmoTablesError(profileError)) {
          this.markPlayerAmmoTablesUnavailable(profileError, 'load_profile_selected_ammo');
          return normalizedFallbackInventory;
        } else {
          if (this.isPermissionDeniedError(profileError)) {
            ServerLoggerWrapper.warn(
              'DATABASE',
              `[PLAYER_AMMO] Permission denied reading selected ammo for ${authId}. Continuing with fallback tier "${selectedAmmoCode}". ${profileError.message}`
            );
          } else {
            ServerLoggerWrapper.warn(
              'DATABASE',
              `[PLAYER_AMMO] Failed to load selected ammo for ${authId}. Continuing with fallback tier "${selectedAmmoCode}". ${profileError.message}`
            );
          }
        }
      } else if (profileRow?.selected_ammo_code) {
        selectedAmmoCode = String(profileRow.selected_ammo_code || '').trim().toLowerCase();
      }

      const { data: ammoTypeRows, error: ammoTypeError } = await supabase
        .from('ammo_types')
        .select('id, code')
        .select('id, code')
        .in('code', ['x1', 'x2', 'x3', 'm1', 'm2', 'm3']);

      if (ammoTypeError) {
        if (this.isMissingPlayerAmmoTablesError(ammoTypeError)) {
          this.markPlayerAmmoTablesUnavailable(ammoTypeError, 'load_ammo_types');
          return normalizedFallbackInventory;
        }
        ServerLoggerWrapper.warn('DATABASE', `[PLAYER_AMMO] Failed to load ammo type catalog for ${authId}: ${ammoTypeError.message}`);
        return normalizedFallbackInventory;
      }

      const ammoTypeIdToCode = new Map();
      for (const row of ammoTypeRows || []) {
        const ammoTypeId = Number(row?.id);
        const ammoCode = String(row?.code || '').trim().toLowerCase();
        if (!Number.isFinite(ammoTypeId)) continue;
        if (ammoCode !== 'x1' && ammoCode !== 'x2' && ammoCode !== 'x3' && ammoCode !== 'm1' && ammoCode !== 'm2' && ammoCode !== 'm3') continue;
        ammoTypeIdToCode.set(Math.floor(ammoTypeId), ammoCode);
      }

      const { data: ammoRows, error: ammoRowsError } = await supabase
        .from('player_ammo_inventory')
        .select('ammo_type_id, quantity')
        .eq('auth_id', authId);

      if (ammoRowsError) {
        if (this.isMissingPlayerAmmoTablesError(ammoRowsError)) {
          this.markPlayerAmmoTablesUnavailable(ammoRowsError, 'load_inventory');
          return normalizedFallbackInventory;
        }
        ServerLoggerWrapper.warn('DATABASE', `[PLAYER_AMMO] Failed to load ammo inventory for ${authId}: ${ammoRowsError.message}`);
        return normalizedFallbackInventory;
      }

      const nextAmmoInventory = {
        selectedTier: selectedAmmoCode,
        tiers: {
          x1: Number(normalizedFallbackInventory.tiers?.x1 || 0),
          x2: Number(normalizedFallbackInventory.tiers?.x2 || 0),
          x3: Number(normalizedFallbackInventory.tiers?.x3 || 0),
          m1: Number(normalizedFallbackInventory.tiers?.m1 || 0),
          m2: Number(normalizedFallbackInventory.tiers?.m2 || 0),
          m3: Number(normalizedFallbackInventory.tiers?.m3 || 0)
        }
      };

      for (const row of ammoRows || []) {
        const ammoTypeId = Math.floor(Number(row?.ammo_type_id));
        if (!Number.isFinite(ammoTypeId)) continue;

        const ammoCode = ammoTypeIdToCode.get(ammoTypeId);
        if (!ammoCode) continue;

        const quantity = Math.max(0, Math.floor(Number(row?.quantity || 0)));
        nextAmmoInventory.tiers[ammoCode] = quantity;
      }

      const normalizedAmmoInventory = normalizeAmmoInventory(nextAmmoInventory);
      this.playerAmmoTablesUnavailable = false;
      this.playerAmmoTablesUnavailableMarkedAt = 0;
      return normalizedAmmoInventory;
    } catch (error) {
      if (this.isMissingPlayerAmmoTablesError(error)) {
        this.markPlayerAmmoTablesUnavailable(error, 'load');
        return normalizedFallbackInventory;
      }
      ServerLoggerWrapper.warn('DATABASE', `[PLAYER_AMMO] Unexpected load error for ${authId}: ${error.message}`);
      return normalizedFallbackInventory;
    }
  }

  async savePlayerAmmoInventory(authId, ammoInventory) {
    const normalizedAmmoInventory = normalizeAmmoInventory(ammoInventory);
    if (this.shouldSkipPlayerAmmoTableAccess()) return normalizedAmmoInventory;

    try {
      const nowIso = new Date().toISOString();
      const { data: ammoTypeRows, error: ammoTypeError } = await supabase
        .from('ammo_types')
        .select('id, code')
        .in('code', ['x1', 'x2', 'x3', 'm1', 'm2', 'm3']);

      if (ammoTypeError) {
        if (this.isMissingPlayerAmmoTablesError(ammoTypeError)) {
          this.markPlayerAmmoTablesUnavailable(ammoTypeError, 'save_ammo_types');
          return normalizedAmmoInventory;
        }
        ServerLoggerWrapper.warn('DATABASE', `[PLAYER_AMMO] Failed to load ammo types for save ${authId}: ${ammoTypeError.message}`);
        return normalizedAmmoInventory;
      }

      const ammoTypeIdByCode = {
        x1: null,
        x2: null,
        x3: null,
        m1: null,
        m2: null,
        m3: null
      };

      for (const row of ammoTypeRows || []) {
        const ammoCode = String(row?.code || '').trim().toLowerCase();
        const ammoTypeId = Number(row?.id);
        if (!Number.isFinite(ammoTypeId)) continue;
        if (ammoCode !== 'x1' && ammoCode !== 'x2' && ammoCode !== 'x3' && ammoCode !== 'm1' && ammoCode !== 'm2' && ammoCode !== 'm3') continue;
        ammoTypeIdByCode[ammoCode] = Math.floor(ammoTypeId);
      }

      const { data: existingRows, error: existingRowsError } = await supabase
        .from('player_ammo_inventory')
        .select('ammo_type_id, quantity')
        .eq('auth_id', authId);

      if (existingRowsError) {
        if (this.isMissingPlayerAmmoTablesError(existingRowsError)) {
          this.markPlayerAmmoTablesUnavailable(existingRowsError, 'save_load_existing');
          return normalizedAmmoInventory;
        }
        ServerLoggerWrapper.warn('DATABASE', `[PLAYER_AMMO] Failed to load existing ammo rows for ${authId}: ${existingRowsError.message}`);
        return normalizedAmmoInventory;
      }

      const previousQuantityByAmmoTypeId = new Map();
      for (const row of existingRows || []) {
        const ammoTypeId = Math.floor(Number(row?.ammo_type_id));
        if (!Number.isFinite(ammoTypeId)) continue;
        const quantity = Math.max(0, Math.floor(Number(row?.quantity || 0)));
        previousQuantityByAmmoTypeId.set(ammoTypeId, quantity);
      }

      const upsertRows = [];
      for (const ammoCode of ['x1', 'x2', 'x3', 'm1', 'm2', 'm3']) {
        const ammoTypeId = ammoTypeIdByCode[ammoCode];
        if (!Number.isFinite(ammoTypeId)) continue;
        upsertRows.push({
          auth_id: authId,
          ammo_type_id: ammoTypeId,
          quantity: Math.max(0, Math.floor(Number(normalizedAmmoInventory.tiers?.[ammoCode] || 0))),
          updated_at: nowIso
        });
      }

      if (upsertRows.length > 0) {
        const { error: upsertError } = await supabase
          .from('player_ammo_inventory')
          .upsert(upsertRows, { onConflict: 'auth_id,ammo_type_id' });

        if (upsertError) {
          if (this.isMissingPlayerAmmoTablesError(upsertError)) {
            this.markPlayerAmmoTablesUnavailable(upsertError, 'save_inventory');
            return normalizedAmmoInventory;
          }
          ServerLoggerWrapper.warn('DATABASE', `[PLAYER_AMMO] Failed to upsert ammo rows for ${authId}: ${upsertError.message}`);
          return normalizedAmmoInventory;
        }
      }

      const transactionRows = [];
      for (const upsertRow of upsertRows) {
        const ammoTypeId = Math.floor(Number(upsertRow.ammo_type_id));
        if (!Number.isFinite(ammoTypeId)) continue;
        const nextQuantity = Math.max(0, Math.floor(Number(upsertRow.quantity || 0)));
        const previousQuantity = Math.max(0, Math.floor(Number(previousQuantityByAmmoTypeId.get(ammoTypeId) || 0)));
        const delta = nextQuantity - previousQuantity;
        if (delta === 0) continue;

        transactionRows.push({
          auth_id: authId,
          ammo_type_id: ammoTypeId,
          delta,
          reason: 'state_sync',
          reference_id: null,
          metadata: { source: 'player_data_save' }
        });
      }

      if (transactionRows.length > 0) {
        const { error: transactionInsertError } = await supabase
          .from('player_ammo_transactions')
          .insert(transactionRows);

        if (transactionInsertError) {
          if (this.isMissingPlayerAmmoTablesError(transactionInsertError)) {
            this.markPlayerAmmoTablesUnavailable(transactionInsertError, 'save_transactions');
            return normalizedAmmoInventory;
          }
          ServerLoggerWrapper.warn('DATABASE', `[PLAYER_AMMO] Failed to insert ammo transactions for ${authId}: ${transactionInsertError.message}`);
          return normalizedAmmoInventory;
        }
      }

      const { error: selectedAmmoError } = await supabase
        .from('user_profiles')
        .update({
          selected_ammo_code: normalizedAmmoInventory.selectedTier,
          updated_at: nowIso
        })
        .eq('auth_id', authId);

      if (selectedAmmoError) {
        if (this.isMissingSelectedAmmoColumnError(selectedAmmoError)) {
          if (!this.playerAmmoSelectedColumnUnavailableLogged) {
            ServerLoggerWrapper.warn(
              'DATABASE',
              `[PLAYER_AMMO] selected_ammo_code column unavailable during save. Run latest migrations. ${selectedAmmoError.message}`
            );
            this.playerAmmoSelectedColumnUnavailableLogged = true;
          }
        } else if (this.isMissingPlayerAmmoTablesError(selectedAmmoError)) {
          this.markPlayerAmmoTablesUnavailable(selectedAmmoError, 'save_selected_ammo');
          return normalizedAmmoInventory;
        } else {
          ServerLoggerWrapper.warn('DATABASE', `[PLAYER_AMMO] Failed updating selected ammo for ${authId}: ${selectedAmmoError.message}`);
          return normalizedAmmoInventory;
        }
      }

      this.playerAmmoTablesUnavailable = false;
      this.playerAmmoTablesUnavailableMarkedAt = 0;
      return normalizedAmmoInventory;
    } catch (error) {
      if (this.isMissingPlayerAmmoTablesError(error)) {
        this.markPlayerAmmoTablesUnavailable(error, 'save');
        return normalizedAmmoInventory;
      }
      ServerLoggerWrapper.warn('DATABASE', `[PLAYER_AMMO] Unexpected save error for ${authId}: ${error.message}`);
      return normalizedAmmoInventory;
    }
  }

  /**
   * Carica i dati del giocatore dal database Supabase
   * @param {string} userId - auth_id del giocatore
   * @returns {Promise<Object>} Player data object
   */
  async loadPlayerData(userId) {
    try {
      ServerLoggerWrapper.database(`Loading player data for user: ${userId}`);
      const { data, error } = await supabase.rpc('get_player_complete_data_secure', { auth_id_param: userId });
      if (error) throw error;
      const raw = Array.isArray(data) && data.length > 0 ? data[0] : data;
      if (!raw?.found) throw new Error(`Profile not found for ${userId}`);

      const [recentHonor, skins, resources, pet] = await Promise.all([
        this.getRecentHonorAverage(userId, 30),
        this.loadPlayerShipSkinState(userId),
        this.loadPlayerResourceInventory(userId),
        this.loadPlayerPetState(userId)
      ]);

      this.lastSavedResourceInventorySignatureByAuthId.set(userId, this.buildResourceInventorySignature(resources));
      this.lastSavedPetStateSignatureByAuthId.set(userId, buildPetStateSignature(pet));

      const currencies = raw.currencies_data ? JSON.parse(raw.currencies_data) : {};
      const def = this.getDefaultPlayerData();
      const upgrades = raw.upgrades_data ? JSON.parse(raw.upgrades_data) : {};

      const playerData = {
        playerId: raw.player_id, userId, nickname: raw.username || 'Unknown',
        isAdministrator: !!raw.is_administrator,
        position: { x: raw.last_x ?? 200, y: raw.last_y ?? 200, rotation: raw.last_rotation ?? 0 },
        currentMapId: raw.last_map_id || 'palantir',
        inventory: {
          credits: Number(currencies.credits ?? def.inventory.credits),
          cosmos: Number(currencies.cosmos ?? def.inventory.cosmos),
          experience: Number(currencies.experience ?? def.inventory.experience),
          honor: Number(currencies.honor ?? def.inventory.honor),
          ammo: normalizeAmmoInventory(currencies?.ammo, currencies?.ammo),
          missileAmmo: normalizeMissileInventory(currencies?.missileAmmo || currencies?.missile_ammo || {
            selectedTier: currencies?.selectedMissileTier || currencies?.selected_missile_tier || 'm1'
          })
        },
        upgrades: {
          hpUpgrades: upgrades.hp_upgrades ?? upgrades.hpUpgrades ?? 0,
          shieldUpgrades: upgrades.shield_upgrades ?? upgrades.shieldUpgrades ?? 0,
          speedUpgrades: upgrades.speed_upgrades ?? upgrades.speedUpgrades ?? 0,
          damageUpgrades: upgrades.damage_upgrades ?? upgrades.damageUpgrades ?? 0,
          missileDamageUpgrades: upgrades.missile_damage_upgrades ?? upgrades.missileDamageUpgrades ?? 0
        },
        quests: (raw.quests_data ? JSON.parse(raw.quests_data) : []).map(q => ({
          ...q, id: q.quest_id || q.id, quest_id: q.quest_id || q.id,
          is_completed: !!(q.is_completed || q.isCompleted || q.completed), objectives: q.objectives || []
        })),
        recentHonor, rank: raw.current_rank_name || 'Basic Space Pilot',
        resourceInventory: resources, petState: pet,
        stats: (() => {
          try {
            const s = raw.stats_data ? JSON.parse(raw.stats_data) : null;
            return s ? { kills: Number(s.kills || 0), deaths: Number(s.deaths || 0), rankingPoints: Number(s.ranking_points || s.rankingPoints || 0) } : { kills: 0, deaths: 0, rankingPoints: 0 };
          } catch { return { kills: 0, deaths: 0, rankingPoints: 0 }; }
        })(),
        shipSkins: skins,
        health: currencies.current_health,
        shield: currencies.current_shield,
        items: (raw.items_data ? JSON.parse(raw.items_data) : []).map(i => ({
          id: i.item_id || i.id, instanceId: i.instance_id || i.instanceId,
          acquiredAt: i.acquired_at ? new Date(i.acquired_at).getTime() : (i.acquiredAt || Date.now()), slot: i.slot || null
        }))
      };

      const ammo = await this.loadPlayerAmmoInventory(userId, playerData.inventory.ammo);
      playerData.inventory.ammo = ammo;
      playerData.inventory.missileAmmo.tiers = { m1: ammo.tiers?.m1 || 0, m2: ammo.tiers?.m2 || 0, m3: ammo.tiers?.m3 || 0 };

      playerData.ammo = getLegacyAmmoValue(ammo);
      this.lastSavedAmmoInventorySignatureByAuthId.set(userId, this.buildAmmoInventorySignature(ammo));
      this.lastSavedQuestProgressSignatureByAuthId.set(userId, this.buildQuestProgressSignature(playerData.quests));
      this.lastSavedInventoryItemsSignatureByAuthId.set(userId, this.buildInventoryItemsSignature(playerData.items));

      if (playerData.inventory.honor > 0) this.saveHonorSnapshot(userId, playerData.inventory.honor, 'initial_load').catch(() => { });

      auditIdentityConsistency(playerData, 'load');
      return playerData;
    } catch (error) {
      ServerLoggerWrapper.database(`Error loading player data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Accoda il salvataggio per auth_id (single-flight + coalescing)
   * @param {Object} playerData - Dati del giocatore da salvare
   */
  async savePlayerData(playerData) {
    if (!playerData || !playerData.playerId) {
      ServerLoggerWrapper.database('Cannot save player data: invalid player data');
      return;
    }

    const authId = playerData.userId;
    if (!authId || typeof authId !== 'string') {
      ServerLoggerWrapper.warn('DATABASE', `Cannot queue player save: invalid auth_id (${String(authId)})`);
      return;
    }

    // Mentre un save è in corso per lo stesso auth_id, manteniamo solo l'ultima snapshot.
    this.savePendingPlayerDataByAuthId.set(authId, playerData);
    this.savePendingRequestByAuthId.add(authId);

    let inFlightSave = this.saveInFlightByAuthId.get(authId);
    if (!inFlightSave) {
      inFlightSave = this.processQueuedSavesForAuthId(authId);
      this.saveInFlightByAuthId.set(authId, inFlightSave);
    }

    return inFlightSave;
  }

  async processQueuedSavesForAuthId(authId) {
    try {
      while (this.savePendingRequestByAuthId.has(authId)) {
        this.savePendingRequestByAuthId.delete(authId);
        const queuedPlayerData = this.savePendingPlayerDataByAuthId.get(authId);
        if (!queuedPlayerData || !queuedPlayerData.playerId) continue;
        await this.savePlayerDataInternal(queuedPlayerData);
      }
    } finally {
      this.savePendingRequestByAuthId.delete(authId);
      this.savePendingPlayerDataByAuthId.delete(authId);
      this.saveInFlightByAuthId.delete(authId);
    }
  }

  /**
   * Salva i dati del giocatore nel database
   * @param {Object} playerData - Dati del giocatore da salvare
   */
  async savePlayerDataInternal(playerData) {
    try {
      if (!playerData || !playerData.playerId) return;

      const authId = playerData.userId;
      auditIdentityConsistency(playerData, 'save');

      playerData.resourceInventory = this.normalizeResourceInventory(playerData.resourceInventory || {});
      playerData.petState = this.normalizePetState(playerData.petState);

      if (!playerData.inventory) {
        ServerLoggerWrapper.database(`🚨 CRITICAL: Cannot save player data for ${authId} - inventory is null!`);
        return;
      }

      if (!playerData.stats) playerData.stats = { kills: 0, deaths: 0, rankingPoints: 0 };

      const statsData = {
        kills: playerData.stats.kills || 0,
        deaths: playerData.stats.deaths || 0,
        ranking_points: playerData.stats.rankingPoints || 0
      };

      const upgradesData = playerData.upgrades ? {
        hp_upgrades: playerData.upgrades.hpUpgrades || 0,
        shield_upgrades: playerData.upgrades.shieldUpgrades || 0,
        speed_upgrades: playerData.upgrades.speedUpgrades || 0,
        damage_upgrades: playerData.upgrades.damageUpgrades || 0,
        missile_damage_upgrades: playerData.upgrades.missileDamageUpgrades || 0
      } : null;

      const normalizedAmmoInventory = normalizeAmmoInventory(playerData.inventory?.ammo, playerData.ammo);

      if (playerData.inventory?.missileAmmo) {
        const normalizedMissileInventory = normalizeMissileInventory(playerData.inventory.missileAmmo);
        normalizedAmmoInventory.tiers.m1 = normalizedMissileInventory.tiers.m1;
        normalizedAmmoInventory.tiers.m2 = normalizedMissileInventory.tiers.m2;
        normalizedAmmoInventory.tiers.m3 = normalizedMissileInventory.tiers.m3;
      }

      const currenciesData = {
        credits: Number(playerData.inventory?.credits ?? 0),
        cosmos: Number(playerData.inventory?.cosmos ?? 0),
        experience: Number(playerData.inventory?.experience ?? 0),
        honor: Number(playerData.inventory?.honor ?? 0),
        current_health: Number(playerData.health ?? playerData.maxHealth ?? playerConfig.stats.health),
        current_shield: Number(playerData.shield ?? playerData.maxShield ?? playerConfig.stats.shield),
        ammo: normalizedAmmoInventory,
        missileAmmo: playerData.inventory?.missileAmmo || { selectedTier: 'm1', tiers: { m1: 0, m2: 0, m3: 0 } },
        selectedMissileTier: playerData.inventory?.missileAmmo?.selectedTier || 'm1'
      };

      const itemsData = playerData.items ? playerData.items.map(item => ({
        item_id: item.id,
        instance_id: item.instanceId,
        acquired_at: new Date(item.acquiredAt).toISOString(),
        slot: item.slot || null
      })) : null;

      const questsData = playerData.quests ? playerData.quests.map(quest => ({
        quest_id: quest.quest_id || quest.id,
        is_completed: !!(quest.is_completed || quest.isCompleted || quest.completed),
        objectives: quest.objectives || []
      })) : null;

      ServerLoggerWrapper.database(`Calling update_player_data_secure RPC for auth_id: ${authId}`);
      const { error: updateError } = await supabase.rpc('update_player_data_secure', {
        auth_id_param: authId,
        stats_data: statsData,
        upgrades_data: upgradesData,
        currencies_data: currenciesData,
        quests_data: questsData ? JSON.stringify(questsData) : null,
        items_data: itemsData ? JSON.stringify(itemsData) : null,
        profile_data: null,
        position_data: {
          x: playerData.position?.x || 200,
          y: playerData.position?.y || 200,
          rotation: playerData.position?.rotation || 0,
          map_id: playerData.currentMapId || 'palantir'
        }
      });

      if (updateError) throw updateError;

      ServerLoggerWrapper.database(`Player data saved successfully for ${authId}`);

      const nextAmmoSig = this.buildAmmoInventorySignature(playerData.inventory?.ammo);
      if (nextAmmoSig !== this.lastSavedAmmoInventorySignatureByAuthId.get(authId)) {
        playerData.inventory.ammo = await this.savePlayerAmmoInventory(authId, playerData.inventory?.ammo);
        playerData.ammo = getLegacyAmmoValue(playerData.inventory.ammo);
        this.lastSavedAmmoInventorySignatureByAuthId.set(authId, this.buildAmmoInventorySignature(playerData.inventory.ammo));
      }

      const nextResSig = this.buildResourceInventorySignature(playerData.resourceInventory);
      if (nextResSig !== this.lastSavedResourceInventorySignatureByAuthId.get(authId)) {
        playerData.resourceInventory = await this.savePlayerResourceInventory(authId, playerData.resourceInventory);
        this.lastSavedResourceInventorySignatureByAuthId.set(authId, this.buildResourceInventorySignature(playerData.resourceInventory));
      }

      const nextPetSig = buildPetStateSignature(playerData.petState);
      if (nextPetSig !== this.lastSavedPetStateSignatureByAuthId.get(authId)) {
        playerData.petState = await this.savePlayerPetState(authId, playerData.petState);
        this.lastSavedPetStateSignatureByAuthId.set(authId, buildPetStateSignature(playerData.petState));
      }

      await this.savePlayerShipSkinState(authId, playerData.shipSkins);

      const nextQuestSig = this.buildQuestProgressSignature(playerData.quests);
      if (nextQuestSig !== this.lastSavedQuestProgressSignatureByAuthId.get(authId)) {
        for (const quest of (playerData.quests || [])) {
          await supabase.from('quest_progress').upsert({
            auth_id: authId,
            quest_id: quest.quest_id || quest.id,
            objectives: quest.objectives || [],
            is_completed: quest.is_completed || false
          }, { onConflict: 'auth_id,quest_id' });
        }
        this.lastSavedQuestProgressSignatureByAuthId.set(authId, nextQuestSig);
      }

      const nextItemSig = this.buildInventoryItemsSignature(playerData.items);
      if (nextItemSig !== this.lastSavedInventoryItemsSignatureByAuthId.get(authId)) {
        const currentIds = (playerData.items || []).map(i => i.instanceId).filter(id => id);
        const { data: existing } = await supabase.from('player_inventory').select('instance_id').eq('auth_id', authId);
        const stale = (existing || []).map(r => r.instance_id).filter(id => !currentIds.includes(id));
        if (stale.length > 0) await supabase.from('player_inventory').delete().eq('auth_id', authId).in('instance_id', stale);

        for (const item of (playerData.items || [])) {
          await supabase.from('player_inventory').upsert({
            auth_id: authId, instance_id: item.instanceId, item_id: item.id,
            slot: item.slot || null, acquired_at: new Date(item.acquiredAt).toISOString()
          }, { onConflict: 'auth_id,instance_id' });
        }
        this.lastSavedInventoryItemsSignatureByAuthId.set(authId, nextItemSig);
      }
    } catch (error) {
      ServerLoggerWrapper.database(`Error saving player data: ${error.message}`);
      throw error;
    }
  }


  /**
   * Crea i record iniziali per un nuovo giocatore
   * @param {string} playerId - auth_id del giocatore
   */
  async createInitialPlayerRecords(playerId) {
    try {
      if (!UUID_PATTERN.test(playerId || '')) {
        ServerLoggerWrapper.warn('DATABASE', `[ID AUDIT]createInitialPlayerRecords: auth_id not UUID`, { authId: playerId });
      }

      // Stats iniziali
      await supabase.from('player_stats').insert({
        auth_id: playerId,
        kills: 0,
        deaths: 0,
        ranking_points: 0
      });

      // Upgrades iniziali
      await supabase.from('player_upgrades').insert({
        auth_id: playerId,
        hp_upgrades: 0,
        shield_upgrades: 0,
        speed_upgrades: 0,
        damage_upgrades: 0,
        missile_damage_upgrades: 0
      });

      // Currencies iniziali
      await supabase.from('player_currencies').insert({
        auth_id: playerId,
        credits: playerConfig.startingResources.credits,
        cosmos: playerConfig.startingResources.cosmos,
        experience: playerConfig.startingResources.experience,
        honor: playerConfig.startingResources.honor
      });

      const defaultAmmoInventory = this.getDefaultPlayerData().inventory?.ammo;
      await this.savePlayerAmmoInventory(playerId, defaultAmmoInventory);
      this.lastSavedAmmoInventorySignatureByAuthId.set(
        playerId,
        this.buildAmmoInventorySignature(defaultAmmoInventory)
      );

      ServerLoggerWrapper.database(`Initial player records created for ${playerId}`);
    } catch (error) {
      ServerLoggerWrapper.database(`Error creating initial player records: ${error.message} `);
      throw error;
    }
  }

  /**
   * Salva uno snapshot dell'honor per calcolare la media mobile
   * @param {string} authId - auth_id del giocatore
   * @param {number} honorValue - Valore honor corrente
   * @param {string} reason - Motivo dello snapshot (es. 'combat', 'quest', 'initial_load')
   */
  async saveHonorSnapshot(authId, honorValue, reason = 'change') {
    try {
      const { error } = await supabase.rpc('insert_honor_snapshot', {
        p_auth_id: authId,
        p_honor_value: honorValue,
        p_reason: reason
      });

      if (error) {
        ServerLoggerWrapper.database(`Error saving honor snapshot: ${error.message} `);
      }
    } catch (error) {
      ServerLoggerWrapper.database(`Error in saveHonorSnapshot: ${error.message} `);
    }
  }

  /**
   * Recupera la media mobile dell'honor degli ultimi N giorni
   * @param {string} authId - auth_id del giocatore
   * @param {number} days - Numero di giorni da considerare (default: 30)
   * @returns {Promise<number>} Media honor
   */
  async getRecentHonorAverage(authId, days = 30) {
    try {
      const { data, error } = await supabase.rpc('get_recent_honor_average', {
        p_auth_id: authId,
        p_days: days
      });

      if (error) {
        ServerLoggerWrapper.database(`Error getting recent honor average: ${error.message} `);
        return 0;
      }

      return Number(data || 0);
    } catch (error) {
      ServerLoggerWrapper.database(`Error in getRecentHonorAverage: ${error.message} `);
      return 0;
    }
  }

  /**
   * Restituisce i dati di default per un nuovo giocatore
   * @returns {Object} Default player data
   */
  getDefaultPlayerData() {
    return {
      playerId: 0,
      stats: {
        kills: 0,
        deaths: 0,
        rankingPoints: 0
      },
      upgrades: {
        hpUpgrades: 0,
        shieldUpgrades: 0,
        speedUpgrades: 0,
        damageUpgrades: 0,
        missileDamageUpgrades: 0
      },
      health: playerConfig.stats.health,
      shield: playerConfig.stats.shield,
      inventory: {
        credits: playerConfig.startingResources.credits || 10000,
        cosmos: playerConfig.startingResources.cosmos || 5000,
        experience: playerConfig.startingResources.experience || 0,
        honor: playerConfig.startingResources.honor || 0,
        ammo: normalizeAmmoInventory({
          selectedTier: 'x1',
          tiers: {
            x1: 0,
            x2: 0,
            x3: 0
          }
        })
      },
      shipSkins: {
        selectedSkinId: DEFAULT_PLAYER_SHIP_SKIN_ID,
        unlockedSkinIds: [DEFAULT_PLAYER_SHIP_SKIN_ID]
      },
      resourceInventory: {},
      petState: createDefaultPlayerPetState(DEFAULT_PLAYER_PET_ID),
      quests: []
    };
  }

  /**
   * Configura il salvataggio periodico dei dati dei player
   */
  setupPeriodicSave() {
    // Salva i dati di tutti i player ogni 5 minuti
    const SAVE_INTERVAL = 5 * 60 * 1000; // 5 minuti

    this.periodicSaveInterval = setInterval(async () => {
      try {
        ServerLoggerWrapper.database('Starting periodic save of all player data...');

        let players = [];
        if (this.mapServer.maps) {
          // Multi-map architecture (MapManager)
          for (const mapInstance of this.mapServer.maps.values()) {
            players.push(...Array.from(mapInstance.players.values()));
          }
        } else if (this.mapServer.players) {
          // Single-map architecture (MapServer)
          players = Array.from(this.mapServer.players.values());
        }

        let savedCount = 0;
        let errorCount = 0;

        for (const playerData of players) {
          try {
            await this.savePlayerData(playerData);
            savedCount++;
          } catch (error) {
            ServerLoggerWrapper.database(`Error saving player data for ${playerData.userId}: ${error.message} `);
            errorCount++;
          }
        }

        ServerLoggerWrapper.database(`Periodic save completed: ${savedCount} saved, ${errorCount} errors`);
      } catch (error) {
        ServerLoggerWrapper.database(`Error in periodic save: ${error.message} `);
      }
    }, SAVE_INTERVAL);

    ServerLoggerWrapper.debug('DATABASE', `Periodic save system initialized(every ${SAVE_INTERVAL / 1000 / 60} minutes)`);
  }

  /**
   * Ferma il salvataggio periodico
   */
  stopPeriodicSave() {
    if (this.periodicSaveInterval) {
      clearInterval(this.periodicSaveInterval);
      this.periodicSaveInterval = null;
      ServerLoggerWrapper.database('Periodic save system stopped');
    }
  }
}

module.exports = PlayerDataManager;
