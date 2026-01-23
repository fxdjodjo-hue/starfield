-- Fix starting health, shield, credits and cosmos for new players
-- The previous defaults were set to 1000, which is too low for the current game balance.
-- This migration updates the create_player_profile function defaults.

CREATE OR REPLACE FUNCTION create_player_profile(
  auth_id_param UUID,
  username_param VARCHAR(50),
  initial_health INTEGER DEFAULT 100000, -- Base health from config
  initial_shield INTEGER DEFAULT 50000,   -- Base shield from config
  initial_credits BIGINT DEFAULT 1000,    -- Starting credits from server config
  initial_cosmos BIGINT DEFAULT 100       -- Starting cosmos from server config
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
    initial_credits,
    initial_cosmos,
    0::BIGINT,
    0::INTEGER,
    initial_health,
    initial_shield
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

-- OPTIONAL: Update existing players who have exactly 1000 HP and 1000 Shield
-- and likely just registered with the old/buggy defaults.
-- We only do this for players who haven't made significant progress (e.g. 0 experience)
UPDATE public.player_currencies
SET 
  current_health = 100000,
  current_shield = 50000
WHERE 
  current_health = 1000 
  AND current_shield = 1000 
  AND experience = 0;
