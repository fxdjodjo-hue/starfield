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
          user_id: string
          kills: number
          deaths: number
          missions_completed: number
          play_time: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          kills?: number
          deaths?: number
          missions_completed?: number
          play_time?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
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
          user_id: string
          hp_upgrades: number
          shield_upgrades: number
          speed_upgrades: number
          damage_upgrades: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          hp_upgrades?: number
          shield_upgrades?: number
          speed_upgrades?: number
          damage_upgrades?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
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
          user_id: string
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
          user_id: string
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
          user_id?: string
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
          user_id: string
          quest_id: string
          objectives: any // JSONB array of quest objectives
          is_completed: boolean
          started_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          quest_id: string
          objectives?: any
          is_completed?: boolean
          started_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
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
  getPlayerData: async (userId: string) => {
    try {
      const [profile, stats, upgrades, currencies, quests] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', userId).single(),
        supabase.from('player_stats').select('*').eq('user_id', userId).single(),
        supabase.from('player_upgrades').select('*').eq('user_id', userId).single(),
        supabase.from('player_currencies').select('*').eq('user_id', userId).single(),
        supabase.from('quest_progress').select('*').eq('user_id', userId)
      ]);

      return {
        data: {
          profile: profile.data,
          stats: stats.data,
          upgrades: upgrades.data,
          currencies: currencies.data,
          quests: quests.data || []
        },
        error: profile.error || stats.error || upgrades.error || currencies.error || quests.error
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Save all player data at once (for saving game)
  savePlayerData: async (userId: string, playerData: any) => {
    try {
      const updates = [];

      // Update stats
      if (playerData.stats) {
        updates.push(
          supabase.from('player_stats').upsert({
            user_id: userId,
            ...playerData.stats,
            updated_at: new Date().toISOString()
          })
        );
      }

      // Update upgrades
      if (playerData.upgrades) {
        updates.push(
          supabase.from('player_upgrades').upsert({
            user_id: userId,
            ...playerData.upgrades,
            updated_at: new Date().toISOString()
          })
        );
      }

      // Update currencies
      if (playerData.currencies) {
        updates.push(
          supabase.from('player_currencies').upsert({
            user_id: userId,
            ...playerData.currencies,
            updated_at: new Date().toISOString()
          })
        );
      }

      // Update quest progress
      if (playerData.quests) {
        const questUpdates = playerData.quests.map((quest: any) =>
          supabase.from('quest_progress').upsert({
            user_id: userId,
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
  updatePlayerStats: async (userId: string, stats: any) => {
    const { data, error } = await supabase
      .from('player_stats')
      .upsert({
        user_id: userId,
        ...stats,
        updated_at: new Date().toISOString()
      });
    return { data, error };
  },

  updatePlayerUpgrades: async (userId: string, upgrades: any) => {
    const { data, error } = await supabase
      .from('player_upgrades')
      .upsert({
        user_id: userId,
        ...upgrades,
        updated_at: new Date().toISOString()
      });
    return { data, error };
  },

  updatePlayerCurrencies: async (userId: string, currencies: any) => {
    const { data, error } = await supabase
      .from('player_currencies')
      .upsert({
        user_id: userId,
        ...currencies,
        updated_at: new Date().toISOString()
      });
    return { data, error };
  },

  updateQuestProgress: async (userId: string, questId: string, progress: any) => {
    const { data, error } = await supabase
      .from('quest_progress')
      .upsert({
        user_id: userId,
        quest_id: questId,
        objectives: progress.objectives,
        is_completed: progress.is_completed,
        completed_at: progress.completed_at
      });
    return { data, error };
  },

  getQuestProgress: async (userId: string) => {
    const { data, error } = await supabase
      .from('quest_progress')
      .select('*')
      .eq('user_id', userId);
    return { data, error };
  }
}

export default supabase
