-- Fix create_player_profile function ambiguity
-- This migration drops the old enhanced version that conflicts with the simple version used by the server

-- Drop the old function signature with 6 parameters to resolve overload conflict
DROP FUNCTION IF EXISTS public.create_player_profile(UUID, VARCHAR, INTEGER, INTEGER, BIGINT, BIGINT);

-- Grant permissions to the one remained (simple version with 2 parameters)
GRANT EXECUTE ON FUNCTION public.create_player_profile(UUID, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_player_profile(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_player_profile(UUID, VARCHAR) TO anon;
