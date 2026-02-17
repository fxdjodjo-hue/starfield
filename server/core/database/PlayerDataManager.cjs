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
    this.lastSavedPetStateSignatureByAuthId = new Map();
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

  /**
   * Carica i dati del giocatore dal database Supabase
   * @param {string} userId - auth_id del giocatore
   * @returns {Promise<Object>} Player data object
   */
  async loadPlayerData(userId) {
    try {
      ServerLoggerWrapper.database(`Loading player data for user: ${userId}`);

      // Carica TUTTO in una singola query ottimizzata
      ServerLoggerWrapper.database(`🔍 Loading complete player data for user ${userId}`);
      ServerLoggerWrapper.database(`Using Supabase URL: ${supabaseUrl}`);

      const { data: completeData, error: dataError } = await supabase.rpc(
        'get_player_complete_data_secure',
        { auth_id_param: userId }
      );

      if (dataError) {
        ServerLoggerWrapper.database(`❌ Complete data load error for user ${userId}: ${dataError.message}`);
        throw dataError;
      }

      ServerLoggerWrapper.debug('DATABASE', `Raw RPC response loaded for user ${userId}`);

      // PostgreSQL RPC restituisce sempre un array, prendiamo il primo elemento
      const playerDataRaw = Array.isArray(completeData) && completeData.length > 0 ? completeData[0] : completeData;

      ServerLoggerWrapper.debug('DATABASE', `Player data parsed for user ${userId}`, {
        found: playerDataRaw?.found,
        player_id: playerDataRaw?.player_id,
        username: playerDataRaw?.username,
        has_currencies: !!playerDataRaw?.currencies_data,
        has_upgrades: !!playerDataRaw?.upgrades_data
      });

      if (!playerDataRaw || !playerDataRaw.found) {
        // PROFILO NON TROVATO - BLOCCO TOTALE ACCESSO
        ServerLoggerWrapper.security(`🚫 BLOCKED: User ${userId} attempted to play without profile`);
        throw new Error(`ACCESS DENIED: You must register and create a profile before playing. Please register first.`);
      }

      // Verifica che player_id sia valido
      if (!playerDataRaw.player_id || playerDataRaw.player_id === 0) {
        ServerLoggerWrapper.database(`❌ CRITICAL: User ${userId} has invalid player_id: ${playerDataRaw.player_id}`);
        ServerLoggerWrapper.debug('DATABASE', `Invalid player_id details: user=${userId}, received_id=${playerDataRaw.player_id}`);
        throw new Error(`DATABASE ERROR: Invalid player_id for user ${userId}. Please contact support.`);
      }

      // Calcola RecentHonor (media mobile ultimi 30 giorni)
      const recentHonor = await this.getRecentHonorAverage(userId, 30);
      const shipSkinState = await this.loadPlayerShipSkinState(userId);
      const resourceInventory = await this.loadPlayerResourceInventory(userId);
      const petState = await this.loadPlayerPetState(userId);
      this.lastSavedResourceInventorySignatureByAuthId.set(
        userId,
        this.buildResourceInventorySignature(resourceInventory)
      );
      this.lastSavedPetStateSignatureByAuthId.set(
        userId,
        buildPetStateSignature(petState)
      );

      // Costruisci playerData con i dati reali del database
      const playerData = {
        playerId: playerDataRaw.player_id, // player_id NUMERICO per display/HUD
        userId: userId,     // auth_id per identificazione
        nickname: playerDataRaw.username || 'Unknown',
        isAdministrator: playerDataRaw.is_administrator || false, // Admin status
        position: {
          x: playerDataRaw.last_x !== null ? playerDataRaw.last_x : 200,
          y: playerDataRaw.last_y !== null ? playerDataRaw.last_y : 200,
          rotation: playerDataRaw.last_rotation !== null ? playerDataRaw.last_rotation : 0
        },
        currentMapId: playerDataRaw.last_map_id || 'palantir',
        inventory: (() => {
          const defaultInventory = this.getDefaultPlayerData().inventory;
          let currencies;
          let hadNullValues = false; // Traccia se il database aveva null

          if (playerDataRaw.currencies_data) {
            currencies = JSON.parse(playerDataRaw.currencies_data);

            // DATABASE IS SOURCE OF TRUTH: Traccia se il database aveva null
            // IMPORTANTE: Se un valore è null nel DB, significa che non è mai stato impostato
            // Ma se un valore è presente (anche 0), deve essere preservato
            // Se TUTTI i valori principali sono null, significa che il record esiste ma non è mai stato popolato
            const allMainValuesNull = currencies.credits === null &&
              currencies.cosmos === null &&
              currencies.experience === null &&
              currencies.honor === null;

            if (allMainValuesNull) {
              // Se TUTTI i valori sono null, significa che il record esiste ma non è mai stato popolato
              hadNullValues = true;
              // Usa default SOLO per valori null (mai impostati), NON per valori 0
              currencies.credits = defaultInventory.credits;
              currencies.cosmos = defaultInventory.cosmos;
              currencies.experience = defaultInventory.experience;
              currencies.honor = defaultInventory.honor;
            } else {
              // Se almeno un valore è presente, significa che il record è stato popolato (anche manualmente)
              // Preserva i valori reali, anche se alcuni sono null
              hadNullValues = false; // I valori sono stati impostati, anche se alcuni sono null
              // Sostituisci solo i null con default per far funzionare il gioco
              if (currencies.credits == null) currencies.credits = defaultInventory.credits;
              if (currencies.cosmos == null) currencies.cosmos = defaultInventory.cosmos;
              if (currencies.experience == null) currencies.experience = defaultInventory.experience;
              if (currencies.honor == null) currencies.honor = defaultInventory.honor;

              // Force Number type for all numeric values
              currencies.credits = Number(currencies.credits);
              currencies.cosmos = Number(currencies.cosmos);
              currencies.experience = Number(currencies.experience);
              currencies.honor = Number(currencies.honor);

              ServerLoggerWrapper.debug('DATABASE', `Currencies processed: honor=${currencies.honor}`);
            }

          } else {
            // Nessun record nel database, usa default (nuovo player)
            currencies = { ...defaultInventory };
          }

          return currencies;
        })(),
        upgrades: (() => {
          const defaultUpgrades = this.getDefaultPlayerData().upgrades;
          if (playerDataRaw.upgrades_data) {
            const upgrades = JSON.parse(playerDataRaw.upgrades_data);
            // DATABASE IS SOURCE OF TRUTH: Carica i valori esatti dal database
            // Mappa sia snake_case (dal DB) che camelCase (per compatibilità/nuovi record)
            return {
              hpUpgrades: upgrades.hpUpgrades ?? upgrades.hp_upgrades ?? defaultUpgrades.hpUpgrades,
              shieldUpgrades: upgrades.shieldUpgrades ?? upgrades.shield_upgrades ?? defaultUpgrades.shieldUpgrades,
              speedUpgrades: upgrades.speedUpgrades ?? upgrades.speed_upgrades ?? defaultUpgrades.speedUpgrades,
              damageUpgrades: upgrades.damageUpgrades ?? upgrades.damage_upgrades ?? defaultUpgrades.damageUpgrades,
              missileDamageUpgrades: upgrades.missileDamageUpgrades ?? upgrades.missile_damage_upgrades ?? defaultUpgrades.missileDamageUpgrades
            };
          }
          // Nessun record nel database, usa default (nuovo player)
          return { ...defaultUpgrades };
        })(),
        quests: (() => {
          // Primary source: The RPC return value (likely from quest_progress table)
          let rawLoadedQuests = playerDataRaw.quests_data ? JSON.parse(playerDataRaw.quests_data) : [];

          // BACKUP RECOVERY STRATEGY:
          if ((!rawLoadedQuests || rawLoadedQuests.length === 0) && playerDataRaw.upgrades_data) {
            try {
              const upgrades = JSON.parse(playerDataRaw.upgrades_data);
              if (upgrades._quests_backup) {
                ServerLoggerWrapper.database(`RECOVERY: Found quest data in upgrades backup for ${userId}`);
                const questsMap = upgrades._quests_backup;
                rawLoadedQuests = Object.values(questsMap);
              }
            } catch (e) {
              ServerLoggerWrapper.warn('DATABASE', 'Failed to parse upgrades for quest recovery');
            }
          }

          // Standardize
          // Standardizziamo i nomi delle proprietà e assicuriamoci che l'ID sia presente.
          // Non filtriamo in base al progresso qui, perché una quest appena accettata (0 progresso) deve essere caricata.
          // La rimozione definitiva avviene tramite DELETE o non includendo la missione qui.
          const processedQuests = rawLoadedQuests.map(q => {
            const id = q.quest_id || q.id;
            const isCompleted = q.is_completed === true || q.isCompleted === true || q.completed === true;
            return {
              ...q,
              id: id,
              quest_id: id,
              is_completed: isCompleted,
              isCompleted: isCompleted,
              objectives: q.objectives || []
            };
          });

          return processedQuests;
        })(),
        recentHonor: recentHonor, // Media mobile honor ultimi 30 giorni
        health: (() => {
          if (playerDataRaw.currencies_data) {
            const currencies = JSON.parse(playerDataRaw.currencies_data);
            const loadedHealth = currencies.current_health;
            ServerLoggerWrapper.debug('DATABASE', `Loaded health from DB: ${loadedHealth}`);
            return loadedHealth; // Dopo migrazione, questo sarà sempre un numero valido
          }
          return null;
        })(),
        shield: (() => {
          if (playerDataRaw.currencies_data) {
            const currencies = JSON.parse(playerDataRaw.currencies_data);
            const loadedShield = currencies.current_shield;
            ServerLoggerWrapper.debug('DATABASE', `Loaded shield from DB: ${loadedShield}`);
            return loadedShield; // Dopo migrazione, questo sarà sempre un numero valido
          }
          return null;
        })(),
        rank: playerDataRaw.current_rank_name || 'Basic Space Pilot',
        resourceInventory: resourceInventory,
        petState: petState,
        stats: (() => {
          try {
            const stats = playerDataRaw.stats_data ? JSON.parse(playerDataRaw.stats_data) : null;
            if (stats) {
              return {
                kills: Number(stats.kills || 0),
                deaths: Number(stats.deaths || 0),
                rankingPoints: Number(stats.ranking_points || stats.rankingPoints || 0)
              };
            }
          } catch (e) {
            ServerLoggerWrapper.error('DATABASE', `Error parsing stats_data for user ${userId}: ${e.message}`);
          }
          return { kills: 0, deaths: 0, rankingPoints: 0 };
        })(),
        shipSkins: shipSkinState,
        items: (() => {
          try {
            const rawItems = playerDataRaw.items_data ? JSON.parse(playerDataRaw.items_data) : [];
            return rawItems.map(item => ({
              id: item.item_id || item.id,
              instanceId: item.instance_id || item.instanceId,
              acquiredAt: typeof item.acquiredAt === 'string' ? new Date(item.acquiredAt).getTime() :
                (typeof item.acquired_at === 'string' ? new Date(item.acquired_at).getTime() :
                  (item.acquired_at || item.acquiredAt)),
              slot: item.slot || null
            }));
          } catch (e) {
            ServerLoggerWrapper.error('DATABASE', `Error parsing items_data for user ${userId}: ${e.message}`);
            return [];
          }
        })()
      };

      // Crea snapshot iniziale dell'honor corrente (non bloccante)
      // Questo assicura che i player esistenti abbiano uno snapshot per il calcolo della media mobile
      const currentHonor = Number(playerData.inventory.honor || 0);
      if (currentHonor > 0) {
        // Chiama in modo asincrono senza bloccare il login
        this.saveHonorSnapshot(userId, currentHonor, 'initial_load').catch(err => {
          // Ignora errori, non blocca il flusso
        });
      }

      ServerLoggerWrapper.database(`Complete player data loaded successfully for user ${userId} (player_id: ${playerData.playerId})`);
      const { honor, cosmos, credits, experience, current_health, current_shield } = playerData.inventory;
      ServerLoggerWrapper.database(`Loaded currencies`, { honor, cosmos, credits, experience, current_health, current_shield });
      ServerLoggerWrapper.debug('DATABASE', `RecentHonor (30 days): ${recentHonor}`);
      auditIdentityConsistency(playerData, 'load');
      return playerData;

    } catch (error) {
      ServerLoggerWrapper.database(`Error loading player data: ${error.message}`);
      ServerLoggerWrapper.database(`Error details`, error);

      // Per un MMO, qualsiasi errore nel caricamento dei dati del player è critico
      // Non permettere connessioni senza dati validi dal database
      // Rilancia sempre l'errore per bloccare la connessione
      throw error;
    }
  }

  /**
   * Salva i dati del giocatore nel database
   * @param {Object} playerData - Dati del giocatore da salvare
   */
  async savePlayerData(playerData) {
    try {
      if (!playerData || !playerData.playerId) {
        ServerLoggerWrapper.database('Cannot save player data: invalid player data');
        return;
      }

      // authId = auth_id UUID (chiave persistente). playerId = player_id numerico (solo display/HUD).
      const authId = playerData.userId;
      auditIdentityConsistency(playerData, 'save');

      if (!playerData.resourceInventory || typeof playerData.resourceInventory !== 'object') {
        playerData.resourceInventory = {};
      }
      playerData.resourceInventory = this.normalizeResourceInventory(playerData.resourceInventory);
      playerData.petState = this.normalizePetState(playerData.petState);

      // 🔴 CRITICAL: Verifica che inventory esista prima di salvare
      // Se inventory è null/undefined, NON salvare per evitare di sovrascrivere i valori esistenti nel database
      if (!playerData.inventory) {
        ServerLoggerWrapper.database(`🚨 CRITICAL: Cannot save player data for ${authId} - inventory is null/undefined!`);
        ServerLoggerWrapper.database(`Player data state`, {
          playerId: playerData.playerId,
          userId: playerData.userId,
          nickname: playerData.nickname,
          hasInventory: !!playerData.inventory,
          hasUpgrades: !!playerData.upgrades,
          hasStats: !!playerData.stats
        });
        // NON salvare - preserva i valori esistenti nel database
        // Questo previene la sovrascrittura con null
        return;
      }

      // Assicurati che stats sia sempre presente come oggetto valido
      if (!playerData.stats) {
        playerData.stats = { kills: 0, deaths: 0, ranking_points: 0 };
      }

      ServerLoggerWrapper.database(`Saving player data for auth_id: ${authId}`);

      // Prepare data for secure RPC function
      const statsData = playerData.stats ? {
        kills: playerData.stats.kills || 0,
        deaths: playerData.stats.deaths || 0,
        ranking_points: playerData.stats.rankingPoints || 0
      } : {
        kills: 0,
        deaths: 0,
        ranking_points: 0
      };

      const upgradesData = playerData.upgrades ? {
        hp_upgrades: playerData.upgrades.hpUpgrades || 0,
        shield_upgrades: playerData.upgrades.shieldUpgrades || 0,
        speed_upgrades: playerData.upgrades.speedUpgrades || 0,
        damage_upgrades: playerData.upgrades.damageUpgrades || 0,
        missile_damage_upgrades: playerData.upgrades.missileDamageUpgrades || 0
      } : null;

      // DATABASE IS SOURCE OF TRUTH: Salva i valori esatti accumulati durante il gameplay
      // playerData.inventory contiene i valori accumulati dal player (NPC kills, quest, etc.)
      const currenciesData = {
        credits: Number(playerData.inventory.credits ?? 0),
        cosmos: Number(playerData.inventory.cosmos ?? 0),
        experience: Number(playerData.inventory.experience ?? 0),
        honor: Number(playerData.inventory.honor ?? 0),
        // 🟢 MMO-CORRECT: Salva SEMPRE HP/shield correnti (persistenza vera)
        // NULL ora significa "errore DB", mai "ottimizzazione"
        // Questo garantisce che ogni logout/login mantenga lo stato esatto
        current_health: (() => {
          // 🛡️ FIX: Assicura valori validi - mai null per rispettare vincolo DB
          const health = playerData.health !== null && playerData.health !== undefined ? playerData.health : playerData.maxHealth || playerConfig.stats.health;
          return Number(health) || playerConfig.stats.health; // Fallback sicuro
        })(),
        current_shield: (() => {
          // 🛡️ FIX: Assicura valori validi - mai null per rispettare vincolo DB
          const shield = playerData.shield !== null && playerData.shield !== undefined ? playerData.shield : playerData.maxShield || playerConfig.stats.shield;
          return Number(shield) || playerConfig.stats.shield; // Fallback sicuro
        })()
      };

      // 🔴 FIX: Salva SEMPRE i currencies quando vengono modificati durante il gameplay
      // Il server è la fonte di verità - se i valori sono stati modificati in memoria (NPC kills, etc.),
      // devono essere salvati nel database, indipendentemente dallo stato iniziale del DB


      // Prepare profile data (e.g., is_administrator)
      // 🔒 SECURITY: NON salvare is_administrator dal client - è gestito solo dal database
      // Il flag admin può essere modificato solo direttamente nel database, non tramite gameplay
      const profileData = null;

      const itemsData = playerData.items ? playerData.items.map(item => ({
        item_id: item.id,
        instance_id: item.instanceId,
        acquired_at: new Date(item.acquiredAt).toISOString(),
        slot: item.slot || null
      })) : null;

      const questsData = playerData.quests ? playerData.quests.map(quest => ({
        quest_id: quest.quest_id || quest.id,
        is_completed: quest.is_completed || quest.isCompleted || quest.completed || false,
        objectives: quest.objectives || []
      })) : null;

      // Use secure RPC function instead of direct table access
      ServerLoggerWrapper.database(`Calling update_player_data_secure RPC for auth_id: ${authId}`);
      ServerLoggerWrapper.info('DATABASE', `Player ${authId} saved: credits=${currenciesData.credits}, hp=${currenciesData.current_health}, shield=${currenciesData.current_shield}, honor=${currenciesData.honor}, exp=${currenciesData.experience}`);
      const { data: updateResult, error: updateError } = await supabase.rpc(
        'update_player_data_secure',
        {
          auth_id_param: authId,
          stats_data: statsData,
          upgrades_data: upgradesData,
          currencies_data: currenciesData,
          quests_data: questsData ? JSON.stringify(questsData) : null,
          items_data: itemsData ? JSON.stringify(itemsData) : null,
          profile_data: profileData,
          position_data: {
            x: playerData.position?.x || 200,
            y: playerData.position?.y || 200,
            rotation: playerData.position?.rotation || 0,
            map_id: playerData.currentMapId || 'palantir'
          }
        }
      );

      if (updateError) {
        ServerLoggerWrapper.database(`Error updating player data: ${updateError.message}`);
        throw updateError;
      }

      ServerLoggerWrapper.database(`Player data saved successfully for ${authId}`);

      // Persist world resource inventory only when it changes.
      const nextResourceInventorySignature = this.buildResourceInventorySignature(playerData.resourceInventory);
      const lastSavedResourceInventorySignature = this.lastSavedResourceInventorySignatureByAuthId.get(authId) || null;
      if (nextResourceInventorySignature !== lastSavedResourceInventorySignature) {
        playerData.resourceInventory = await this.savePlayerResourceInventory(authId, playerData.resourceInventory);
        this.lastSavedResourceInventorySignatureByAuthId.set(
          authId,
          this.buildResourceInventorySignature(playerData.resourceInventory)
        );
      }

      const nextPetStateSignature = buildPetStateSignature(playerData.petState);
      const lastSavedPetStateSignature = this.lastSavedPetStateSignatureByAuthId.get(authId) || null;
      if (nextPetStateSignature !== lastSavedPetStateSignature) {
        playerData.petState = await this.savePlayerPetState(authId, playerData.petState);
        this.lastSavedPetStateSignatureByAuthId.set(authId, buildPetStateSignature(playerData.petState));
      }

      // Persist ship skin ownership/equip state (non-blocking helper handles its own errors).
      await this.savePlayerShipSkinState(authId, playerData.shipSkins);

      // Salva quest progress separatamente se presente
      if (playerData.quests && Array.isArray(playerData.quests)) {
        ServerLoggerWrapper.database(`Saving quest progress for auth_id: ${authId}`);
        for (const quest of playerData.quests) {
          const questResult = await supabase.from('quest_progress').upsert({
            auth_id: authId,
            quest_id: quest.quest_id || quest.id,
            objectives: quest.objectives || [],
            is_completed: quest.is_completed || quest.completed || false
          }, {
            onConflict: 'auth_id,quest_id'
          });

          if (questResult.error) {
            ServerLoggerWrapper.database(`Error saving quest progress: ${questResult.error.message}`);
          }
        }
      }

      // Salva inventory items separatamente
      if (playerData.items && Array.isArray(playerData.items)) {
        ServerLoggerWrapper.database(`Saving inventory items for auth_id: ${authId} (${playerData.items.length} items)`);

        // 1. Rimuovi items non più presenti (per gestire vendite/eliminazioni se implementate)
        // Per ora facciamo solo upsert di quelli esistenti

        // Sincronizza eliminazioni: rimuove dal DB gli item non più presenti lato server.
        const currentInstanceIds = Array.from(new Set(
          playerData.items
            .map(item => item && item.instanceId)
            .filter(instanceId => typeof instanceId === 'string' && instanceId.length > 0)
        ));

        const { data: existingInventoryRows, error: existingInventoryError } = await supabase
          .from('player_inventory')
          .select('instance_id')
          .eq('auth_id', authId);

        if (existingInventoryError) {
          ServerLoggerWrapper.database(`Error loading existing inventory rows for ${authId}: ${existingInventoryError.message}`);
          throw existingInventoryError;
        }

        const staleInstanceIds = (existingInventoryRows || [])
          .map(row => row.instance_id)
          .filter(instanceId => !currentInstanceIds.includes(instanceId));

        if (staleInstanceIds.length > 0) {
          const { error: deleteStaleError } = await supabase
            .from('player_inventory')
            .delete()
            .eq('auth_id', authId)
            .in('instance_id', staleInstanceIds);

          if (deleteStaleError) {
            ServerLoggerWrapper.database(`Error deleting stale inventory rows for ${authId}: ${deleteStaleError.message}`);
            throw deleteStaleError;
          }

          ServerLoggerWrapper.database(`Deleted ${staleInstanceIds.length} stale inventory rows for auth_id: ${authId}`);
        }

        for (const item of playerData.items) {
          if (item.slot) {
            ServerLoggerWrapper.database(`Saving item ${item.id} (${item.instanceId}) in slot ${item.slot}`);
          }
          const itemResult = await supabase.from('player_inventory').upsert({
            auth_id: authId,
            instance_id: item.instanceId,
            item_id: item.id,
            slot: item.slot || null,
            acquired_at: new Date(item.acquiredAt).toISOString()
          }, {
            onConflict: 'auth_id,instance_id'
          });

          if (itemResult.error) {
            ServerLoggerWrapper.database(`Error saving inventory item ${item.instanceId}: ${itemResult.error.message}`);
          }
        }
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
        ServerLoggerWrapper.warn('DATABASE', `[ID AUDIT] createInitialPlayerRecords: auth_id not UUID`, { authId: playerId });
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

      ServerLoggerWrapper.database(`Initial player records created for ${playerId}`);
    } catch (error) {
      ServerLoggerWrapper.database(`Error creating initial player records: ${error.message}`);
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
        ServerLoggerWrapper.database(`Error saving honor snapshot: ${error.message}`);
      }
    } catch (error) {
      ServerLoggerWrapper.database(`Error in saveHonorSnapshot: ${error.message}`);
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
        ServerLoggerWrapper.database(`Error getting recent honor average: ${error.message}`);
        return 0;
      }

      return Number(data || 0);
    } catch (error) {
      ServerLoggerWrapper.database(`Error in getRecentHonorAverage: ${error.message}`);
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
      inventory: {
        credits: playerConfig.startingResources.credits || 10000,
        cosmos: playerConfig.startingResources.cosmos || 5000,
        experience: playerConfig.startingResources.experience || 0,
        honor: playerConfig.startingResources.honor || 0
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
            ServerLoggerWrapper.database(`Error saving player data for ${playerData.userId}: ${error.message}`);
            errorCount++;
          }
        }

        ServerLoggerWrapper.database(`Periodic save completed: ${savedCount} saved, ${errorCount} errors`);
      } catch (error) {
        ServerLoggerWrapper.database(`Error in periodic save: ${error.message}`);
      }
    }, SAVE_INTERVAL);

    ServerLoggerWrapper.debug('DATABASE', `Periodic save system initialized (every ${SAVE_INTERVAL / 1000 / 60} minutes)`);
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
