-- Fix create_player_profile function overload conflict
-- Drop the old simple version and keep only the enhanced version with parameters

-- Drop the old function signature to resolve overload conflict
DROP FUNCTION IF EXISTS public.create_player_profile(UUID, VARCHAR(50));

-- Grant execute permission only for the enhanced version
GRANT EXECUTE ON FUNCTION public.create_player_profile(UUID, VARCHAR(50), INTEGER, INTEGER, BIGINT, BIGINT) TO service_role;