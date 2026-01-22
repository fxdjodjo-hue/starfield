-- Remove skill_points and skill_points_total columns from player_currencies table
-- This removes all skill points functionality from the database

-- Drop columns from player_currencies table
ALTER TABLE public.player_currencies
DROP COLUMN IF EXISTS skill_points,
DROP COLUMN IF EXISTS skill_points_total;

-- Update create_player_profile function to remove skill points parameters and logic
CREATE OR REPLACE FUNCTION create_player_profile(
  auth_id_param UUID,
  username_param VARCHAR(50),
  initial_health INTEGER DEFAULT 1000,
  initial_shield INTEGER DEFAULT 1000,
  initial_credits BIGINT DEFAULT 10000,
  initial_cosmos BIGINT DEFAULT 5000
)
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

  -- Insert currencies WITHOUT skill points
  INSERT INTO public.player_currencies (
    auth_id,
    credits,
    cosmos,
    experience,
    honor,
    current_health,
    current_shield
  )
  VALUES (
    auth_id_param,
    initial_credits,    -- from server config
    initial_cosmos,     -- from server config
    0::BIGINT,
    0::INTEGER,
    initial_health,     -- from server config
    initial_shield      -- from server config
  );

  RETURN QUERY SELECT new_player_id, TRUE, NULL::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    -- Log l'errore per debug
    RAISE WARNING 'Error in create_player_profile for auth_id %: %', auth_id_param, SQLERRM;
    RETURN QUERY SELECT NULL::BIGINT, FALSE, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION create_player_profile(UUID, VARCHAR(50)) TO service_role;
GRANT EXECUTE ON FUNCTION create_player_profile(UUID, VARCHAR(50), INTEGER, INTEGER, BIGINT, BIGINT) TO service_role;

-- Update any functions that reference skill_points in JSON operations
-- Note: Functions that extract skill_points from currencies_data will now return NULL or 0
-- This is expected behavior as skill points are being removed