-- Starfield Game Database Schema - Single Player Data Only

-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ============================================================================
-- MIGRATION CLEANUP: Drop existing tables before recreating with new schema
-- WARNING: This will delete all existing game data!
-- ============================================================================
DROP TABLE IF EXISTS public.quest_progress CASCADE;
DROP TABLE IF EXISTS public.player_currencies CASCADE;
DROP TABLE IF EXISTS public.player_upgrades CASCADE;
DROP TABLE IF EXISTS public.player_stats CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Users table - auth_id primary key, player_id for display
CREATE TABLE public.user_profiles (
  auth_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Supabase Auth ID
  player_id BIGINT UNIQUE NOT NULL, -- Display ID (sequential numeric)
  username VARCHAR(50) UNIQUE NOT NULL,
  is_administrator BOOLEAN NOT NULL DEFAULT FALSE, -- Admin status
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player statistics (reflects PlayerStats component exactly)
CREATE TABLE public.player_stats (
  auth_id UUID REFERENCES public.user_profiles(auth_id) ON DELETE CASCADE PRIMARY KEY,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  missions_completed INTEGER DEFAULT 0,
  play_time INTEGER DEFAULT 0, -- in seconds
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player upgrades (reflects PlayerUpgrades component exactly)
CREATE TABLE public.player_upgrades (
  auth_id UUID REFERENCES public.user_profiles(auth_id) ON DELETE CASCADE PRIMARY KEY,
  hp_upgrades INTEGER DEFAULT 0,
  shield_upgrades INTEGER DEFAULT 0,
  speed_upgrades INTEGER DEFAULT 0,
  damage_upgrades INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player currencies (combines all currency components: Credits, Cosmos, Experience, Honor, SkillPoints)
CREATE TABLE public.player_currencies (
  auth_id UUID REFERENCES public.user_profiles(auth_id) ON DELETE CASCADE PRIMARY KEY,
  credits BIGINT NOT NULL DEFAULT 1000,
  cosmos BIGINT NOT NULL DEFAULT 100,
  experience BIGINT NOT NULL DEFAULT 0,
  honor INTEGER NOT NULL DEFAULT 0,
  skill_points BIGINT NOT NULL DEFAULT 0,
  skill_points_total BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quest progress (reflects ActiveQuest + Quest components exactly)
CREATE TABLE public.quest_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID REFERENCES public.user_profiles(auth_id) ON DELETE CASCADE,
  quest_id VARCHAR(100) NOT NULL,
  objectives JSONB DEFAULT '[]'::jsonb, -- Array of objectives with id, current, target
  is_completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(auth_id, quest_id)
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX idx_user_profiles_auth_id ON public.user_profiles(auth_id); -- Index for Supabase auth lookup
CREATE INDEX idx_quest_progress_auth_id ON public.quest_progress(auth_id);

-- Row Level Security (RLS) policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Single source of truth: auth_id
-- Users can access their own data and check existing profiles during authentication
CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "Users can check existing profiles" ON public.user_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = auth_id);

-- Service Role Policies - Server can access all data
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role can manage stats" ON public.player_stats;
DROP POLICY IF EXISTS "Service role can manage upgrades" ON public.player_upgrades;
DROP POLICY IF EXISTS "Service role can manage currencies" ON public.player_currencies;
DROP POLICY IF EXISTS "Service role can manage quests" ON public.quest_progress;

-- Recreate policies
CREATE POLICY "Service role can manage profiles" ON public.user_profiles
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage stats" ON public.player_stats
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage upgrades" ON public.player_upgrades
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage currencies" ON public.player_currencies
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage quests" ON public.quest_progress
  FOR ALL USING (auth.role() = 'service_role');

-- =================================================================================
-- MMO SECURITY: RPC Functions for Server-Only Access
-- =================================================================================
-- Server NEVER accesses tables directly - only through secure RPC functions
-- This prevents exploits and ensures server authoritative architecture

-- =================================================================================
-- MMO SECURE RPC FUNCTIONS - Server Only Access
-- =================================================================================

-- Create player profile after user registration (called by client after Supabase auth)
DROP FUNCTION IF EXISTS create_player_profile(UUID, VARCHAR(50));

CREATE FUNCTION create_player_profile(auth_id_param UUID, username_param VARCHAR(50))
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

  -- Get next player_id (display ID)
  SELECT get_next_player_id() INTO new_player_id;

  -- Create profile with both auth_id and player_id
  INSERT INTO public.user_profiles (auth_id, player_id, username)
  VALUES (auth_id_param, new_player_id, username_param);

  -- Create default player data using auth_id
  INSERT INTO public.player_stats (auth_id, kills, deaths, missions_completed, play_time)
  VALUES (auth_id_param, 0, 0, 0, 0);
  
  INSERT INTO public.player_upgrades (auth_id, hp_upgrades, shield_upgrades, speed_upgrades, damage_upgrades)
  VALUES (auth_id_param, 0, 0, 0, 0);
  
  -- 🔴 FIX CRITICO: Imposta SEMPRE esplicitamente tutti i valori per currencies
  -- NON fare affidamento sui DEFAULT della tabella - imposta tutto esplicitamente
  INSERT INTO public.player_currencies (
    auth_id, 
    credits, 
    cosmos, 
    experience, 
    honor, 
    skill_points, 
    skill_points_total
  )
  VALUES (
    auth_id_param, 
    1000::BIGINT, 
    100::BIGINT, 
    0::BIGINT, 
    0::INTEGER, 
    0::BIGINT, 
    0::BIGINT
  );

  RETURN QUERY SELECT new_player_id, TRUE, NULL::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    -- Log l'errore per debug
    RAISE WARNING 'Error in create_player_profile for auth_id %: %', auth_id_param, SQLERRM;
    RETURN QUERY SELECT NULL::BIGINT, FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Get player profile securely (server only)
DROP FUNCTION IF EXISTS get_player_profile_secure(UUID);

CREATE FUNCTION get_player_profile_secure(auth_id_param UUID)
RETURNS TABLE(
  auth_id UUID,
  player_id BIGINT,
  username VARCHAR(50),
  found BOOLEAN
)
SECURITY DEFINER
AS $$
DECLARE
  result_record RECORD;
BEGIN
  -- Log per debug
  RAISE LOG 'RPC get_player_profile_secure called for auth_id: %', auth_id_param;

  -- Try to find existing profile
  SELECT
    up.auth_id,
    up.player_id,
    up.username
  INTO result_record
  FROM public.user_profiles up
  WHERE up.auth_id = auth_id_param;

  IF FOUND THEN
    RAISE LOG 'RPC found profile: player_id=%, username=%', result_record.player_id, result_record.username;
    RETURN QUERY SELECT result_record.auth_id, result_record.player_id, result_record.username, TRUE;
  ELSE
    RAISE LOG 'RPC profile NOT found for auth_id: %', auth_id_param;
    RETURN QUERY SELECT NULL::UUID, NULL::BIGINT, NULL::VARCHAR(50), FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Get all player data securely (server only)
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
        'honor', pc.honor,
        'skill_points', pc.skill_points,
        'skill_points_total', pc.skill_points_total
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
           pc.auth_id, pc.credits, pc.cosmos, pc.experience, pc.honor, pc.skill_points, pc.skill_points_total;
END;
$$ LANGUAGE plpgsql;

-- Update player data securely (server only)
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
      auth_id, credits, cosmos, experience, honor, skill_points, skill_points_total
    ) VALUES (
      auth_id_param,
      (currencies_data->>'credits')::BIGINT,
      (currencies_data->>'cosmos')::BIGINT,
      (currencies_data->>'experience')::BIGINT,
      (currencies_data->>'honor')::INTEGER,
      (currencies_data->>'skill_points')::BIGINT,
      (currencies_data->>'skill_points_total')::BIGINT
    )
    ON CONFLICT (auth_id) DO UPDATE SET
      credits = EXCLUDED.credits,
      cosmos = EXCLUDED.cosmos,
      experience = EXCLUDED.experience,
      honor = EXCLUDED.honor,
      skill_points = EXCLUDED.skill_points,
      skill_points_total = EXCLUDED.skill_points_total,
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

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION create_player_profile(UUID, VARCHAR(50)) TO service_role;
GRANT EXECUTE ON FUNCTION get_player_profile_secure(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_player_data_secure(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION update_player_data_secure(UUID, JSONB, JSONB, JSONB, JSONB, JSONB) TO service_role;

-- =================================================================================
-- RLS ALREADY ENABLED ABOVE - Policies created in original section
-- =================================================================================

-- Drop existing policies before creating new ones
DROP POLICY IF EXISTS "Users can insert their stats" ON public.player_stats;
DROP POLICY IF EXISTS "Users can manage their stats" ON public.player_stats;
DROP POLICY IF EXISTS "Authenticated users can manage stats" ON public.player_stats;

DROP POLICY IF EXISTS "Users can insert their upgrades" ON public.player_upgrades;
DROP POLICY IF EXISTS "Users can manage their upgrades" ON public.player_upgrades;
DROP POLICY IF EXISTS "Authenticated users can manage upgrades" ON public.player_upgrades;

DROP POLICY IF EXISTS "Users can insert their currencies" ON public.player_currencies;
DROP POLICY IF EXISTS "Users can manage their currencies" ON public.player_currencies;
DROP POLICY IF EXISTS "Authenticated users can manage currencies" ON public.player_currencies;

DROP POLICY IF EXISTS "Users can insert their quests" ON public.quest_progress;
DROP POLICY IF EXISTS "Users can manage their quests" ON public.quest_progress;
DROP POLICY IF EXISTS "Authenticated users can manage quests" ON public.quest_progress;

-- RLS Policies: Users can only access their own data
-- auth_id is the primary key, auth.uid() should match it
CREATE POLICY "Users can manage their stats" ON public.player_stats
  FOR ALL USING (auth_id = auth.uid());

CREATE POLICY "Users can manage their upgrades" ON public.player_upgrades
  FOR ALL USING (auth_id = auth.uid());

CREATE POLICY "Users can manage their currencies" ON public.player_currencies
  FOR ALL USING (auth_id = auth.uid());

CREATE POLICY "Users can manage their quests" ON public.quest_progress
  FOR ALL USING (auth_id = auth.uid());

-- Sequence for player_id (display ID)
CREATE SEQUENCE IF NOT EXISTS player_id_seq START 1;

-- Function to get next player ID (sequential display ID)
CREATE OR REPLACE FUNCTION get_next_player_id()
RETURNS BIGINT AS $$
BEGIN
  RETURN nextval('player_id_seq');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for testing (disables RLS temporarily)
CREATE OR REPLACE FUNCTION disable_rls_for_testing()
RETURNS void AS $$
BEGIN
  -- This function is called by test scripts to bypass RLS
  -- RLS should be re-enabled after testing
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- OTTIMIZZAZIONE: Singola RPC che combina profilo + dati giocatore
DROP FUNCTION IF EXISTS get_player_complete_data_secure(UUID);
CREATE FUNCTION get_player_complete_data_secure(auth_id_param UUID)
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
  -- Prima ottieni i dati base del profilo
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
        'skill_points_total', COALESCE(pc.skill_points_total, 0)
      )::text
    ELSE
      jsonb_build_object(
        'credits', 1000,
        'cosmos', 100,
        'experience', 0,
        'honor', 0,
        'skill_points_current', 0,
        'skill_points_total', 0
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
      FALSE,
      '{"credits": 1000, "cosmos": 100, "experience": 0, "honor": 0, "skill_points_current": 0, "skill_points_total": 0}',
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

-- Grant execute permissions for the new function
GRANT EXECUTE ON FUNCTION get_player_complete_data_secure(UUID) TO service_role;

-- Rimozione campo ridondante display_name dalla tabella user_profiles
-- (commentato per mantenere compatibilità con dati esistenti)
-- ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS display_name;

-- MMO SECURITY: No guest users allowed
-- Every player MUST register and create a profile before playing
-- auth_id (UUID) + player_id (BIGINT display) for complete user identification

-- FIX: Aggiorna tutti i record esistenti con NULL a valori di default
UPDATE public.player_currencies 
SET 
  credits = COALESCE(credits, 1000),
  cosmos = COALESCE(cosmos, 100),
  experience = COALESCE(experience, 0),
  honor = COALESCE(honor, 0),
  skill_points = COALESCE(skill_points, 0),
  skill_points_total = COALESCE(skill_points_total, 0)
WHERE 
  credits IS NULL 
  OR cosmos IS NULL 
  OR experience IS NULL 
  OR honor IS NULL 
  OR skill_points IS NULL 
  OR skill_points_total IS NULL;

-- =================================================================================
-- HONOR SNAPSHOTS: Tabella per calcolare media mobile honor
-- =================================================================================
CREATE TABLE IF NOT EXISTS public.honor_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID REFERENCES public.user_profiles(auth_id) ON DELETE CASCADE,
  honor_value INTEGER NOT NULL,
  reason VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_honor_snapshots_auth_id ON public.honor_snapshots(auth_id);
CREATE INDEX IF NOT EXISTS idx_honor_snapshots_created_at ON public.honor_snapshots(created_at);

ALTER TABLE public.honor_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage honor snapshots" ON public.honor_snapshots;
CREATE POLICY "Service role can manage honor snapshots" ON public.honor_snapshots
  FOR ALL USING (auth.role() = 'service_role');

-- Funzione per inserire honor snapshot
DROP FUNCTION IF EXISTS insert_honor_snapshot(UUID, INTEGER, VARCHAR);
CREATE FUNCTION insert_honor_snapshot(
  p_auth_id UUID,
  p_honor_value INTEGER,
  p_reason VARCHAR DEFAULT 'change'
)
RETURNS void
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.honor_snapshots (auth_id, honor_value, reason)
  VALUES (p_auth_id, p_honor_value, p_reason);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION insert_honor_snapshot(UUID, INTEGER, VARCHAR) TO service_role;

-- Funzione per calcolare media mobile honor ultimi N giorni
DROP FUNCTION IF EXISTS get_recent_honor_average(UUID, INTEGER);
CREATE FUNCTION get_recent_honor_average(
  p_auth_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS NUMERIC
SECURITY DEFINER
AS $$
DECLARE
  avg_honor NUMERIC;
BEGIN
  SELECT COALESCE(AVG(honor_value), 0) INTO avg_honor
  FROM public.honor_snapshots
  WHERE auth_id = p_auth_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
  
  RETURN COALESCE(avg_honor, 0);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_recent_honor_average(UUID, INTEGER) TO service_role;

-- =================================================================================
-- LEADERBOARD: Funzione per ottenere classifica giocatori
-- =================================================================================
DROP FUNCTION IF EXISTS get_leaderboard(INTEGER, VARCHAR);
CREATE FUNCTION get_leaderboard(
  p_limit INTEGER DEFAULT 100,
  p_sort_by VARCHAR DEFAULT 'ranking_points'
)
RETURNS TABLE(
  rank_position BIGINT,
  player_id BIGINT,
  username VARCHAR(50),
  experience BIGINT,
  honor INTEGER,
  recent_honor NUMERIC,
  ranking_points NUMERIC,
  kills INTEGER,
  play_time INTEGER,
  level INTEGER
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH player_ranking AS (
    SELECT
      up.player_id,
      up.username,
      COALESCE(pc.experience, 0)::BIGINT as experience,
      COALESCE(pc.honor, 0)::INTEGER as honor,
      COALESCE(
        (SELECT AVG(hs.honor_value)::NUMERIC
         FROM honor_snapshots hs
         WHERE hs.auth_id = up.auth_id
           AND hs.created_at >= NOW() - INTERVAL '30 days'),
        COALESCE(pc.honor, 0)::NUMERIC,
        0::NUMERIC
      ) as recent_honor,
      COALESCE(ps.kills, 0)::INTEGER as kills,
      COALESCE(ps.play_time, 0)::INTEGER as play_time,
      -- Calcola ranking_points: experience + (recent_honor * 2)
      (
        COALESCE(pc.experience, 0)::NUMERIC +
        (COALESCE(
          (SELECT AVG(hs.honor_value)::NUMERIC
           FROM honor_snapshots hs
           WHERE hs.auth_id = up.auth_id
             AND hs.created_at >= NOW() - INTERVAL '30 days'),
          COALESCE(pc.honor, 0)::NUMERIC,
          0::NUMERIC
        ) * 2)
      ) as ranking_points,
      -- Calcola level usando requisiti cumulativi (stessa logica del client)
      (
        CASE
          WHEN COALESCE(pc.experience, 0) >= 87975526400000000 THEN 44
          WHEN COALESCE(pc.experience, 0) >= 43987763200000000 THEN 43
          WHEN COALESCE(pc.experience, 0) >= 21993881600000000 THEN 42
          WHEN COALESCE(pc.experience, 0) >= 10996940800000000 THEN 41
          WHEN COALESCE(pc.experience, 0) >= 5498470400000000 THEN 40
          WHEN COALESCE(pc.experience, 0) >= 2749235200000000 THEN 39
          WHEN COALESCE(pc.experience, 0) >= 1374617600000000 THEN 38
          WHEN COALESCE(pc.experience, 0) >= 687308800000000 THEN 37
          WHEN COALESCE(pc.experience, 0) >= 343654400000000 THEN 36
          WHEN COALESCE(pc.experience, 0) >= 171827200000000 THEN 35
          WHEN COALESCE(pc.experience, 0) >= 85913600000000 THEN 34
          WHEN COALESCE(pc.experience, 0) >= 42956800000000 THEN 33
          WHEN COALESCE(pc.experience, 0) >= 21478400000000 THEN 32
          WHEN COALESCE(pc.experience, 0) >= 10739200000000 THEN 31
          WHEN COALESCE(pc.experience, 0) >= 5369700000000 THEN 30
          WHEN COALESCE(pc.experience, 0) >= 2685000000000 THEN 29
          WHEN COALESCE(pc.experience, 0) >= 1342496000000 THEN 28
          WHEN COALESCE(pc.experience, 0) >= 671248000000 THEN 27
          WHEN COALESCE(pc.experience, 0) >= 335621600000 THEN 26
          WHEN COALESCE(pc.experience, 0) >= 167808800000 THEN 25
          WHEN COALESCE(pc.experience, 0) >= 83902400000 THEN 24
          WHEN COALESCE(pc.experience, 0) >= 41951120000 THEN 23
          WHEN COALESCE(pc.experience, 0) >= 20973860000 THEN 22
          WHEN COALESCE(pc.experience, 0) >= 10487010000 THEN 21
          WHEN COALESCE(pc.experience, 0) >= 5243410000 THEN 20
          WHEN COALESCE(pc.experience, 0) >= 2621710000 THEN 19
          WHEN COALESCE(pc.experience, 0) >= 1310790000 THEN 18
          WHEN COALESCE(pc.experience, 0) >= 655430000 THEN 17
          WHEN COALESCE(pc.experience, 0) >= 327750000 THEN 16
          WHEN COALESCE(pc.experience, 0) >= 163910000 THEN 15
          WHEN COALESCE(pc.experience, 0) >= 81910000 THEN 14
          WHEN COALESCE(pc.experience, 0) >= 40950000 THEN 13
          WHEN COALESCE(pc.experience, 0) >= 20470000 THEN 12
          WHEN COALESCE(pc.experience, 0) >= 10230000 THEN 11
          WHEN COALESCE(pc.experience, 0) >= 5110000 THEN 10
          WHEN COALESCE(pc.experience, 0) >= 2550000 THEN 9
          WHEN COALESCE(pc.experience, 0) >= 1270000 THEN 8
          WHEN COALESCE(pc.experience, 0) >= 630000 THEN 7
          WHEN COALESCE(pc.experience, 0) >= 310000 THEN 6
          WHEN COALESCE(pc.experience, 0) >= 150000 THEN 5
          WHEN COALESCE(pc.experience, 0) >= 70000 THEN 4
          WHEN COALESCE(pc.experience, 0) >= 30000 THEN 3
          WHEN COALESCE(pc.experience, 0) >= 10000 THEN 2
          ELSE 1
        END
      )::INTEGER as level
    FROM public.user_profiles up
    LEFT JOIN public.player_currencies pc ON up.auth_id = pc.auth_id
    LEFT JOIN public.player_stats ps ON up.auth_id = ps.auth_id
    WHERE up.is_administrator = FALSE
  )
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY
        CASE p_sort_by
          WHEN 'ranking_points' THEN pr.ranking_points
          WHEN 'honor' THEN pr.honor::NUMERIC
          WHEN 'experience' THEN pr.experience::NUMERIC
          WHEN 'kills' THEN pr.kills::NUMERIC
          ELSE pr.ranking_points
        END DESC,
        pr.player_id ASC
    )::BIGINT as rank_position,
    pr.player_id,
    pr.username,
    pr.experience,
    pr.honor,
    pr.recent_honor,
    pr.ranking_points,
    pr.kills,
    pr.play_time,
    pr.level
  FROM player_ranking pr
  ORDER BY
    CASE p_sort_by
      WHEN 'ranking_points' THEN pr.ranking_points
      WHEN 'honor' THEN pr.honor::NUMERIC
      WHEN 'experience' THEN pr.experience::NUMERIC
      WHEN 'kills' THEN pr.kills::NUMERIC
      ELSE pr.ranking_points
    END DESC,
    pr.player_id ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_leaderboard(INTEGER, VARCHAR) TO service_role;
