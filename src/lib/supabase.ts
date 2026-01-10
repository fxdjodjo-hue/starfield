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
          auth_id: string
          username: string
          player_id: number
          created_at: string
          updated_at: string
        }
        Insert: {
          auth_id: string
          username: string
          player_id: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          auth_id?: string
          username?: string
          player_id?: number
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

// MMO SECURE API - Client communicates with server only
// NO direct database access - everything goes through secure server endpoints
export const gameAPI = {
  // Create player profile after Supabase registration (calls server API)
  createPlayerProfile: async (username: string) => {
    try {
      // Get current user from Supabase auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: null, error: authError || new Error('No authenticated user') };
      }

      // Call server endpoint to create profile (server will use secure RPC)
      const response = await fetch('http://localhost:3000/api/create-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ username })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get player data through server (no direct DB access)
  getPlayerData: async () => {
    try {
      // Get current user auth_id
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: null, error: authError || new Error('No authenticated user') };
      }

      // Request data through secure server API using auth_id
      const response = await fetch(`http://localhost:3000/api/player-data/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return { data: null, error };
    }
  },

  // Save player data through server (no direct DB access)
  savePlayerData: async (playerData: any) => {
    try {
      // Get current user auth_id
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: null, error: authError || new Error('No authenticated user') };
      }

      // Send data through secure server API using auth_id
      const response = await fetch(`http://localhost:3000/api/player-data/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(playerData)
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return { data: null, error };
    }
  }
}

export default supabase
