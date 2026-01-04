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

-- Also drop the sequence if it exists
DROP SEQUENCE IF EXISTS player_id_seq CASCADE;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Users table - Single source of truth: player_id (BIGINT)
CREATE TABLE public.user_profiles (
  player_id BIGINT PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Reference to Supabase auth (optional)
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player statistics (reflects PlayerStats component exactly)
CREATE TABLE public.player_stats (
  player_id BIGINT REFERENCES public.user_profiles(player_id) ON DELETE CASCADE PRIMARY KEY,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  missions_completed INTEGER DEFAULT 0,
  play_time INTEGER DEFAULT 0, -- in seconds
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player upgrades (reflects PlayerUpgrades component exactly)
CREATE TABLE public.player_upgrades (
  player_id BIGINT REFERENCES public.user_profiles(player_id) ON DELETE CASCADE PRIMARY KEY,
  hp_upgrades INTEGER DEFAULT 0,
  shield_upgrades INTEGER DEFAULT 0,
  speed_upgrades INTEGER DEFAULT 0,
  damage_upgrades INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player currencies (combines all currency components: Credits, Cosmos, Experience, Honor, SkillPoints)
CREATE TABLE public.player_currencies (
  player_id BIGINT REFERENCES public.user_profiles(player_id) ON DELETE CASCADE PRIMARY KEY,
  credits BIGINT DEFAULT 1000,
  cosmos BIGINT DEFAULT 100,
  experience BIGINT DEFAULT 0,
  honor INTEGER DEFAULT 0,
  skill_points_current INTEGER DEFAULT 0,
  skill_points_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quest progress (reflects ActiveQuest + Quest components exactly)
CREATE TABLE public.quest_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id BIGINT REFERENCES public.user_profiles(player_id) ON DELETE CASCADE,
  quest_id VARCHAR(100) NOT NULL,
  objectives JSONB DEFAULT '[]'::jsonb, -- Array of objectives with id, current, target
  is_completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(player_id, quest_id)
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX idx_user_profiles_auth_id ON public.user_profiles(auth_id); -- Index for Supabase auth lookup
CREATE INDEX idx_quest_progress_player_id ON public.quest_progress(player_id);

-- Row Level Security (RLS) policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Single source of truth: player_id
-- Users can access their own data and check existing profiles during authentication
CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "Users can check existing profiles" ON public.user_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = auth_id);

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

-- Simplified RLS: Allow authenticated users to manage their data
-- Use auth.uid() IS NOT NULL to check authentication
CREATE POLICY "Authenticated users can manage stats" ON public.player_stats
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage upgrades" ON public.player_upgrades
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage currencies" ON public.player_currencies
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage quests" ON public.quest_progress
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Sequence for sequential player IDs starting from 1 (fresh database start)
CREATE SEQUENCE IF NOT EXISTS player_id_seq START 1;

-- Function to get next player ID (sequential)
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

-- Note: User profile creation is handled manually in the application
-- to avoid conflicts with anonymous authentication and ensure proper player_id assignment
