// PlayerDataManager - Gestione operazioni database per player data
// Responsabilità: Load, save, honor snapshots, periodic save
// Dipendenze: logger.cjs, supabase client

const { logger } = require('../../logger.cjs');
const { createClient } = require('@supabase/supabase-js');

// Supabase client - usa le stesse variabili d'ambiente di server.cjs
// IMPORTANTE: Assicurati che dotenv.config() sia chiamato PRIMA di richiedere questo modulo
const supabaseUrl = process.env.SUPABASE_URL || 'https://euvlanwkqzhqnbwbvwis.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

// Log per debug (solo se non in produzione)
if (process.env.NODE_ENV !== 'production') {
  logger.info('DATABASE', `Supabase client initialized - URL: ${supabaseUrl.substring(0, 30)}..., Key length: ${supabaseServiceKey.length}`);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
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
  }

  /**
   * Restituisce il client Supabase per uso esterno
   * @returns {Object} Supabase client instance
   */
  getSupabaseClient() {
    return supabase;
  }

  /**
   * Carica i dati del giocatore dal database Supabase
   * @param {string} userId - auth_id del giocatore
   * @returns {Promise<Object>} Player data object
   */
  async loadPlayerData(userId) {
    try {
      logger.info('DATABASE', `Loading player data for user: ${userId}`);

      // Carica TUTTO in una singola query ottimizzata
      logger.info('DATABASE', `🔍 Loading complete player data for user ${userId}`);
      logger.info('DATABASE', `Using Supabase URL: ${supabaseUrl}`);
      
      const { data: completeData, error: dataError } = await supabase.rpc(
        'get_player_complete_data_secure',
        { auth_id_param: userId }
      );

      if (dataError) {
        logger.error('DATABASE', `❌ Complete data load error for user ${userId}:`, dataError);
        throw dataError;
      }

      logger.info('DATABASE', `📦 Raw RPC response for user ${userId}:`, JSON.stringify(completeData, null, 2));

      // PostgreSQL RPC restituisce sempre un array, prendiamo il primo elemento
      const playerDataRaw = Array.isArray(completeData) && completeData.length > 0 ? completeData[0] : completeData;
      
      logger.info('DATABASE', `📋 Parsed playerDataRaw for user ${userId}:`, {
        found: playerDataRaw?.found,
        player_id: playerDataRaw?.player_id,
        username: playerDataRaw?.username,
        has_currencies: !!playerDataRaw?.currencies_data,
        has_upgrades: !!playerDataRaw?.upgrades_data
      });

      if (!playerDataRaw || !playerDataRaw.found) {
        // PROFILO NON TROVATO - BLOCCO TOTALE ACCESSO
        logger.error('SECURITY', `🚫 BLOCKED: User ${userId} attempted to play without profile`);
        throw new Error(`ACCESS DENIED: You must register and create a profile before playing. Please register first.`);
      }

      // Verifica che player_id sia valido
      if (!playerDataRaw.player_id || playerDataRaw.player_id === 0) {
        logger.error('DATABASE', `❌ CRITICAL: User ${userId} has invalid player_id: ${playerDataRaw.player_id}`);
        logger.error('DATABASE', `Raw data:`, JSON.stringify(playerDataRaw, null, 2));
        throw new Error(`DATABASE ERROR: Invalid player_id for user ${userId}. Please contact support.`);
      }

      // Calcola RecentHonor (media mobile ultimi 30 giorni)
      const recentHonor = await this.getRecentHonorAverage(userId, 30);

      // Costruisci playerData con i dati reali del database
      const playerData = {
        playerId: playerDataRaw.player_id, // player_id NUMERICO per display/HUD
        userId: userId,     // auth_id per identificazione
        nickname: playerDataRaw.username || 'Unknown',
        isAdministrator: playerDataRaw.is_administrator || false, // Admin status
        position: { x: 0, y: 0, rotation: 0 }, // Posizione verrà impostata dal client
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
              if (currencies.credits === null) currencies.credits = defaultInventory.credits;
              if (currencies.cosmos === null) currencies.cosmos = defaultInventory.cosmos;
              if (currencies.experience === null) currencies.experience = defaultInventory.experience;
              if (currencies.honor === null) currencies.honor = defaultInventory.honor;
            }
            
            // Assicurati che skillPoints sia sempre definito
            currencies.skillPoints = Number(currencies.skillPoints || currencies.skill_points_current || 0);
            currencies.skillPointsTotal = Number(currencies.skill_points_total || currencies.skillPointsTotal || currencies.skillPoints || 0);
            
            // Traccia se il database aveva null (per evitare di sovrascrivere con default)
            // IMPORTANTE: Se i valori sono stati aggiunti manualmente nel DB, hadNullValues sarà false
            currencies._hadNullInDb = hadNullValues;
          } else {
            // Nessun record nel database, usa default (nuovo player)
            currencies = { ...defaultInventory };
            currencies._hadNullInDb = false; // Nuovo player, non aveva null
          }
          
          return currencies;
        })(),
        upgrades: (() => {
          const defaultUpgrades = this.getDefaultPlayerData().upgrades;
          if (playerDataRaw.upgrades_data) {
            const upgrades = JSON.parse(playerDataRaw.upgrades_data);
            // DATABASE IS SOURCE OF TRUTH: Carica i valori esatti dal database
            // Se sono null, usa default per far funzionare il gioco
            if (upgrades.hpUpgrades === null) upgrades.hpUpgrades = defaultUpgrades.hpUpgrades;
            if (upgrades.shieldUpgrades === null) upgrades.shieldUpgrades = defaultUpgrades.shieldUpgrades;
            if (upgrades.speedUpgrades === null) upgrades.speedUpgrades = defaultUpgrades.speedUpgrades;
            if (upgrades.damageUpgrades === null) upgrades.damageUpgrades = defaultUpgrades.damageUpgrades;
            return upgrades;
          }
          // Nessun record nel database, usa default (nuovo player)
          return { ...defaultUpgrades };
        })(),
        quests: playerDataRaw.quests_data ? JSON.parse(playerDataRaw.quests_data) : [],
        recentHonor: recentHonor, // Media mobile honor ultimi 30 giorni
        // 🟢 MMO-CORRECT: Carica HP/shield salvati (dopo migrazione NULL = errore DB)
        currentHealth: (() => {
          if (playerDataRaw.currencies_data) {
            const currencies = JSON.parse(playerDataRaw.currencies_data);
            const loadedHealth = currencies.current_health;
            logger.info('DATABASE', `💚 LOAD Health from DB: ${loadedHealth} (NULL = DB error after migration)`);
            return loadedHealth; // Dopo migrazione, questo sarà sempre un numero valido
          }
          return null;
        })(),
        currentShield: (() => {
          if (playerDataRaw.currencies_data) {
            const currencies = JSON.parse(playerDataRaw.currencies_data);
            const loadedShield = currencies.current_shield;
            logger.info('DATABASE', `🛡️ LOAD Shield from DB: ${loadedShield} (NULL = DB error after migration)`);
            return loadedShield; // Dopo migrazione, questo sarà sempre un numero valido
          }
          return null;
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

      logger.info('DATABASE', `Complete player data loaded successfully for user ${userId} (player_id: ${playerData.playerId})`);
      logger.info('DATABASE', `Loaded currencies:`, playerData.inventory);
      logger.info('DATABASE', `RecentHonor (30 days):`, recentHonor);
      return playerData;

    } catch (error) {
      logger.error('DATABASE', `Error loading player data: ${error.message}`);
      logger.error('DATABASE', `Error details:`, error);
      
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
        logger.warn('DATABASE', 'Cannot save player data: invalid player data');
        return;
      }

      const playerId = playerData.userId; // Usa auth_id invece del player_id numerico
      
      // 🔴 CRITICAL: Verifica che inventory esista prima di salvare
      // Se inventory è null/undefined, NON salvare per evitare di sovrascrivere i valori esistenti nel database
      if (!playerData.inventory) {
        logger.error('DATABASE', `🚨 CRITICAL: Cannot save player data for ${playerId} - inventory is null/undefined!`);
        logger.error('DATABASE', `Player data state:`, {
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

      logger.info('DATABASE', `Saving player data for player ID: ${playerId}`);
      logger.info('DATABASE', `Player data to save:`, {
        stats: playerData.stats,
        upgrades: playerData.upgrades,
        inventory: playerData.inventory,
        quests: playerData.quests ? playerData.quests.length : 0
      });

      // Prepare data for secure RPC function
      const statsData = playerData.stats ? {
        kills: playerData.stats.kills || 0,
        deaths: playerData.stats.deaths || 0,
        ranking_points: playerData.stats.rankingPoints || 0
      } : null;

      const upgradesData = playerData.upgrades ? {
        hp_upgrades: playerData.upgrades.hpUpgrades || 0,
        shield_upgrades: playerData.upgrades.shieldUpgrades || 0,
        speed_upgrades: playerData.upgrades.speedUpgrades || 0,
        damage_upgrades: playerData.upgrades.damageUpgrades || 0
      } : null;

      // DATABASE IS SOURCE OF TRUTH: Salva i valori esatti accumulati durante il gameplay
      // playerData.inventory contiene i valori accumulati dal player (NPC kills, quest, etc.)
      const currenciesData = {
        credits: Number(playerData.inventory.credits ?? 0),
        cosmos: Number(playerData.inventory.cosmos ?? 0),
        experience: Number(playerData.inventory.experience ?? 0),
        honor: Number(playerData.inventory.honor ?? 0),
        skill_points: Number(playerData.inventory.skillPoints ?? 0),
        skill_points_total: Number(playerData.inventory.skillPointsTotal ?? playerData.inventory.skillPoints ?? 0),
        // 🟢 MMO-CORRECT: Salva SEMPRE HP/shield correnti (persistenza vera)
        // NULL ora significa "errore DB", mai "ottimizzazione"
        // Questo garantisce che ogni logout/login mantenga lo stato esatto
        current_health: (() => {
          const health = playerData.health !== null && playerData.health !== undefined ? playerData.health : null;
          logger.info('DATABASE', `💚 SAVE Health: ${health} (always saved for true MMO persistence)`);
          return health !== null ? Number(health) : null;
        })(),
        current_shield: (() => {
          const shield = playerData.shield !== null && playerData.shield !== undefined ? playerData.shield : null;
          logger.info('DATABASE', `🛡️ SAVE Shield: ${shield} (always saved for true MMO persistence)`);
          return shield !== null ? Number(shield) : null;
        })()
      };
      
      // 🔴 FIX: Salva SEMPRE i currencies quando vengono modificati durante il gameplay
      // Il server è la fonte di verità - se i valori sono stati modificati in memoria (NPC kills, etc.),
      // devono essere salvati nel database, indipendentemente dallo stato iniziale del DB
      
      // Rimuovi il flag interno prima di salvare (non più necessario)
      delete playerData.inventory._hadNullInDb;

      // Prepare profile data (e.g., is_administrator)
      // 🔒 SECURITY: NON salvare is_administrator dal client - è gestito solo dal database
      // Il flag admin può essere modificato solo direttamente nel database, non tramite gameplay
      const profileData = null;

      // Use secure RPC function instead of direct table access
      logger.info('DATABASE', `Calling update_player_data_secure RPC for auth_id: ${playerId}`);
      logger.info('DATABASE', `Currencies data to save:`, currenciesData);
      const { data: updateResult, error: updateError } = await supabase.rpc(
        'update_player_data_secure',
        {
          auth_id_param: playerId,
          stats_data: statsData,
          upgrades_data: upgradesData,
          currencies_data: currenciesData,
          profile_data: profileData
        }
      );

      if (updateError) {
        logger.error('DATABASE', `Error updating player data: ${updateError.message}`);
        throw updateError;
      }

      logger.info('DATABASE', `Player data saved successfully for ${playerId}`);

      // Salva quest progress separatamente se presente
      if (playerData.quests && Array.isArray(playerData.quests)) {
        logger.info('DATABASE', `Saving quest progress for auth_id: ${playerId}`);
        for (const quest of playerData.quests) {
          const questResult = await supabase.from('quest_progress').upsert({
            auth_id: playerId,
            quest_id: quest.quest_id,
            objectives: quest.objectives || [],
            completed: quest.completed || false
          }, {
            onConflict: 'auth_id,quest_id'
          });

          if (questResult.error) {
            logger.error('DATABASE', `Error saving quest progress: ${questResult.error.message}`);
          }
        }
      }

    } catch (error) {
      logger.error('DATABASE', `Error saving player data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Crea i record iniziali per un nuovo giocatore
   * @param {string} playerId - auth_id del giocatore
   */
  async createInitialPlayerRecords(playerId) {
    try {
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
        damage_upgrades: 0
      });

      // Currencies iniziali
      await supabase.from('player_currencies').insert({
        auth_id: playerId,
        credits: 1000,
        cosmos: 100,
        experience: 0,
        honor: 0,
        skill_points: 0,
        skill_points_total: 0
      });

      logger.info('DATABASE', `Initial player records created for ${playerId}`);
    } catch (error) {
      logger.error('DATABASE', `Error creating initial player records: ${error.message}`);
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
        logger.warn('DATABASE', `Error saving honor snapshot: ${error.message}`);
      }
    } catch (error) {
      logger.warn('DATABASE', `Error in saveHonorSnapshot: ${error.message}`);
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
        logger.warn('DATABASE', `Error getting recent honor average: ${error.message}`);
        return 0;
      }

      return Number(data || 0);
    } catch (error) {
      logger.warn('DATABASE', `Error in getRecentHonorAverage: ${error.message}`);
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
        damageUpgrades: 0
      },
      inventory: {
        credits: 1000,
        cosmos: 100,
        experience: 0,
        honor: 0,
        skillPoints: 0,
        skillPointsTotal: 0
      },
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
        logger.info('DATABASE', 'Starting periodic save of all player data...');
        const players = Array.from(this.mapServer.players.values());
        let savedCount = 0;
        let errorCount = 0;

        for (const playerData of players) {
          try {
            await this.savePlayerData(playerData);
            savedCount++;
          } catch (error) {
            logger.error('DATABASE', `Error saving player data for ${playerData.userId}: ${error.message}`);
            errorCount++;
          }
        }

        logger.info('DATABASE', `Periodic save completed: ${savedCount} saved, ${errorCount} errors`);
      } catch (error) {
        logger.error('DATABASE', `Error in periodic save: ${error.message}`);
      }
    }, SAVE_INTERVAL);

    logger.info('DATABASE', `Periodic save system initialized (every ${SAVE_INTERVAL / 1000 / 60} minutes)`);
  }

  /**
   * Ferma il salvataggio periodico
   */
  stopPeriodicSave() {
    if (this.periodicSaveInterval) {
      clearInterval(this.periodicSaveInterval);
      this.periodicSaveInterval = null;
      logger.info('DATABASE', 'Periodic save system stopped');
    }
  }
}

module.exports = PlayerDataManager;
