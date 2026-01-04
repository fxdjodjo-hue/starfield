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

    // Get request body
    const { sessionId, sessionData } = await req.json()

    if (!sessionId) {
      throw new Error('Session ID is required')
    }

    // Get current user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('User not authenticated')
    }

    // Get session data
    const { data: session, error: sessionError } = await supabaseClient
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      throw new Error('Session not found or access denied')
    }

    // Calculate session duration
    const endTime = new Date().toISOString()
    const startTime = new Date(session.start_time)
    const duration = Math.floor((new Date(endTime).getTime() - startTime.getTime()) / 1000)

    // Prepare update data
    const updateData = {
      end_time: endTime,
      duration,
      completed: true,
      ...sessionData
    }

    // Update session
    const { data: updatedSession, error: updateError } = await supabaseClient
      .from('game_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    // Update player stats
    const { data: currentStats, error: statsError } = await supabaseClient
      .from('player_stats')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (statsError) {
      throw statsError
    }

    // Calculate new stats
    const newStats = {
      total_playtime: (currentStats.total_playtime || 0) + duration,
      games_played: (currentStats.games_played || 0) + 1,
      experience: (currentStats.experience || 0) + (sessionData.experience_gained || 0),
      credits: (currentStats.credits || 0) + (sessionData.credits_earned || 0),
      enemies_killed: (currentStats.enemies_killed || 0) + (sessionData.enemies_killed || 0),
      updated_at: new Date().toISOString()
    }

    // Check for level up
    const experienceNeeded = (currentStats.level || 1) * 1000 // Simple leveling formula
    if (newStats.experience >= experienceNeeded) {
      newStats.level = (currentStats.level || 1) + 1
    }

    // Update player stats
    const { error: updateStatsError } = await supabaseClient
      .from('player_stats')
      .update(newStats)
      .eq('user_id', user.id)

    if (updateStatsError) {
      throw updateStatsError
    }

    // Check for achievements
    await checkAchievements(supabaseClient, user.id, newStats)

    return new Response(
      JSON.stringify({
        success: true,
        session: updatedSession,
        stats: newStats
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

// Helper function to check and unlock achievements
async function checkAchievements(supabaseClient: any, userId: string, stats: any) {
  const achievements = []

  // First game achievement
  if (stats.games_played === 1) {
    achievements.push({
      achievement_id: 'first_game',
      achievement_name: 'First Flight',
      description: 'Complete your first game session',
      rarity: 'common',
      points: 10
    })
  }

  // Level up achievement
  if (stats.level > 1) {
    achievements.push({
      achievement_id: `level_${stats.level}`,
      achievement_name: `Level ${stats.level}`,
      description: `Reach level ${stats.level}`,
      rarity: 'rare',
      points: stats.level * 5
    })
  }

  // Killer achievement
  if (stats.enemies_killed >= 10 && stats.enemies_killed % 10 === 0) {
    achievements.push({
      achievement_id: `killer_${stats.enemies_killed}`,
      achievement_name: 'Star Destroyer',
      description: `Destroy ${stats.enemies_killed} enemies`,
      rarity: 'epic',
      points: Math.floor(stats.enemies_killed / 10) * 20
    })
  }

  // Insert achievements
  for (const achievement of achievements) {
    try {
      await supabaseClient
        .from('user_achievements')
        .insert({
          user_id: userId,
          ...achievement
        })
    } catch (error) {
      // Achievement might already exist, ignore error
      console.log('Achievement already unlocked:', achievement.achievement_id)
    }
  }
}
