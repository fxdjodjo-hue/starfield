-- Fix get_player_data_secure and update_player_data_secure functions
-- Removing references to skill_points columns which were dropped

-- 1. Fix get_player_data_secure
CREATE OR REPLACE FUNCTION get_player_data_secure(auth_id_param UUID)
RETURNS TABLE(
  profile_data JSONB,
  stats_data JSONB,
  upgrades_data JSONB,
  currencies_data JSONB,
  quests_data JSONB
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    jsonb_build_object(
      'auth_id', up.auth_id,
      'username', up.username,
      'is_administrator', COALESCE(up.is_administrator, FALSE),
      'created_at', up.created_at
    ) as profile_data,
    CASE WHEN ps.auth_id IS NOT NULL THEN
      jsonb_build_object(
        'kills', ps.kills,
        'deaths', ps.deaths,
        'missions_completed', ps.missions_completed,
        'play_time', ps.play_time
      )
    ELSE NULL END as stats_data,
    CASE WHEN pu.auth_id IS NOT NULL THEN
      jsonb_build_object(
        'hp_upgrades', pu.hp_upgrades,
        'shield_upgrades', pu.shield_upgrades,
        'speed_upgrades', pu.speed_upgrades,
        'damage_upgrades', pu.damage_upgrades
      )
    ELSE NULL END as upgrades_data,
    CASE WHEN pc.auth_id IS NOT NULL THEN
      jsonb_build_object(
        'credits', pc.credits,
        'cosmos', pc.cosmos,
        'experience', pc.experience,
        'honor', pc.honor
        -- REMOVED: skill_points, skill_points_total
      )
    ELSE NULL END as currencies_data,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'quest_id', qp.quest_id,
          'objectives', qp.objectives,
          'is_completed', qp.is_completed,
          'completed_at', qp.completed_at
        )
      ) FILTER (WHERE qp.auth_id IS NOT NULL),
      '[]'::jsonb
    ) as quests_data
  FROM public.user_profiles up
  LEFT JOIN public.player_stats ps ON up.auth_id = ps.auth_id
  LEFT JOIN public.player_upgrades pu ON up.auth_id = pu.auth_id
  LEFT JOIN public.player_currencies pc ON up.auth_id = pc.auth_id
  LEFT JOIN public.quest_progress qp ON up.auth_id = qp.auth_id
  WHERE up.auth_id = auth_id_param
  GROUP BY up.auth_id, up.username, up.created_at,
           ps.auth_id, ps.kills, ps.deaths, ps.missions_completed, ps.play_time,
           pu.auth_id, pu.hp_upgrades, pu.shield_upgrades, pu.speed_upgrades, pu.damage_upgrades,
           pc.auth_id, pc.credits, pc.cosmos, pc.experience, pc.honor;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix update_player_data_secure
CREATE OR REPLACE FUNCTION update_player_data_secure(
  auth_id_param UUID,
  stats_data JSONB DEFAULT NULL,
  upgrades_data JSONB DEFAULT NULL,
  currencies_data JSONB DEFAULT NULL,
  quests_data JSONB DEFAULT NULL,
  profile_data JSONB DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
BEGIN
  -- Update stats if provided
  IF stats_data IS NOT NULL THEN
    INSERT INTO public.player_stats (
      auth_id, kills, deaths, missions_completed, play_time
    ) VALUES (
      auth_id_param,
      (stats_data->>'kills')::INTEGER,
      (stats_data->>'deaths')::INTEGER,
      (stats_data->>'missions_completed')::INTEGER,
      (stats_data->>'play_time')::INTEGER
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      kills = EXCLUDED.kills,
      deaths = EXCLUDED.deaths,
      missions_completed = EXCLUDED.missions_completed,
      play_time = EXCLUDED.play_time,
      updated_at = NOW();
  END IF;

  -- Update upgrades if provided
  IF upgrades_data IS NOT NULL THEN
    INSERT INTO public.player_upgrades (
      auth_id, hp_upgrades, shield_upgrades, speed_upgrades, damage_upgrades
    ) VALUES (
      auth_id_param,
      (upgrades_data->>'hp_upgrades')::INTEGER,
      (upgrades_data->>'shield_upgrades')::INTEGER,
      (upgrades_data->>'speed_upgrades')::INTEGER,
      (upgrades_data->>'damage_upgrades')::INTEGER
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      hp_upgrades = EXCLUDED.hp_upgrades,
      shield_upgrades = EXCLUDED.shield_upgrades,
      speed_upgrades = EXCLUDED.speed_upgrades,
      damage_upgrades = EXCLUDED.damage_upgrades,
      updated_at = NOW();
  END IF;

  -- Update currencies if provided
  IF currencies_data IS NOT NULL THEN
    -- Log per debug (solo in sviluppo)
    RAISE WARNING 'Updating currencies for auth_id %: credits=%, cosmos=%, experience=%, honor=%', 
      auth_id_param,
      currencies_data->>'credits',
      currencies_data->>'cosmos',
      currencies_data->>'experience',
      currencies_data->>'honor';
    
    INSERT INTO public.player_currencies (
      auth_id, credits, cosmos, experience, honor
      -- REMOVED: skill_points, skill_points_total
    ) VALUES (
      auth_id_param,
      (currencies_data->>'credits')::BIGINT,
      (currencies_data->>'cosmos')::BIGINT,
      (currencies_data->>'experience')::BIGINT,
      (currencies_data->>'honor')::INTEGER
      -- REMOVED: values for skill_points
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      credits = EXCLUDED.credits,
      cosmos = EXCLUDED.cosmos,
      experience = EXCLUDED.experience,
      honor = EXCLUDED.honor,
      -- REMOVED: updates for skill_points
      updated_at = NOW();
  END IF;

  -- Update profile data if provided (e.g., is_administrator)
  IF profile_data IS NOT NULL THEN
    UPDATE public.user_profiles
    SET 
      is_administrator = COALESCE((profile_data->>'is_administrator')::BOOLEAN, is_administrator),
      updated_at = NOW()
    WHERE auth_id = auth_id_param;
  END IF;

  -- Update quests if provided (this would need more complex logic for quest updates)
  -- For now, we'll handle quest updates separately

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to update player data: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions again just in case
GRANT EXECUTE ON FUNCTION get_player_data_secure(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION update_player_data_secure(UUID, JSONB, JSONB, JSONB, JSONB, JSONB) TO service_role;
