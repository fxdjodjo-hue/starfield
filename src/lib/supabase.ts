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

// Database types (generated from schema)
export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          status: 'online' | 'offline' | 'away'
          last_seen: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          status?: 'online' | 'offline' | 'away'
          last_seen?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          status?: 'online' | 'offline' | 'away'
          last_seen?: string
          created_at?: string
          updated_at?: string
        }
      }
      player_stats: {
        Row: {
          id: string
          user_id: string
          level: number
          experience: number
          credits: number
          cosmos: number
          honor: number
          skill_points: number
          total_playtime: number
          games_played: number
          games_won: number
          enemies_killed: number
          quests_completed: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          level?: number
          experience?: number
          credits?: number
          cosmos?: number
          honor?: number
          skill_points?: number
          total_playtime?: number
          games_played?: number
          games_won?: number
          enemies_killed?: number
          quests_completed?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          level?: number
          experience?: number
          credits?: number
          cosmos?: number
          honor?: number
          skill_points?: number
          total_playtime?: number
          games_played?: number
          games_won?: number
          enemies_killed?: number
          quests_completed?: number
          created_at?: string
          updated_at?: string
        }
      }
      game_sessions: {
        Row: {
          id: string
          user_id: string
          session_type: string
          start_time: string
          end_time: string | null
          duration: number | null
          score: number
          enemies_killed: number
          credits_earned: number
          experience_gained: number
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_type?: string
          start_time?: string
          end_time?: string | null
          duration?: number | null
          score?: number
          enemies_killed?: number
          credits_earned?: number
          experience_gained?: number
          completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_type?: string
          start_time?: string
          end_time?: string | null
          duration?: number | null
          score?: number
          enemies_killed?: number
          credits_earned?: number
          experience_gained?: number
          completed?: boolean
          created_at?: string
        }
      }
      inventory_items: {
        Row: {
          id: string
          user_id: string
          item_type: string
          item_id: string
          item_name: string
          quantity: number
          equipped: boolean
          acquired_at: string
        }
        Insert: {
          id?: string
          user_id: string
          item_type: string
          item_id: string
          item_name: string
          quantity?: number
          equipped?: boolean
          acquired_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          item_type?: string
          item_id?: string
          item_name?: string
          quantity?: number
          equipped?: boolean
          acquired_at?: string
        }
      }
      quest_progress: {
        Row: {
          id: string
          user_id: string
          quest_id: string
          status: 'not_started' | 'in_progress' | 'completed' | 'failed'
          progress: any
          started_at: string
          completed_at: string | null
          rewards_claimed: boolean
        }
        Insert: {
          id?: string
          user_id: string
          quest_id: string
          status?: 'not_started' | 'in_progress' | 'completed' | 'failed'
          progress?: any
          started_at?: string
          completed_at?: string | null
          rewards_claimed?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          quest_id?: string
          status?: 'not_started' | 'in_progress' | 'completed' | 'failed'
          progress?: any
          started_at?: string
          completed_at?: string | null
          rewards_claimed?: boolean
        }
      }
      user_achievements: {
        Row: {
          id: string
          user_id: string
          achievement_id: string
          achievement_name: string
          description: string | null
          rarity: 'common' | 'rare' | 'epic' | 'legendary'
          points: number
          unlocked_at: string
        }
        Insert: {
          id?: string
          user_id: string
          achievement_id: string
          achievement_name: string
          description?: string | null
          rarity?: 'common' | 'rare' | 'epic' | 'legendary'
          points?: number
          unlocked_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          achievement_id?: string
          achievement_name?: string
          description?: string | null
          rarity?: 'common' | 'rare' | 'epic' | 'legendary'
          points?: number
          unlocked_at?: string
        }
      }
      leaderboard: {
        Row: {
          id: string
          user_id: string
          username: string | null
          display_name: string | null
          level: number | null
          experience: number | null
          honor: number | null
          enemies_killed: number | null
          quests_completed: number | null
          rank: number | null
          last_updated: string
        }
        Insert: {
          id?: string
          user_id: string
          username?: string | null
          display_name?: string | null
          level?: number | null
          experience?: number | null
          honor?: number | null
          enemies_killed?: number | null
          quests_completed?: number | null
          rank?: number | null
          last_updated?: string
        }
        Update: {
          id?: string
          user_id?: string
          username?: string | null
          display_name?: string | null
          level?: number | null
          experience?: number | null
          honor?: number | null
          enemies_killed?: number | null
          quests_completed?: number | null
          rank?: number | null
          last_updated?: string
        }
      }
      friendships: {
        Row: {
          id: string
          user_id: string
          friend_id: string
          status: string
          requested_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          friend_id: string
          status?: string
          requested_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          friend_id?: string
          status?: string
          requested_at?: string
          accepted_at?: string | null
        }
      }
      chat_messages: {
        Row: {
          id: string
          user_id: string
          room_id: string | null
          message_type: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          room_id?: string | null
          message_type?: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          room_id?: string | null
          message_type?: string
          content?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_status: 'online' | 'offline' | 'away'
      quest_status: 'not_started' | 'in_progress' | 'completed' | 'failed'
      achievement_rarity: 'common' | 'rare' | 'epic' | 'legendary'
    }
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

// Game data helpers
export const gameAPI = {
  // Player profile
  getPlayerProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return { data, error }
  },

  updatePlayerProfile: async (userId: string, updates: any) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
    return { data, error }
  },

  // Player stats
  getPlayerStats: async (userId: string) => {
    const { data, error } = await supabase
      .from('player_stats')
      .select('*')
      .eq('user_id', userId)
      .single()
    return { data, error }
  },

  updatePlayerStats: async (userId: string, updates: any) => {
    const { data, error } = await supabase
      .from('player_stats')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    return { data, error }
  },

  // Game sessions
  startGameSession: async (userId: string, sessionType: string = 'single_player') => {
    const { data, error } = await supabase
      .from('game_sessions')
      .insert({
        user_id: userId,
        session_type: sessionType,
        start_time: new Date().toISOString()
      })
      .select()
      .single()
    return { data, error }
  },

  endGameSession: async (sessionId: string, sessionData: any) => {
    const endTime = new Date().toISOString()
    const startTime = new Date(sessionData.start_time)
    const duration = Math.floor((new Date(endTime).getTime() - startTime.getTime()) / 1000)

    const { data, error } = await supabase
      .from('game_sessions')
      .update({
        end_time: endTime,
        duration,
        ...sessionData,
        completed: true
      })
      .eq('id', sessionId)
    return { data, error }
  },

  // Inventory
  getPlayerInventory: async (userId: string) => {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId)
      .order('acquired_at', { ascending: false })
    return { data, error }
  },

  addInventoryItem: async (userId: string, item: any) => {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        user_id: userId,
        ...item
      })
    return { data, error }
  },

  // Quests
  getQuestProgress: async (userId: string) => {
    const { data, error } = await supabase
      .from('quest_progress')
      .select('*')
      .eq('user_id', userId)
    return { data, error }
  },

  updateQuestProgress: async (userId: string, questId: string, updates: any) => {
    const { data, error } = await supabase
      .from('quest_progress')
      .upsert({
        user_id: userId,
        quest_id: questId,
        ...updates
      })
    return { data, error }
  },

  // Leaderboard
  getLeaderboard: async (limit: number = 100) => {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('rank', { ascending: true })
      .limit(limit)
    return { data, error }
  },

  // Achievements
  getUserAchievements: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false })
    return { data, error }
  },

  unlockAchievement: async (userId: string, achievement: any) => {
    const { data, error } = await supabase
      .from('user_achievements')
      .insert({
        user_id: userId,
        ...achievement
      })
    return { data, error }
  }
}

export default supabase
