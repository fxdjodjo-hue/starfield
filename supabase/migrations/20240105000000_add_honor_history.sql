-- Migration: Add honor history tracking for RecentHonor calculation
-- This table tracks honor changes over time to calculate 30-day moving average

-- Honor history table - tracks honor value changes over time
CREATE TABLE IF NOT EXISTS public.honor_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID REFERENCES public.user_profiles(auth_id) ON DELETE CASCADE NOT NULL,
  honor_value INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reason VARCHAR(100) DEFAULT 'change' -- Reason for change: 'npc_kill', 'server_update', etc.
);

-- Index for efficient queries by auth_id and date
CREATE INDEX IF NOT EXISTS idx_honor_history_auth_id ON public.honor_history(auth_id);
CREATE INDEX IF NOT EXISTS idx_honor_history_recorded_at ON public.honor_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_honor_history_auth_date ON public.honor_history(auth_id, recorded_at DESC);

-- Enable Row Level Security
ALTER TABLE public.honor_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own honor history
-- Drop if exists to allow re-running migration
DROP POLICY IF EXISTS "Users can view their own honor history" ON public.honor_history;
CREATE POLICY "Users can view their own honor history"
  ON public.honor_history
  FOR SELECT
  USING (auth.uid() = auth_id);

-- RLS Policy: Service role can insert/update honor history (for server)
-- Note: Server uses service role, so it can insert for any user

-- Function to get recent honor average (30 days)
CREATE OR REPLACE FUNCTION public.get_recent_honor_average(
  p_auth_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS NUMERIC AS $$
DECLARE
  v_avg NUMERIC;
BEGIN
  SELECT COALESCE(AVG(honor_value), 0)
  INTO v_avg
  FROM public.honor_history
  WHERE auth_id = p_auth_id
    AND recorded_at >= NOW() - (p_days || ' days')::INTERVAL;
  
  RETURN COALESCE(v_avg, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to insert honor snapshot (called by server)
CREATE OR REPLACE FUNCTION public.insert_honor_snapshot(
  p_auth_id UUID,
  p_honor_value INTEGER,
  p_reason VARCHAR(100) DEFAULT 'change'
)
RETURNS VOID AS $$
BEGIN
  -- Inserisci sempre un nuovo record (non usiamo ON CONFLICT perché non c'è constraint unique)
  INSERT INTO public.honor_history (auth_id, honor_value, reason)
  VALUES (p_auth_id, p_honor_value, p_reason);
  
  -- Cleanup: Remove records older than 60 days to keep table size manageable
  DELETE FROM public.honor_history
  WHERE auth_id = p_auth_id
    AND recorded_at < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to service_role
GRANT EXECUTE ON FUNCTION public.get_recent_honor_average(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_honor_snapshot(UUID, INTEGER, VARCHAR) TO service_role;
