import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get current user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('User not authenticated')
    }

    // Get request body with game session data
    const { stats, upgrades, currencies, quests } = await req.json()

    // Update all player data in a transaction-like manner
    const updates = []

    // Update stats (reflects PlayerStats component)
    if (stats) {
      updates.push(
        supabaseClient.from('player_stats').upsert({
          user_id: user.id,
          kills: stats.kills || 0,
          deaths: stats.deaths || 0,
          missions_completed: stats.missionsCompleted || 0,
          play_time: stats.playTime || 0,
          updated_at: new Date().toISOString()
        })
      )
    }

    // Update upgrades (reflects PlayerUpgrades component)
    if (upgrades) {
      updates.push(
        supabaseClient.from('player_upgrades').upsert({
          user_id: user.id,
          hp_upgrades: upgrades.hpUpgrades || 0,
          shield_upgrades: upgrades.shieldUpgrades || 0,
          speed_upgrades: upgrades.speedUpgrades || 0,
          damage_upgrades: upgrades.damageUpgrades || 0,
          updated_at: new Date().toISOString()
        })
      )
    }

    // Update currencies (combines all currency components)
    if (currencies) {
      updates.push(
        supabaseClient.from('player_currencies').upsert({
          user_id: user.id,
          credits: currencies.credits || 0,
          cosmos: currencies.cosmos || 0,
          experience: currencies.experience || 0,
          honor: currencies.honor || 0,
          skill_points_current: currencies.skillPointsCurrent || 0,
          skill_points_total: currencies.skillPointsTotal || 0,
          updated_at: new Date().toISOString()
        })
      )
    }

    // Update quest progress
    if (quests && Array.isArray(quests)) {
      const questUpdates = quests.map((quest: any) =>
        supabaseClient.from('quest_progress').upsert({
          user_id: user.id,
          quest_id: quest.questId || quest.id,
          objectives: quest.objectives || [],
          is_completed: quest.isCompleted || false,
          completed_at: quest.completedAt || null
        })
      )
      updates.push(...questUpdates)
    }

    // Execute all updates
    const results = await Promise.all(updates)
    const errors = results.filter(result => result.error)

    if (errors.length > 0) {
      throw new Error(`Update failed: ${errors[0].error.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Game data saved successfully',
        updatedTables: updates.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
