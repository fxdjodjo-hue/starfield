-- Migration: Align Starting Resources and Defaults with player-config.json
-- Aligns Credits to 10,000 and Cosmos to 5,000 for new players.

-- 1. Update Table Defaults (for direct inserts)
ALTER TABLE public.player_currencies ALTER COLUMN credits SET DEFAULT 10000;
ALTER TABLE public.player_currencies ALTER COLUMN cosmos SET DEFAULT 5000;

-- 2. Update create_player_profile (Initial account creation)
CREATE OR REPLACE FUNCTION create_player_profile(auth_id_param UUID, username_param VARCHAR(50))
RETURNS TABLE(
  player_id BIGINT,
  success BOOLEAN,
  error_message TEXT
)
SECURITY DEFINER
AS $$
DECLARE
  new_player_id BIGINT;
BEGIN
  -- Check if profile already exists
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE auth_id = auth_id_param) THEN
    RETURN QUERY SELECT NULL::BIGINT, FALSE, 'Profile already exists'::TEXT;
    RETURN;
  END IF;

  -- Get next display ID
  SELECT nextval('player_id_seq') INTO new_player_id;

  -- Create profile
  INSERT INTO public.user_profiles (auth_id, player_id, username)
  VALUES (auth_id_param, new_player_id, username_param);

  -- Create default stats
  INSERT INTO public.player_stats (auth_id, kills, deaths, missions_completed, play_time)
  VALUES (auth_id_param, 0, 0, 0, 0);
  
  -- Create default upgrades
  INSERT INTO public.player_upgrades (auth_id, hp_upgrades, shield_upgrades, speed_upgrades, damage_upgrades, missile_damage_upgrades)
  VALUES (auth_id_param, 0, 0, 0, 0, 0);
  
  -- Create default currencies (Aligned with player-config.json)
  INSERT INTO public.player_currencies (auth_id, credits, cosmos, experience, honor, current_health, current_shield)
  VALUES (auth_id_param, 10000::BIGINT, 5000::BIGINT, 0::BIGINT, 0::INTEGER, 10000, 5000);

  RETURN QUERY SELECT new_player_id, TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 3. Update get_player_complete_data_secure (Login/Welcome defaults)
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
  -- Context
  SELECT COUNT(*) INTO v_total_players FROM public.user_profiles up WHERE COALESCE(up.is_administrator, FALSE) = FALSE;
  SELECT sub.pos INTO v_player_pos FROM (SELECT up_inner.auth_id as inner_auth_id, ROW_NUMBER() OVER (ORDER BY COALESCE(pc_inner.honor, 0) DESC, up_inner.auth_id ASC) as pos FROM public.user_profiles up_inner LEFT JOIN public.player_currencies pc_inner ON up_inner.auth_id = pc_inner.auth_id WHERE COALESCE(up_inner.is_administrator, FALSE) = FALSE) sub WHERE sub.inner_auth_id = auth_id_param;

  -- Data retrieval
  SELECT
    up.auth_id, up.player_id, up.username, COALESCE(up.is_administrator, FALSE) as is_administrator, TRUE as found,
    up.last_x, up.last_y, up.last_rotation,
    jsonb_build_object(
      'credits', COALESCE(pc.credits, 10000), 
      'cosmos', COALESCE(pc.cosmos, 5000), 
      'experience', COALESCE(pc.experience, 0), 
      'honor', COALESCE(pc.honor, 0), 
      'current_health', COALESCE(pc.current_health, 10000), 
      'current_shield', COALESCE(pc.current_shield, 5000)
    )::text as currencies_data,
    jsonb_build_object(
      'hpUpgrades', COALESCE(pu.hp_upgrades, 0), 
      'shieldUpgrades', COALESCE(pu.shield_upgrades, 0), 
      'speedUpgrades', COALESCE(pu.speed_upgrades, 0), 
      'damageUpgrades', COALESCE(pu.damage_upgrades, 0), 
      'missileDamageUpgrades', COALESCE(pu.missile_damage_upgrades, 0)
    )::text as upgrades_data,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('quest_id', qp.quest_id, 'objectives', qp.objectives, 'is_completed', qp.is_completed, 'started_at', qp.started_at, 'completed_at', qp.completed_at))::text FROM public.quest_progress qp WHERE qp.auth_id = up.auth_id), '[]') as quests_data
  INTO result_record
  FROM public.user_profiles up
  LEFT JOIN public.player_currencies pc ON up.auth_id = pc.auth_id
  LEFT JOIN public.player_upgrades pu ON up.auth_id = pu.auth_id
  WHERE up.auth_id = auth_id_param;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::BIGINT, NULL::VARCHAR(50), FALSE::BOOLEAN, FALSE, 
      '{"credits": 10000, "cosmos": 5000, "experience": 0, "honor": 0, "current_health": 10000, "current_shield": 5000}'::TEXT, 
      '{"hpUpgrades": 0, "shieldUpgrades": 0, "speedUpgrades": 0, "damageUpgrades": 0, "missileDamageUpgrades": 0}'::TEXT, 
      '[]', 'Basic Space Pilot'::VARCHAR, 200::DOUBLE PRECISION, 200::DOUBLE PRECISION, 0::DOUBLE PRECISION;
  ELSE
    RETURN QUERY SELECT 
      result_record.auth_id, result_record.player_id, result_record.username, result_record.is_administrator, result_record.found, 
      result_record.currencies_data, result_record.upgrades_data, result_record.quests_data, 
      CASE WHEN result_record.is_administrator THEN 'Administrator'::VARCHAR ELSE get_rank_name(v_player_pos, v_total_players) END,
      result_record.last_x, result_record.last_y, result_record.last_rotation;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
