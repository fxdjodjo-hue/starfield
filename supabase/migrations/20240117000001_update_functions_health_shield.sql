-- Update RPC functions to handle current_health and current_shield
-- This is safe - only updates functions, doesn't touch table data

-- Step 1: Update get_player_complete_data_secure to include health/shield in response
CREATE OR REPLACE FUNCTION get_player_complete_data_secure(auth_id_param UUID)
RETURNS TABLE(
  auth_id UUID,
  player_id BIGINT,
  username VARCHAR(50),
  is_administrator BOOLEAN,
  found BOOLEAN,
  currencies_data TEXT,
  upgrades_data TEXT,
  quests_data TEXT
) AS $$
DECLARE
  result_record RECORD;
BEGIN
  SELECT
    up.auth_id,
    up.player_id,
    up.username,
    COALESCE(up.is_administrator, FALSE) as is_administrator,
    TRUE as found,
    CASE WHEN pc.auth_id IS NOT NULL THEN
      jsonb_build_object(
        'credits', COALESCE(pc.credits, 1000),
        'cosmos', COALESCE(pc.cosmos, 100),
        'experience', COALESCE(pc.experience, 0),
        'honor', COALESCE(pc.honor, 0),
        'skill_points_current', COALESCE(pc.skill_points, 0),
        'skill_points_total', COALESCE(pc.skill_points_total, 0),
        'current_health', pc.current_health,
        'current_shield', pc.current_shield
      )::text
    ELSE
      jsonb_build_object(
        'credits', 1000,
        'cosmos', 100,
        'experience', 0,
        'honor', 0,
        'skill_points_current', 0,
        'skill_points_total', 0,
        'current_health', NULL,
        'current_shield', NULL
      )::text
    END as currencies_data,
    CASE WHEN pu.auth_id IS NOT NULL THEN
      jsonb_build_object(
        'hpUpgrades', pu.hp_upgrades,
        'shieldUpgrades', pu.shield_upgrades,
        'speedUpgrades', pu.speed_upgrades,
        'damageUpgrades', pu.damage_upgrades
      )::text
    ELSE
      jsonb_build_object(
        'hpUpgrades', 0,
        'shieldUpgrades', 0,
        'speedUpgrades', 0,
        'damageUpgrades', 0
      )::text
    END as upgrades_data,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'quest_id', qp_inner.quest_id,
          'objectives', qp_inner.objectives,
          'is_completed', qp_inner.is_completed,
          'started_at', qp_inner.started_at,
          'completed_at', qp_inner.completed_at
        )
      )::text FROM quest_progress qp_inner WHERE qp_inner.auth_id = auth_id_param),
      '[]'
    ) as quests_data
  INTO result_record
  FROM user_profiles up
  LEFT JOIN player_currencies pc ON up.auth_id = pc.auth_id
  LEFT JOIN player_upgrades pu ON up.auth_id = pu.auth_id
  WHERE up.auth_id = auth_id_param;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::BIGINT,
      NULL::VARCHAR(50),
      FALSE::BOOLEAN,
      FALSE,
      '{"credits": 1000, "cosmos": 100, "experience": 0, "honor": 0, "skill_points_current": 0, "skill_points_total": 0, "current_health": null, "current_shield": null}',
      '{"hpUpgrades": 0, "shieldUpgrades": 0, "speedUpgrades": 0, "damageUpgrades": 0}',
      '[]';
  ELSE
    RETURN QUERY SELECT
      result_record.auth_id,
      result_record.player_id,
      result_record.username,
      result_record.is_administrator,
      result_record.found,
      result_record.currencies_data,
      result_record.upgrades_data,
      result_record.quests_data;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Update update_player_data_secure to save health/shield (FIX: allow NULL values)
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

  -- Update currencies if provided (now includes health/shield)
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
      current_health = EXCLUDED.current_health,
      current_shield = EXCLUDED.current_shield,
      updated_at = NOW();
  END IF;

  IF profile_data IS NOT NULL THEN
    UPDATE public.user_profiles
    SET 
      is_administrator = COALESCE((profile_data->>'is_administrator')::BOOLEAN, is_administrator),
      updated_at = NOW()
    WHERE auth_id = auth_id_param;
  END IF;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to update player data: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
