const { logger } = require('../logger.cjs');
const ServerLoggerWrapper = require('../core/infrastructure/ServerLoggerWrapper.cjs');
// Carica la configurazione delle quest dal file condiviso
const QUESTS_CONFIG = require('../../shared/quests.json');

/**
 * ServerQuestManager - Gestisce la logica delle quest lato server
 * Responsabilità:
 * - Tracciare il progresso delle quest
 * - Gestire eventi (kill, explore, etc.)
 * - Aggiornare il database
 * - Inviare aggiornamenti al client
 */
class ServerQuestManager {
    constructor(mapServer) {
        this.mapServer = mapServer;
    }

    /**
     * Gestisce l'evento di uccisione di un NPC
     * @param {string} playerId - ID del giocatore (auth_id o clientId se mappato)
     * @param {string} npcType - Tipo di NPC ucciso
     */
    async onNpcKilled(playerId, npcType) {
        // Normalize input
        const normalizedNpcType = npcType.toLowerCase();

        const player = this.mapServer.players.get(playerId);
        if (!player) return;

        // Se quests non è inizializzato, inizializzalo
        if (!player.quests) player.quests = [];

        // Filtra solo le quest attive (non completate)
        const activeQuests = player.quests.filter(q => !q.is_completed && !q.isCompleted && !q.completed);

        let progressUpdated = false;

        for (const questProgress of activeQuests) {
            const questId = questProgress.quest_id || questProgress.id;
            const questConfig = QUESTS_CONFIG[questId];

            if (!questConfig) {
                ServerLoggerWrapper.warn('QUEST', `Unknown quest config for id: ${questId}`);
                continue;
            }

            // Controlla se questa quest ha obiettivi di tipo 'kill' per questo NPC
            // Nota: activeQuests contiene lo stato corrente.
            // Dobbiamo confrontare con la config statica per sapere COSA fare,
            // e aggiornare lo stato dinamico in memory.

            // Assicuriamoci che progress.objectives sia sincronizzato con config
            if (!questProgress.objectives) questProgress.objectives = [];

            // Itera sugli obiettivi della CONFIGURAZIONE per trovare quelli rilevanti
            const relevantObjectives = questConfig.objectives.filter(obj =>
                obj.type === 'kill' && (obj.targetType === normalizedNpcType || obj.targetType.toLowerCase() === normalizedNpcType)
            );

            if (relevantObjectives.length === 0) continue;

            let questUpdated = false;

            for (const configObj of relevantObjectives) {
                // Trova lo stato corrente di questo obiettivo
                let progressObj = questProgress.objectives.find(o => o.id === configObj.id);

                // Se non esiste ancora nello stato dinamico, crealo
                if (!progressObj) {
                    progressObj = {
                        id: configObj.id,
                        current: 0,
                        target: configObj.target, // Copia target per sicurezza
                        type: 'kill'
                    };
                    questProgress.objectives.push(progressObj);
                }

                // Se l'obiettivo non è già completato, aggiornalo
                if (progressObj.current < configObj.target) {
                    progressObj.current++;
                    questUpdated = true;
                    progressUpdated = true;

                    ServerLoggerWrapper.info('QUEST', `Player ${player.nickname} progress on ${questId}: ${progressObj.current}/${configObj.target} (${normalizedNpcType})`);
                }
            }

            if (questUpdated) {
                // Verifica completamento quest
                const allObjectivesComplete = questConfig.objectives.every(confObj => {
                    const progObj = questProgress.objectives.find(p => p.id === confObj.id);
                    return progObj && progObj.current >= confObj.target;
                });

                if (allObjectivesComplete) {
                    questProgress.is_completed = true;
                    questProgress.isCompleted = true; // Compatibilità
                    questProgress.completed_at = new Date().toISOString();

                    ServerLoggerWrapper.info('QUEST', `Player ${player.nickname} COMPLETED quest: ${questId}`);

                    // Assegna ricompense (opzionale qui, o delegato al client? 
                    // MEGLIO QUI perché il server è autoritativo)
                    this.awardQuestRewards(player, questConfig);
                }

                // Invia aggiornamento al client
                this.sendQuestUpdate(player, questProgress);

                // Salva DB (importante per non perdere progresso)
                // Usiamo un save asincrono rapido update solo di questa quest
                this.persistQuestProgress(player, questProgress);
            }
        }
    }

    /**
     * Gestisce il movimento del player per obiettivi di tipo explore (coordinate)
     * @param {Object} player - Player object from mapServer
     * @param {number} now - Timestamp corrente (ms)
     */
    async onPlayerPositionUpdated(player, now = Date.now()) {
        if (!player || !player.position) return;
        if (!player.quests || player.quests.length === 0) return;

        const COORD_CHECK_INTERVAL_MS = 500;
        const lastCheck = player.lastQuestCoordinateCheckAt || 0;
        if (now - lastCheck < COORD_CHECK_INTERVAL_MS) return;
        player.lastQuestCoordinateCheckAt = now;

        const posX = Number(player.position.x);
        const posY = Number(player.position.y);
        if (!Number.isFinite(posX) || !Number.isFinite(posY)) return;

        const activeQuests = player.quests.filter(q => !q.is_completed && !q.isCompleted && !q.completed);
        for (const questProgress of activeQuests) {
            const questId = questProgress.quest_id || questProgress.id;
            const questConfig = QUESTS_CONFIG[questId];

            if (!questConfig || !Array.isArray(questConfig.objectives)) {
                continue;
            }

            if (!questProgress.objectives) questProgress.objectives = [];

            let questUpdated = false;

            for (const configObj of questConfig.objectives) {
                if (configObj.type !== 'explore') continue;
                if (configObj.x === undefined || configObj.y === undefined) continue;

                const radius = Number(configObj.radius) || 500;
                const dx = posX - Number(configObj.x);
                const dy = posY - Number(configObj.y);
                const distanceSq = (dx * dx) + (dy * dy);

                if (distanceSq > radius * radius) continue;

                const target = Number(configObj.target) || 1;
                let progressObj = questProgress.objectives.find(o => o.id === configObj.id);

                if (!progressObj) {
                    progressObj = {
                        id: configObj.id,
                        current: 0,
                        target: target,
                        type: 'explore'
                    };
                    questProgress.objectives.push(progressObj);
                }

                if (progressObj.current < target) {
                    progressObj.current = target;
                    questUpdated = true;
                    ServerLoggerWrapper.info('QUEST', `Player ${player.nickname} reached explore objective ${configObj.id} for ${questId}`);
                }
            }

            if (questUpdated) {
                const allObjectivesComplete = questConfig.objectives.every(confObj => {
                    const progObj = questProgress.objectives.find(p => p.id === confObj.id);
                    const target = Number(confObj.target) || 1;
                    return progObj && progObj.current >= target;
                });

                if (allObjectivesComplete) {
                    questProgress.is_completed = true;
                    questProgress.isCompleted = true;
                    questProgress.completed_at = new Date().toISOString();

                    ServerLoggerWrapper.info('QUEST', `Player ${player.nickname} COMPLETED quest: ${questId}`);
                    this.awardQuestRewards(player, questConfig);
                }

                this.sendQuestUpdate(player, questProgress);
                this.persistQuestProgress(player, questProgress);
            }
        }
    }

    /**
     * Assegna le ricompense della quest completata
     */
    awardQuestRewards(player, questConfig) {
        if (!questConfig.rewards) return;

        let rewardsAssigned = false;
        let totalExperienceGranted = 0;

        questConfig.rewards.forEach(reward => {
            const amount = Number(reward.amount) || 0;
            switch (reward.type) {
                case 'credits':
                    player.inventory.credits = (Number(player.inventory.credits) || 0) + amount;
                    rewardsAssigned = true;
                    break;
                case 'cosmos':
                    player.inventory.cosmos = (Number(player.inventory.cosmos) || 0) + amount;
                    rewardsAssigned = true;
                    break;
                case 'experience':
                    player.inventory.experience = (Number(player.inventory.experience) || 0) + amount;
                    totalExperienceGranted += amount;
                    rewardsAssigned = true;
                    break;
                case 'honor':
                    player.inventory.honor = (Number(player.inventory.honor) || 0) + amount;
                    rewardsAssigned = true;
                    break;
                // Add items logic if needed
            }
        });

        if (totalExperienceGranted > 0 && this.mapServer.petProgressionManager && typeof this.mapServer.petProgressionManager.applyPlayerExperienceGain === 'function') {
            this.mapServer.petProgressionManager.applyPlayerExperienceGain(
                player,
                totalExperienceGranted,
                `quest_reward_${questConfig.id || 'unknown'}`
            );
        }

        if (rewardsAssigned) {
            ServerLoggerWrapper.info('QUEST', `Player ${player.nickname} awarded for quest ${questConfig.id}: ${questConfig.rewards.map(r => `${r.amount} ${r.type}`).join(', ')}`);

            // Invia update inventario
            if (player.ws && player.ws.readyState === 1) { // WebSocket.OPEN
                player.ws.send(JSON.stringify({
                    type: 'player_state_update',
                    inventory: player.inventory,
                    petState: player.petState || null,
                    source: `quest_reward_${questConfig.id}`
                }));
            }
        }
    }

    /**
     * Invia messaggio WebSocket di aggiornamento quest
     */
    sendQuestUpdate(player, questProgress) {
        if (!player.ws || player.ws.readyState !== 1) return;

        const message = {
            type: 'quest_progress_update',
            questId: questProgress.quest_id || questProgress.id,
            objectives: questProgress.objectives,
            isCompleted: !!questProgress.is_completed
        };

        player.ws.send(JSON.stringify(message));
    }

    /**
     * Accetta una quest (Server Authoritative)
     */
    async acceptQuest(player, questId) {
        const questConfig = QUESTS_CONFIG[questId];
        if (!questConfig) {
            ServerLoggerWrapper.warn('QUEST', `Player ${player.nickname} tried to accept unknown quest: ${questId}`);
            return;
        }

        if (!player.quests) player.quests = [];

        // Check if already active
        const existing = player.quests.find(q => (q.quest_id === questId || q.id === questId));
        if (existing) {
            if (existing.is_completed || existing.isCompleted || existing.completed) {
                ServerLoggerWrapper.warn('QUEST', `Player ${player.nickname} tried to re-accept completed quest: ${questId}`);
                return;
            }
            return; // Already active
        }

        const MAX_ACTIVE_QUESTS = 3;
        const activeCount = player.quests.filter(q => !q.is_completed && !q.isCompleted && !q.completed).length;
        if (activeCount >= MAX_ACTIVE_QUESTS) {
            ServerLoggerWrapper.warn('QUEST', `Player ${player.nickname} reached max active quests (${MAX_ACTIVE_QUESTS})`);
            return;
        }

        const newQuest = {
            id: questId,
            quest_id: questId, // Compatibilità
            objectives: [],
            is_completed: false,
            isCompleted: false,
            accepted_at: new Date().toISOString()
        };

        player.quests.push(newQuest);
        ServerLoggerWrapper.info('QUEST', `Player ${player.nickname} accepted quest: ${questId}`);

        // Persist immediately
        this.persistQuestProgress(player, newQuest);
    }

    /**
     * Abbandona una quest
     */
    async abandonQuest(player, questId) {
        if (!player.quests) return;

        const questIndex = player.quests.findIndex(q => (q.quest_id === questId || q.id === questId));
        if (questIndex !== -1) {
            const quest = player.quests[questIndex];

            // Non permettere di abbandonare quest completate
            if (quest.is_completed || quest.isCompleted) {
                ServerLoggerWrapper.warn('QUEST', `Player ${player.nickname} tried to abandon completed quest: ${questId}`);
                return;
            }

            player.quests.splice(questIndex, 1);
            ServerLoggerWrapper.info('QUEST', `Player ${player.nickname} abandoned quest: ${questId}`);

            // Rimuovi dal DB
            this.removeQuestFromDB(player, questId);
        }
    }

    /**
     * Rimuove la quest dal DB
     */
    async removeQuestFromDB(player, questId) {
        try {
            const wsManager = this.mapServer.websocketManager;
            if (wsManager && wsManager.playerDataManager) {
                const supabase = wsManager.playerDataManager.getSupabaseClient();
                if (supabase) {
                    // Delete row from quest_progress
                    const authId = player.userId || player.authId || null;
                    if (!authId) {
                        ServerLoggerWrapper.error('QUEST', `Missing auth_id while removing quest ${questId} for player ${player.playerId}`);
                        return;
                    }

                    const { error } = await supabase
                        .from('quest_progress')
                        .delete()
                        .eq('auth_id', authId)
                        .eq('quest_id', questId);

                    if (error) {
                        ServerLoggerWrapper.error('QUEST', `Failed to delete quest ${questId} from DB: ${error.message}`);
                    }
                }
            }
        } catch (err) {
            ServerLoggerWrapper.error('QUEST', `Error removing quest from DB: ${err.message}`);
        }
    }

    /**
     * Salva il progresso su DB
     */
    async persistQuestProgress(player, questProgress) {
        // Nota: questo usa il client Supabase globale o passato in altro modo.
        // Assumiamo che mapServer abbia accesso a un db manager o usiamo require
        // Per semplicità e robustezza, usiamo il PlayerDataManager se accessibile dal mapServer,
        // ma MapServer non ha accesso diretto a PlayerDataManager instance nel server.cjs setup standard.
        // Tuttavia, server.cjs inizializza supabase globalmente. 
        // Qui facciamo una require locale di supabase client se necessario o meglio usiamo un helper.

        // SOLUZIONE MIGLIORE: Delegare al WebSocketManager o simile se disponibile,
        // oppure usare require del DB helper.

        try {
            // HACK: Re-inizializziamo client qui o importiamo singleton se esiste.
            // Visto che PlayerDataManager.js è in core/database, possiamo usarlo?
            // Non è statico.

            // Usiamo un approccio "fire and forget" tramite evento o riferimento globale se possibile.
            // Ma per ora, dato che server.cjs non espone globalmente supabase, importiamo createClient locale
            // o meglio ancora, ci facciamo passare il db handler nel costruttore.

            // Se non abbiamo DB access qui, ci affidiamo al periodic save globale del server
            // che salverà il player state aggiornato in memoria.
            // PERÒ: l'utente potrebbe chiudere subito.

            // Verifichiamo se MapServer ha accesso al DB.
            // Non sembra.

            // TORNANDO ALLA REALTÀ: server.cjs inizializza PlayerDataManager? No, usa WebSocketConnectionManager.
            // WebSocketConnectionManager usa PlayerDataManager? Sì.
            // Il nostro MapServer ha riferimento al websocketManager? Sì, se guardiamo NpcRewardSystem:
            // const websocketManager = this.mapServer.websocketManager;

            const wsManager = this.mapServer.websocketManager;
            if (wsManager && wsManager.playerDataManager && player) {
                // Salvataggio parziale ottimizzato? O full save?
                // PlayerDataManager ha savePlayerData.
                // Creiamo un oggetto player parziale wrapper se serve, o passiamo quello intero.
                // Passiamo l'oggetto player della mappa che contiene i dati aggiornati.
                // NOTA: il player objeto in mappa ha una struttura specifica.

                // Salva direttamente l'oggetto player della mappa (già autoritativo)
                wsManager.playerDataManager.savePlayerData(player).catch(err => {
                    ServerLoggerWrapper.error('QUEST', `Failed to persist quest progress: ${err.message}`);
                });
            }

        } catch (err) {
            console.error('Error persisting quest', err);
        }
    }
}

module.exports = ServerQuestManager;
