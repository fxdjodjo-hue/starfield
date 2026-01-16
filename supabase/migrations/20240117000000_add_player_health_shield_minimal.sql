-- MINIMAL VERSION: Only adds columns to player_currencies
-- This is the absolute minimum needed - just adds the columns
-- The functions will be updated separately if needed

ALTER TABLE public.player_currencies 
ADD COLUMN IF NOT EXISTS current_health INTEGER,
ADD COLUMN IF NOT EXISTS current_shield INTEGER;
