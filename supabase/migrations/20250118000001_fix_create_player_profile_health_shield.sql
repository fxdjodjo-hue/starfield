-- Fix create_player_profile function to include current_health and current_shield columns
-- This ensures new player profiles are created with all required columns

CREATE OR REPLACE FUNCTION create_player_profile(auth_id_param UUID, username_param VARCHAR(50))
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
    skill_points_total,
    current_health,
    current_shield
  )
  VALUES (
    auth_id_param,
    10000::BIGINT,   -- credits (from config)
    5000::BIGINT,    -- cosmos (from config)
    0::BIGINT,
    0::INTEGER,
    0::BIGINT,
    0::BIGINT,
    1000,            -- current_health: from config (single source of truth)
    1000             -- current_shield: from config (single source of truth)
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