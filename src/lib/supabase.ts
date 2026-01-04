import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Database types (simplified for single-player data only)
export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      player_stats: {
        Row: {
          player_id: number
          kills: number
          deaths: number
          missions_completed: number
          play_time: number
          created_at: string
          updated_at: string
        }
        Insert: {
          player_id: number
          kills?: number
          deaths?: number
          missions_completed?: number
          play_time?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          player_id?: number
          kills?: number
          deaths?: number
          missions_completed?: number
          play_time?: number
          created_at?: string
          updated_at?: string
        }
      }
      player_upgrades: {
        Row: {
          player_id: number
          hp_upgrades: number
          shield_upgrades: number
          speed_upgrades: number
          damage_upgrades: number
          created_at: string
          updated_at: string
        }
        Insert: {
          player_id: number
          hp_upgrades?: number
          shield_upgrades?: number
          speed_upgrades?: number
          damage_upgrades?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          player_id?: number
          hp_upgrades?: number
          shield_upgrades?: number
          speed_upgrades?: number
          damage_upgrades?: number
          created_at?: string
          updated_at?: string
        }
      }
      player_currencies: {
        Row: {
          player_id: number
          credits: number
          cosmos: number
          experience: number
          honor: number
          skill_points_current: number
          skill_points_total: number
          created_at: string
          updated_at: string
        }
        Insert: {
          player_id: number
          credits?: number
          cosmos?: number
          experience?: number
          honor?: number
          skill_points_current?: number
          skill_points_total?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          player_id?: number
          credits?: number
          cosmos?: number
          experience?: number
          honor?: number
          skill_points_current?: number
          skill_points_total?: number
          created_at?: string
          updated_at?: string
        }
      }
      quest_progress: {
        Row: {
          id: string
          player_id: number
          quest_id: string
          objectives: any // JSONB array of quest objectives
          is_completed: boolean
          started_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          player_id: number
          quest_id: string
          objectives?: any
          is_completed?: boolean
          started_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          player_id?: number
          quest_id?: string
          objectives?: any
          is_completed?: boolean
          started_at?: string
          completed_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {}
  }
}

// Auth helper functions
export const auth = {
  signUp: async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: username
        }
      }
    })
    return { data, error }
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  },

  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// Game data helpers - Simplified for single-player data only
export const gameAPI = {
  // Get all player data at once (for loading game)
  getPlayerData: async (playerId: number) => {
    try {
      const [profile, stats, upgrades, currencies, quests] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('player_id', playerId).maybeSingle(),
        supabase.from('player_stats').select('*').eq('player_id', playerId).maybeSingle(),
        supabase.from('player_upgrades').select('*').eq('player_id', playerId).maybeSingle(),
        supabase.from('player_currencies').select('*').eq('player_id', playerId).maybeSingle(),
        supabase.from('quest_progress').select('*').eq('player_id', playerId)
      ]);

      // Gestisci il caso in cui alcuni dati potrebbero non esistere (nuovo utente)
      const hasErrors = profile.error || stats.error || upgrades.error || currencies.error || quests.error;
      const hasData = profile.data || stats.data || upgrades.data || currencies.data || (quests.data && quests.data.length > 0);

      if (hasErrors && !hasData) {
        // Se ci sono errori E nessun dato, allora è un errore vero
        return {
          data: null,
          error: profile.error || stats.error || upgrades.error || currencies.error || quests.error
        };
      }

      // Se il profilo esiste ma mancano alcuni dati, creali al volo per utenti esistenti
      let finalData = {
        profile: profile.data || null,
        stats: stats.data || null,
        upgrades: upgrades.data || null,
        currencies: currencies.data || null,
        quests: quests.data || []
      };

      if (profile.data && (!stats.data || !upgrades.data || !currencies.data)) {
        console.log('🔧 [gameAPI] Creazione dati mancanti per utente esistente...');

        const missingDataPromises = [];

        if (!stats.data) {
          console.log('📊 [gameAPI] Creazione statistiche mancanti...');
          missingDataPromises.push(
            supabase.from('player_stats').insert({
              player_id: playerId,
              kills: 0,
              deaths: 0,
              missions_completed: 0,
              play_time: 0
            })
          );
        }

        if (!upgrades.data) {
          console.log('⬆️ [gameAPI] Creazione upgrade mancanti...');
          missingDataPromises.push(
            supabase.from('player_upgrades').insert({
              player_id: playerId,
              hp_upgrades: 0,
              shield_upgrades: 0,
              speed_upgrades: 0,
              damage_upgrades: 0
            })
          );
        }

        if (!currencies.data) {
          console.log('💰 [gameAPI] Creazione valute mancanti...');
          missingDataPromises.push(
            supabase.from('player_currencies').insert({
              player_id: playerId,
              credits: 1000,
              cosmos: 100,
              experience: 0,
              honor: 0,
              skill_points_current: 0,
              skill_points_total: 0
            })
          );
        }

        if (missingDataPromises.length > 0) {
          await Promise.all(missingDataPromises);

          // Ricarica tutti i dati dopo aver creato quelli mancanti
          const [newProfile, newStats, newUpgrades, newCurrencies, newQuests] = await Promise.all([
            supabase.from('user_profiles').select('*').eq('player_id', playerId).maybeSingle(),
            supabase.from('player_stats').select('*').eq('player_id', playerId).maybeSingle(),
            supabase.from('player_upgrades').select('*').eq('player_id', playerId).maybeSingle(),
            supabase.from('player_currencies').select('*').eq('player_id', playerId).maybeSingle(),
            supabase.from('quest_progress').select('*').eq('player_id', playerId)
          ]);

          finalData = {
            profile: newProfile.data || profile.data,
            stats: newStats.data || stats.data,
            upgrades: newUpgrades.data || upgrades.data,
            currencies: newCurrencies.data || currencies.data,
            quests: newQuests.data || quests.data || []
          };

          console.log('✅ [gameAPI] Dati mancanti creati e ricaricati');
        }
      }

      return {
        data: finalData,
        error: null
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Save all player data at once (for saving game)
  savePlayerData: async (playerId: number, playerData: any) => {
    try {
      const updates = [];

      // Update stats
      if (playerData.stats) {
        updates.push(
          supabase.from('player_stats').upsert({
            player_id: playerId,
            ...playerData.stats,
            updated_at: new Date().toISOString()
          })
        );
      }

      // Update upgrades
      if (playerData.upgrades) {
        updates.push(
          supabase.from('player_upgrades').upsert({
            player_id: playerId,
            ...playerData.upgrades,
            updated_at: new Date().toISOString()
          })
        );
      }

      // Update currencies
      if (playerData.currencies) {
        updates.push(
          supabase.from('player_currencies').upsert({
            player_id: playerId,
            ...playerData.currencies,
            updated_at: new Date().toISOString()
          })
        );
      }

      // Update quest progress
      if (playerData.quests) {
        const questUpdates = playerData.quests.map((quest: any) =>
          supabase.from('quest_progress').upsert({
            player_id: playerId,
            quest_id: quest.quest_id,
            objectives: quest.objectives,
            is_completed: quest.is_completed,
            completed_at: quest.completed_at
          })
        );
        updates.push(...questUpdates);
      }

      const results = await Promise.all(updates);
      const errors = results.filter(result => result.error);

      return {
        data: results.filter(result => result.data),
        error: errors.length > 0 ? errors[0].error : null
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Individual table operations (for specific updates)
  updatePlayerStats: async (playerId: number, stats: any) => {
    const { data, error } = await supabase
      .from('player_stats')
      .upsert({
        player_id: playerId,
        ...stats,
        updated_at: new Date().toISOString()
      });
    return { data, error };
  },

  updatePlayerUpgrades: async (playerId: number, upgrades: any) => {
    const { data, error } = await supabase
      .from('player_upgrades')
      .upsert({
        player_id: playerId,
        ...upgrades,
        updated_at: new Date().toISOString()
      });
    return { data, error };
  },

  updatePlayerCurrencies: async (playerId: number, currencies: any) => {
    const { data, error } = await supabase
      .from('player_currencies')
      .upsert({
        player_id: playerId,
        ...currencies,
        updated_at: new Date().toISOString()
      });
    return { data, error };
  },

  updateQuestProgress: async (playerId: number, questId: string, progress: any) => {
    const { data, error } = await supabase
      .from('quest_progress')
      .upsert({
        player_id: playerId,
        quest_id: questId,
        objectives: progress.objectives,
        is_completed: progress.is_completed,
        completed_at: progress.completed_at
      });
    return { data, error };
  },

  getQuestProgress: async (playerId: number) => {
    const { data, error } = await supabase
      .from('quest_progress')
      .select('*')
      .eq('player_id', playerId);
    return { data, error };
  }
}

export default supabase
