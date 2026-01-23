-- Final fix for health and shield persistence
-- This migration updates the existing secure functions to correctly handle current_health and current_shield

-- 1. Update get_player_complete_data_secure to include health/shield
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
        'current_health', COALESCE(pc.current_health, 100000),
        'current_shield', COALESCE(pc.current_shield, 50000)
      )::text
    ELSE
      jsonb_build_object(
        'credits', 1000,
        'cosmos', 100,
        'experience', 0,
        'honor', 0,
        'current_health', 100000,
        'current_shield', 50000
      )::text
    END as currencies_data,
    CASE WHEN pu.auth_id IS NOT NULL THEN
      jsonb_build_object(
        'hpUpgrades', COALESCE(pu.hp_upgrades, 0),
        'shieldUpgrades', COALESCE(pu.shield_upgrades, 0),
        'speedUpgrades', COALESCE(pu.speed_upgrades, 0),
        'damageUpgrades', COALESCE(pu.damage_upgrades, 0)
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
          'quest_id', qp.quest_id,
          'objectives', qp.objectives,
          'is_completed', qp.is_completed,
          'completed_at', qp.completed_at
        )
      ) FROM public.quest_progress qp WHERE qp.auth_id = auth_id_param),
      '[]'::jsonb
    )::text as quests_data
  INTO result_record
  FROM public.user_profiles up
  LEFT JOIN public.player_currencies pc ON up.auth_id = pc.auth_id
  LEFT JOIN public.player_upgrades pu ON up.auth_id = pu.auth_id
  WHERE up.auth_id = auth_id_param;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::BIGINT, NULL::VARCHAR(50), NULL::BOOLEAN, FALSE, NULL::TEXT, NULL::TEXT, NULL::TEXT;
  ELSE
    RETURN QUERY SELECT
      result_record.auth_id, result_record.player_id, result_record.username,
      result_record.is_administrator, result_record.found,
      result_record.currencies_data, result_record.upgrades_data, result_record.quests_data;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update update_player_data_secure to include health/shield and FIX NOT NULL violation
CREATE OR REPLACE FUNCTION update_player_data_secure(
  auth_id_param UUID,
  stats_data JSONB DEFAULT NULL,
  upgrades_data JSONB DEFAULT NULL,
  currencies_data JSONB DEFAULT NULL,
  quests_data JSONB DEFAULT NULL,
  profile_data JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update stats
  IF stats_data IS NOT NULL THEN
    INSERT INTO public.player_stats (auth_id, kills, deaths)
    VALUES (auth_id_param, (stats_data->>'kills')::INTEGER, (stats_data->>'deaths')::INTEGER)
    ON CONFLICT (auth_id) DO UPDATE SET
      kills = EXCLUDED.kills,
      deaths = EXCLUDED.deaths,
      updated_at = NOW();
  END IF;

  -- Update upgrades
  IF upgrades_data IS NOT NULL THEN
    INSERT INTO public.player_upgrades (auth_id, hp_upgrades, shield_upgrades, speed_upgrades, damage_upgrades)
    VALUES (
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

  -- Update currencies (CRITICAL FIX: Includes current_health and current_shield)
  IF currencies_data IS NOT NULL THEN
    INSERT INTO public.player_currencies (
      auth_id, credits, cosmos, experience, honor, current_health, current_shield
    ) VALUES (
      auth_id_param,
      COALESCE((currencies_data->>'credits')::BIGINT, 0),
      COALESCE((currencies_data->>'cosmos')::BIGINT, 0),
      COALESCE((currencies_data->>'experience')::BIGINT, 0),
      COALESCE((currencies_data->>'honor')::INTEGER, 0),
      COALESCE((currencies_data->>'current_health')::INTEGER, 100000),
      COALESCE((currencies_data->>'current_shield')::INTEGER, 50000)
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      credits = EXCLUDED.credits,
      cosmos = EXCLUDED.cosmos,
      experience = EXCLUDED.experience,
      honor = EXCLUDED.honor,
      current_health = EXCLUDED.current_health,
      current_shield = EXCLUDED.current_shield,
      updated_at = NOW();
  END IF;

  -- Update profile
  IF profile_data IS NOT NULL THEN
    UPDATE public.user_profiles
    SET is_administrator = COALESCE((profile_data->>'is_administrator')::BOOLEAN, is_administrator),
        updated_at = NOW()
    WHERE auth_id = auth_id_param;
  END IF;

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to update player data: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT EXECUTE ON FUNCTION get_player_complete_data_secure(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION update_player_data_secure(UUID, JSONB, JSONB, JSONB, JSONB, JSONB) TO service_role;
