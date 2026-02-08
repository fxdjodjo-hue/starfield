import { createClient } from '@supabase/supabase-js'
import { getApiBaseUrl } from '../config/NetworkConfig'

function getRequiredEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = (import.meta.env?.[name] || '').trim()
  if (!value) {
    console.error(`[SUPABASE CLIENT] Missing required env ${name}. Set it in .env before starting the client.`)
    throw new Error(`[SUPABASE CLIENT] Missing required env ${name}.`)
  }
  return value
}

// Supabase configuration (fail-fast se env mancante)
const supabaseUrl = getRequiredEnv('VITE_SUPABASE_URL')
const supabaseAnonKey = getRequiredEnv('VITE_SUPABASE_ANON_KEY')

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
          created_at: string
          updated_at: string
        }
        Insert: {
          player_id: number
          credits?: number
          cosmos?: number
          experience?: number
          honor?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          player_id?: number
          credits?: number
          cosmos?: number
          experience?: number
          honor?: number
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
      // Get playtest code from session storage if available
      const playtestCode = sessionStorage.getItem('playtest_code');

      // Get current user from Supabase auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { data: null, error: authError || new Error('No authenticated user') };
      }

      // Call server endpoint to create profile (server will use secure RPC)
      const response = await fetch(`${getApiBaseUrl()}/api/create-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          username,
          playtestCode: playtestCode || undefined
        })
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
      const response = await fetch(`${getApiBaseUrl()}/api/player-data/${user.id}`, {
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
      const response = await fetch(`${getApiBaseUrl()}/api/player-data/${user.id}`, {
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
  },

  // Update quest progress
  updateQuestProgress: async (playerId: number, questId: string, progress: any) => {
    try {
      // Reuse the savePlayerData endpoint but specifically for quests if possible, 
      // or just trust that the server handles the quest update structure.
      // Since we don't have a specific quest endpoint exposed in the client code above, 
      // and we want to ensure persistence, we will use the player-data endpoint 
      // which usually accepts partial updates or we construct a partial object.

      // However, `savePlayerData` takes `playerData`. 
      // Let's try to send a specific structure that the server might recognize or 
      // if not, we rely on the fact that `QuestTrackingSystem` triggers `markAsChanged` 
      // which sends a `save_request`.

      // BUT, `save_request` usually saves what the server has in memory. 
      // If we don't send the data to the server, it won't save it.

      // The most robust way without changing server code we can't see is to use `savePlayerData`
      // with the quest data nested.

      // Construct a partial player data object with just the quest update
      // Note: This assumes the server merges 'quests' or handle 'quest_progress' table updates.
      // If the server expects specific structure, we might need to adjust.
      // Given the schema earlier: `quest_progress` table exists.

      // Let's use the generic save endpoint but scoped to quests if backend supports it.
      // If not, we fall back to the generic `savePlayerData` with a special flag or structure.

      // ACTUAL SOLUTION:
      // We will reuse the `savePlayerData` mechanisms but passing the quest progress 
      // wrapped in a way the server likely handles (e.g. `quests` array or similar).

      // Since we can't see the server handler for `PUT /api/player-data/:id`, 
      // we'll try to use a dedicated fetch if we can guess the route, 
      // OR just rely on ClientNetworkSystem sending the update via websocket 
      // (which is what `markAsChanged` does - it triggers `sendSaveRequest`).

      // WAIT! `QuestTrackingSystem` calls `markAsChanged` -> `ClientNetworkSystem.sendSaveRequest`.
      // The `sendSaveRequest` sends a `save_request` message.
      // Does the server `save_request` handler read from the *socket* payload? 
      // No, `sendSaveRequest` usually just has IDs.
      // So the server saves its *in-memory state*. 
      // We need to UPDATE the server's in-memory state first!

      // So `updateQuestProgress` should probably send a `quest_update` message to the server?
      // But `SupabaseClient` is HTTP based / Library.

      // HYBRID APPROACH:
      // Use HTTP to save quest progress directly to DB via our API endpoint wrapper.
      // We'll assume `/api/player-data/:id/quests` or similar might exist, OR just use `savePlayerData`
      // with a `quest_progress` field.

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'No user' };

      // Try to save directly to the quest_progress table if we had direct access, 
      // but we are 'MMO Secure'.

      // For now, let's try to assume `savePlayerData` handles it if we pass `quests` object.
      // Or better, since `QuestManager` already updates the local state, 
      // and `saveIfChanged` triggers a save...

      // Let's implement a specific network call here to ensure it writes.
      // We'll mimic `savePlayerData` but specifically for quests.

      console.log(`[SupabaseClient] Sending quest update for ${questId} to server endpoint...`);
      const response = await fetch(`${getApiBaseUrl()}/api/player-data/${user.id}/quest-progress`, {
        method: 'POST', // or PUT
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          questId,
          progress,
          // Add timestamp or other metadata
          updatedAt: new Date().toISOString()
        })
      });

      if (response.ok) {
        console.log(`[SupabaseClient] Quest update success!`);
        return { data: true, error: null };
      }

      console.warn(`[SupabaseClient] Custom endpoint failed (${response.status}), falling back to standard save...`);

      // Fallback: use savePlayerData
      return gameAPI.savePlayerData({
        quests: {
          [questId]: progress
        }
      });

    } catch (error) {
      console.error('Error updating quest progress:', error);
      return { data: null, error };
    }
  },

  // Delete quest progress (abandonment)
  deleteQuestProgress: async (playerId: number, questId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: null, error: 'No user' };

      console.log(`[SupabaseClient] Sending quest delete for ${questId} to server endpoint...`);
      const response = await fetch(`${getApiBaseUrl()}/api/player-data/${user.id}/quest-progress?questId=${questId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (response.ok) {
        console.log(`[SupabaseClient] Quest delete success!`);
        return { data: true, error: null };
      }

      return { data: null, error: `Delete failed: ${response.status}` };
    } catch (error) {
      console.error('Error deleting quest progress:', error);
      return { data: null, error };
    }
  }
}

export default supabase
