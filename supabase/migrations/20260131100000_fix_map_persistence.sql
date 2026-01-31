-- Migration: Fix map persistence
-- Description: Adds last_map_id to user_profiles and updates RPCs to save/load it correctly

-- 1. Aggiungi la colonna last_map_id alla tabella user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS last_map_id VARCHAR(50) DEFAULT 'palantir';

-- 2. Aggiorna la funzione di caricamento dati per includere last_map_id
DROP FUNCTION IF EXISTS public.get_player_complete_data_secure(UUID);
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
  last_x DOUBLE PRECISION,
  last_y DOUBLE PRECISION,
  last_rotation DOUBLE PRECISION,
  last_map_id VARCHAR(50) -- NUOVA COLONNA
) AS $$
DECLARE
  result_record RECORD;
BEGIN
  -- Carica i dati unendo profilo, currencies e upgrades
  SELECT
    up.auth_id,
    up.player_id,
    up.username,
    COALESCE(up.is_administrator, FALSE) as is_administrator,
    TRUE as found,
    up.last_x,
    up.last_y,
    up.last_rotation,
    COALESCE(up.last_map_id, 'palantir') as last_map_id, -- CARICA MAP ID
    CASE WHEN pc.auth_id IS NOT NULL THEN
      jsonb_build_object(
        'credits', COALESCE(pc.credits, 1000),
        'cosmos', COALESCE(pc.cosmos, 100),
        'experience', COALESCE(pc.experience, 0),
        'honor', COALESCE(pc.honor, 0),
        'current_health', COALESCE(pc.current_health, 127000),
        'current_shield', COALESCE(pc.current_shield, 53000)
      )::text
    ELSE
      jsonb_build_object(
        'credits', 1000,
        'cosmos', 100,
        'experience', 0,
        'honor', 0,
        'current_health', 127000,
        'current_shield', 53000
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

  -- Se il profilo non esiste, restituisci valori di default
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::BIGINT,
      NULL::VARCHAR(50),
      FALSE::BOOLEAN,
      FALSE, -- found = FALSE
      '{"credits": 1000, "cosmos": 100, "experience": 0, "honor": 0, "current_health": 127000, "current_shield": 53000}',
      '{"hpUpgrades": 0, "shieldUpgrades": 0, "speedUpgrades": 0, "damageUpgrades": 0}',
      '[]',
      200::DOUBLE PRECISION,
      200::DOUBLE PRECISION,
      0::DOUBLE PRECISION,
      'palantir'::VARCHAR(50); -- DEFAULT MAP
  ELSE
    RETURN QUERY SELECT
      result_record.auth_id,
      result_record.player_id,
      result_record.username,
      result_record.is_administrator,
      result_record.found,
      result_record.currencies_data,
      result_record.upgrades_data,
      result_record.quests_data,
      result_record.last_x,
      result_record.last_y,
      result_record.last_rotation,
      result_record.last_map_id; -- RETURN LOADED MAP
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Aggiorna la funzione di salvataggio per salvare last_map_id
DROP FUNCTION IF EXISTS public.update_player_data_secure(UUID, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB);
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
    INSERT INTO public.player_currencies (
      auth_id, credits, cosmos, experience, honor, current_health, current_shield
    ) VALUES (
      auth_id_param,
      (currencies_data->>'credits')::BIGINT,
      (currencies_data->>'cosmos')::BIGINT,
      (currencies_data->>'experience')::BIGINT,
      (currencies_data->>'honor')::INTEGER,
      (currencies_data->>'current_health')::INTEGER,
      (currencies_data->>'current_shield')::INTEGER
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

  -- Update position AND MAP if provided
  IF position_data IS NOT NULL THEN
    UPDATE public.user_profiles
    SET 
      last_x = (position_data->>'x')::DOUBLE PRECISION,
      last_y = (position_data->>'y')::DOUBLE PRECISION,
      last_rotation = (position_data->>'rotation')::DOUBLE PRECISION,
      last_map_id = COALESCE((position_data->>'map_id')::VARCHAR(50), last_map_id), -- SAVE MAP ID
      updated_at = NOW()
    WHERE auth_id = auth_id_param;
  END IF;

  -- Update profile data if provided (e.g., is_administrator)
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

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION public.get_player_complete_data_secure(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_player_data_secure(UUID, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB) TO service_role;
