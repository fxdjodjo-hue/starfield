-- Starfield Game Database Schema
-- Initial migration for game backend

-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Create custom types
CREATE TYPE user_status AS ENUM ('online', 'offline', 'away');
CREATE TYPE quest_status AS ENUM ('not_started', 'in_progress', 'completed', 'failed');
CREATE TYPE achievement_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  status user_status DEFAULT 'offline',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player statistics
CREATE TABLE public.player_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  level INTEGER DEFAULT 1,
  experience BIGINT DEFAULT 0,
  credits BIGINT DEFAULT 1000,
  cosmos BIGINT DEFAULT 100,
  honor INTEGER DEFAULT 0,
  skill_points INTEGER DEFAULT 0,
  total_playtime INTEGER DEFAULT 0, -- in seconds
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  enemies_killed INTEGER DEFAULT 0,
  quests_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Game sessions
CREATE TABLE public.game_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  session_type VARCHAR(50) DEFAULT 'single_player', -- single_player, multiplayer
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration INTEGER, -- in seconds
  score BIGINT DEFAULT 0,
  enemies_killed INTEGER DEFAULT 0,
  credits_earned BIGINT DEFAULT 0,
  experience_gained BIGINT DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player inventory
CREATE TABLE public.inventory_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL, -- weapon, shield, upgrade, cosmetic
  item_id VARCHAR(100) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  quantity INTEGER DEFAULT 1,
  equipped BOOLEAN DEFAULT FALSE,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);

-- Quest progress
CREATE TABLE public.quest_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  quest_id VARCHAR(100) NOT NULL,
  status quest_status DEFAULT 'not_started',
  progress JSONB DEFAULT '{}', -- flexible progress data
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  rewards_claimed BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, quest_id)
);

-- Achievements
CREATE TABLE public.user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  achievement_id VARCHAR(100) NOT NULL,
  achievement_name VARCHAR(100) NOT NULL,
  description TEXT,
  rarity achievement_rarity DEFAULT 'common',
  points INTEGER DEFAULT 0,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Leaderboard (materialized view for performance)
CREATE TABLE public.leaderboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  username VARCHAR(50),
  display_name VARCHAR(100),
  level INTEGER,
  experience BIGINT,
  honor INTEGER,
  enemies_killed INTEGER,
  quests_completed INTEGER,
  rank INTEGER,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Friendships
CREATE TABLE public.friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, blocked
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(user_id, friend_id)
);

-- Chat messages (for future multiplayer)
CREATE TABLE public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  room_id VARCHAR(100), -- global, game_session_id, etc.
  message_type VARCHAR(20) DEFAULT 'chat', -- chat, system, emote
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX idx_player_stats_user_id ON public.player_stats(user_id);
CREATE INDEX idx_game_sessions_user_id ON public.game_sessions(user_id);
CREATE INDEX idx_inventory_user_id ON public.inventory_items(user_id);
CREATE INDEX idx_quest_progress_user_id ON public.quest_progress(user_id);
CREATE INDEX idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX idx_leaderboard_rank ON public.leaderboard(rank);
CREATE INDEX idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX idx_chat_messages_room_id ON public.chat_messages(room_id);

-- Row Level Security (RLS) policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view their own stats" ON public.player_stats
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own sessions" ON public.game_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their inventory" ON public.inventory_items
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their quests" ON public.quest_progress
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their achievements" ON public.user_achievements
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Everyone can view leaderboard" ON public.leaderboard
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their friendships" ON public.friendships
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read chat messages" ON public.chat_messages
  FOR SELECT USING (true);

CREATE POLICY "Users can send chat messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Functions for leaderboard updates
CREATE OR REPLACE FUNCTION update_leaderboard()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert leaderboard entry
  INSERT INTO public.leaderboard (user_id, username, display_name, level, experience, honor, enemies_killed, quests_completed, last_updated)
  SELECT
    up.id,
    up.username,
    up.display_name,
    ps.level,
    ps.experience,
    ps.honor,
    ps.enemies_killed,
    ps.quests_completed,
    NOW()
  FROM public.user_profiles up
  JOIN public.player_stats ps ON up.id = ps.user_id
  WHERE up.id = COALESCE(NEW.user_id, OLD.user_id)
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    level = EXCLUDED.level,
    experience = EXCLUDED.experience,
    honor = EXCLUDED.honor,
    enemies_killed = EXCLUDED.enemies_killed,
    quests_completed = EXCLUDED.quests_completed,
    last_updated = EXCLUDED.last_updated;

  -- Update ranks
  UPDATE public.leaderboard
  SET rank = sub.rank
  FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY experience DESC, honor DESC) as rank
    FROM public.leaderboard
  ) sub
  WHERE leaderboard.id = sub.id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers for leaderboard updates
CREATE TRIGGER update_leaderboard_on_stats_change
  AFTER INSERT OR UPDATE ON public.player_stats
  FOR EACH ROW EXECUTE FUNCTION update_leaderboard();

CREATE TRIGGER update_leaderboard_on_profile_change
  AFTER UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_leaderboard();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.player_stats (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
