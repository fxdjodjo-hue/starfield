-- Starfield Game Database Schema - Single Player Data Only
-- Minimal schema reflecting exactly what the current single-player game manages

-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Users table (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player statistics (reflects PlayerStats component exactly)
CREATE TABLE public.player_stats (
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE PRIMARY KEY,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  missions_completed INTEGER DEFAULT 0,
  play_time INTEGER DEFAULT 0, -- in seconds
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player upgrades (reflects PlayerUpgrades component exactly)
CREATE TABLE public.player_upgrades (
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE PRIMARY KEY,
  hp_upgrades INTEGER DEFAULT 0,
  shield_upgrades INTEGER DEFAULT 0,
  speed_upgrades INTEGER DEFAULT 0,
  damage_upgrades INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player currencies (combines all currency components: Credits, Cosmos, Experience, Honor, SkillPoints)
CREATE TABLE public.player_currencies (
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE PRIMARY KEY,
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
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  quest_id VARCHAR(100) NOT NULL,
  objectives JSONB DEFAULT '[]'::jsonb, -- Array of objectives with id, current, target
  is_completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, quest_id)
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX idx_quest_progress_user_id ON public.quest_progress(user_id);

-- Row Level Security (RLS) policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage their stats" ON public.player_stats
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their upgrades" ON public.player_upgrades
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their currencies" ON public.player_currencies
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their quests" ON public.quest_progress
  FOR ALL USING (auth.uid() = user_id);

-- Function to create user profile on signup (creates all necessary tables)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id, username, display_name)
  VALUES (NEW.id, split_part(NEW.email, '@', 1), COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  -- Create player stats (empty)
  INSERT INTO public.player_stats (user_id) VALUES (NEW.id);

  -- Create player upgrades (empty)
  INSERT INTO public.player_upgrades (user_id) VALUES (NEW.id);

  -- Create player currencies (with defaults)
  INSERT INTO public.player_currencies (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
