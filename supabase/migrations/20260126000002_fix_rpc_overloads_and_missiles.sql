-- FINAL ULTIMATE Migration: Fix RPC Overloads & Support Missile Upgrades
-- This script CLEANLY DROPS all previous versions to avoid signature mismatches.

-- 1. Ensure missile column exists
ALTER TABLE public.player_upgrades ADD COLUMN IF NOT EXISTS missile_damage_upgrades INTEGER DEFAULT 0;

-- 2. CLEANUP OLD OVERLOADS (Safety Drop)
DROP FUNCTION IF EXISTS public.update_player_data_secure(UUID, JSONB, JSONB, JSONB, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.update_player_data_secure(UUID, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.get_player_complete_data_secure(UUID);
DROP FUNCTION IF EXISTS public.get_player_data_secure(UUID);

-- 3. RECREATE get_player_data_secure
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
    )::JSONB as profile_data,
    CASE WHEN ps.auth_id IS NOT NULL THEN
      jsonb_build_object(
        'kills', ps.kills,
        'deaths', ps.deaths,
        'missions_completed', ps.missions_completed,
        'play_time', ps.play_time
      )
    ELSE NULL END::JSONB as stats_data,
    CASE WHEN pu.auth_id IS NOT NULL THEN
      jsonb_build_object(
        'hp_upgrades', pu.hp_upgrades,
        'shield_upgrades', pu.shield_upgrades,
        'speed_upgrades', pu.speed_upgrades,
        'damage_upgrades', pu.damage_upgrades,
        'missile_damage_upgrades', pu.missile_damage_upgrades
      )
    ELSE NULL END::JSONB as upgrades_data,
    CASE WHEN pc.auth_id IS NOT NULL THEN
      jsonb_build_object(
        'credits', pc.credits,
        'cosmos', pc.cosmos,
        'experience', pc.experience,
        'honor', pc.honor,
        'current_health', pc.current_health,
        'current_shield', pc.current_shield
      )
    ELSE NULL END::JSONB as currencies_data,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'quest_id', qp.quest_id,
          'objectives', qp.objectives,
          'is_completed', qp.is_completed,
          'completed_at', qp.completed_at
        )
      ) FROM public.quest_progress qp WHERE qp.auth_id = up.auth_id),
      '[]'::jsonb
    ) as quests_data
  FROM public.user_profiles up
  LEFT JOIN public.player_stats ps ON up.auth_id = ps.auth_id
  LEFT JOIN public.player_upgrades pu ON up.auth_id = pu.auth_id
  LEFT JOIN public.player_currencies pc ON up.auth_id = pc.auth_id
  WHERE up.auth_id = auth_id_param;
END;
$$ LANGUAGE plpgsql;

-- 4. RECREATE update_player_data_secure (With 7 parameters and position support)
CREATE OR REPLACE FUNCTION update_player_data_secure(
  auth_id_param UUID,
  stats_data JSONB DEFAULT NULL,
  upgrades_data JSONB DEFAULT NULL,
  currencies_data JSONB DEFAULT NULL,
  quests_data JSONB DEFAULT NULL,
  profile_data JSONB DEFAULT NULL,
  position_data JSONB DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
BEGIN
  -- Update stats
  IF stats_data IS NOT NULL THEN
    INSERT INTO public.player_stats (auth_id, kills, deaths, missions_completed, play_time)
    VALUES (auth_id_param, COALESCE((stats_data->>'kills')::INTEGER, 0), COALESCE((stats_data->>'deaths')::INTEGER, 0), COALESCE((stats_data->>'missions_completed')::INTEGER, 0), COALESCE((stats_data->>'play_time')::INTEGER, 0))
    ON CONFLICT (auth_id) DO UPDATE SET kills = EXCLUDED.kills, deaths = EXCLUDED.deaths, missions_completed = EXCLUDED.missions_completed, play_time = EXCLUDED.play_time, updated_at = NOW();
  END IF;

  -- Update upgrades (Mapping BOTH snake_case and camelCase)
  IF upgrades_data IS NOT NULL THEN
    INSERT INTO public.player_upgrades (
      auth_id, hp_upgrades, shield_upgrades, speed_upgrades, damage_upgrades, missile_damage_upgrades
    ) VALUES (
      auth_id_param,
      COALESCE((upgrades_data->>'hp_upgrades')::INTEGER, (upgrades_data->>'hpUpgrades')::INTEGER, 0),
      COALESCE((upgrades_data->>'shield_upgrades')::INTEGER, (upgrades_data->>'shieldUpgrades')::INTEGER, 0),
      COALESCE((upgrades_data->>'speed_upgrades')::INTEGER, (upgrades_data->>'speedUpgrades')::INTEGER, 0),
      COALESCE((upgrades_data->>'damage_upgrades')::INTEGER, (upgrades_data->>'damageUpgrades')::INTEGER, 0),
      COALESCE((upgrades_data->>'missile_damage_upgrades')::INTEGER, (upgrades_data->>'missileDamageUpgrades')::INTEGER, 0)
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      hp_upgrades = EXCLUDED.hp_upgrades,
      shield_upgrades = EXCLUDED.shield_upgrades,
      speed_upgrades = EXCLUDED.speed_upgrades,
      damage_upgrades = EXCLUDED.damage_upgrades,
      missile_damage_upgrades = EXCLUDED.missile_damage_upgrades,
      updated_at = NOW();
  END IF;

  -- Update currencies and current HP/Shield
  IF currencies_data IS NOT NULL THEN
    INSERT INTO public.player_currencies (auth_id, credits, cosmos, experience, honor, current_health, current_shield)
    VALUES (
      auth_id_param, 
      COALESCE((currencies_data->>'credits')::BIGINT, 0), 
      COALESCE((currencies_data->>'cosmos')::BIGINT, 0), 
      COALESCE((currencies_data->>'experience')::BIGINT, 0), 
      COALESCE((currencies_data->>'honor')::INTEGER, 0),
      COALESCE((currencies_data->>'current_health')::INTEGER, (currencies_data->>'health')::INTEGER, 10000),
      COALESCE((currencies_data->>'current_shield')::INTEGER, (currencies_data->>'shield')::INTEGER, 5000)
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      credits = EXCLUDED.credits, cosmos = EXCLUDED.cosmos, experience = EXCLUDED.experience, honor = EXCLUDED.honor,
      current_health = EXCLUDED.current_health, current_shield = EXCLUDED.current_shield, updated_at = NOW();
  END IF;

  -- Update position in profile
  IF position_data IS NOT NULL THEN
    UPDATE public.user_profiles
    SET 
      last_x = (position_data->>'x')::DOUBLE PRECISION,
      last_y = (position_data->>'y')::DOUBLE PRECISION,
      last_rotation = (position_data->>'rotation')::DOUBLE PRECISION,
      updated_at = NOW()
    WHERE auth_id = auth_id_param;
  END IF;

  -- Update administrator status if provided
  IF profile_data IS NOT NULL THEN
    UPDATE public.user_profiles SET is_administrator = COALESCE((profile_data->>'is_administrator')::BOOLEAN, is_administrator), updated_at = NOW() WHERE auth_id = auth_id_param;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 5. RECREATE get_player_complete_data_secure (Login function)
CREATE OR REPLACE FUNCTION get_player_complete_data_secure(auth_id_param UUID)
RETURNS TABLE(
  auth_id UUID,
  player_id BIGINT,
  username VARCHAR(50),
  is_administrator BOOLEAN,
  found BOOLEAN,
  currencies_data TEXT,
  upgrades_data TEXT,
  quests_data TEXT,
  current_rank_name VARCHAR,
  last_x DOUBLE PRECISION,
  last_y DOUBLE PRECISION,
  last_rotation DOUBLE PRECISION
) AS $$
DECLARE
  v_total_players BIGINT;
  v_player_pos BIGINT;
  result_record RECORD;
BEGIN
  -- Total population context
  SELECT COUNT(*) INTO v_total_players FROM public.user_profiles up WHERE COALESCE(up.is_administrator, FALSE) = FALSE;

  -- Player ranking context
  SELECT sub.pos INTO v_player_pos FROM (SELECT up_inner.auth_id as inner_auth_id, ROW_NUMBER() OVER (ORDER BY COALESCE(pc_inner.honor, 0) DESC, up_inner.auth_id ASC) as pos FROM public.user_profiles up_inner LEFT JOIN public.player_currencies pc_inner ON up_inner.auth_id = pc_inner.auth_id WHERE COALESCE(up_inner.is_administrator, FALSE) = FALSE) sub WHERE sub.inner_auth_id = auth_id_param;

  -- Consolidated retrieval
  SELECT
    up.auth_id, up.player_id, up.username, COALESCE(up.is_administrator, FALSE) as is_administrator, TRUE as found,
    up.last_x, up.last_y, up.last_rotation,
    jsonb_build_object('credits', COALESCE(pc.credits, 1000), 'cosmos', COALESCE(pc.cosmos, 100), 'experience', COALESCE(pc.experience, 0), 'honor', COALESCE(pc.honor, 0), 'current_health', COALESCE(pc.current_health, 10000), 'current_shield', COALESCE(pc.current_shield, 5000))::text as currencies_data,
    jsonb_build_object('hpUpgrades', COALESCE(pu.hp_upgrades, 0), 'shieldUpgrades', COALESCE(pu.shield_upgrades, 0), 'speedUpgrades', COALESCE(pu.speed_upgrades, 0), 'damageUpgrades', COALESCE(pu.damage_upgrades, 0), 'missileDamageUpgrades', COALESCE(pu.missile_damage_upgrades, 0))::text as upgrades_data,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('quest_id', qp.quest_id, 'objectives', qp.objectives, 'is_completed', qp.is_completed, 'started_at', qp.started_at, 'completed_at', qp.completed_at))::text FROM public.quest_progress qp WHERE qp.auth_id = up.auth_id), '[]') as quests_data
  INTO result_record
  FROM public.user_profiles up
  LEFT JOIN public.player_currencies pc ON up.auth_id = pc.auth_id
  LEFT JOIN public.player_upgrades pu ON up.auth_id = pu.auth_id
  WHERE up.auth_id = auth_id_param;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::BIGINT, NULL::VARCHAR(50), FALSE::BOOLEAN, FALSE, NULL::TEXT, NULL::TEXT, '[]', 'Basic Space Pilot'::VARCHAR, 200::DOUBLE PRECISION, 200::DOUBLE PRECISION, 0::DOUBLE PRECISION;
  ELSE
    RETURN QUERY SELECT 
      result_record.auth_id, result_record.player_id, result_record.username, result_record.is_administrator, result_record.found, 
      result_record.currencies_data, result_record.upgrades_data, result_record.quests_data, 
      CASE WHEN result_record.is_administrator THEN 'Administrator'::VARCHAR ELSE get_rank_name(v_player_pos, v_total_players) END,
      result_record.last_x, result_record.last_y, result_record.last_rotation;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION get_player_data_secure(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION update_player_data_secure(UUID, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION get_player_complete_data_secure(UUID) TO service_role;
