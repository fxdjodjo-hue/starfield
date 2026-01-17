-- Fix: Allow NULL values for current_health and current_shield in update_player_data_secure
-- This ensures that when health/shield are full, they are properly saved as NULL instead of keeping old values

CREATE OR REPLACE FUNCTION update_player_data_secure(
  auth_id_param UUID,
  stats_data JSONB DEFAULT NULL,
  upgrades_data JSONB DEFAULT NULL,
  currencies_data JSONB DEFAULT NULL,
  quests_data JSONB DEFAULT NULL,
  profile_data JSONB DEFAULT NULL
)
RETURNS BOOLEAN
AS $$
BEGIN
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

  -- Update currencies if provided (CRITICAL FIX: allow NULL values for current_health/current_shield)
  IF currencies_data IS NOT NULL THEN
    INSERT INTO public.player_currencies (
      auth_id, credits, cosmos, experience, honor, skill_points, skill_points_total,
      current_health, current_shield
    ) VALUES (
      auth_id_param,
      (currencies_data->>'credits')::BIGINT,
      (currencies_data->>'cosmos')::BIGINT,
      (currencies_data->>'experience')::BIGINT,
      (currencies_data->>'honor')::INTEGER,
      (currencies_data->>'skill_points')::BIGINT,
      (currencies_data->>'skill_points_total')::BIGINT,
      CASE
        WHEN currencies_data->>'current_health' IS NULL OR currencies_data->>'current_health' = 'null' THEN NULL
        ELSE (currencies_data->>'current_health')::INTEGER
      END,
      CASE
        WHEN currencies_data->>'current_shield' IS NULL OR currencies_data->>'current_shield' = 'null' THEN NULL
        ELSE (currencies_data->>'current_shield')::INTEGER
      END
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      credits = EXCLUDED.credits,
      cosmos = EXCLUDED.cosmos,
      experience = EXCLUDED.experience,
      honor = EXCLUDED.honor,
      skill_points = EXCLUDED.skill_points,
      skill_points_total = EXCLUDED.skill_points_total,
      -- CRITICAL FIX: Set to EXCLUDED value directly, allowing NULL values
      current_health = EXCLUDED.current_health,
      current_shield = EXCLUDED.current_shield,
      updated_at = NOW();
  END IF;

  IF quests_data IS NOT NULL THEN
    INSERT INTO public.quest_progress (
      auth_id, quest_data
    ) VALUES (
      auth_id_param,
      quests_data
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      quest_data = EXCLUDED.quest_data,
      updated_at = NOW();
  END IF;

  IF profile_data IS NOT NULL THEN
    UPDATE public.user_profiles
    SET
      username = COALESCE(profile_data->>'username', username),
      updated_at = NOW()
    WHERE auth_id = auth_id_param;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION update_player_data_secure(UUID, JSONB, JSONB, JSONB, JSONB, JSONB) TO service_role;