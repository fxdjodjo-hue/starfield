-- Update get_player_complete_data_secure function to remove skill_points references
-- Since skill_points columns were removed from player_currencies table

CREATE OR REPLACE FUNCTION get_player_complete_data_secure(auth_id_param UUID)
RETURNS TABLE(
  auth_id UUID,
  player_id BIGINT,
  username VARCHAR(50),
  is_administrator BOOLEAN,
  found BOOLEAN,
  currencies_data TEXT,
  upgrades_data TEXT,
  quests_data TEXT
) AS $$
DECLARE
  result_record RECORD;
BEGIN
  -- Prima ottieni i dati base del profilo
  SELECT
    up.auth_id,
    up.player_id,
    up.username,
    COALESCE(up.is_administrator, FALSE) as is_administrator,
    TRUE as found,
    CASE WHEN pc.auth_id IS NOT NULL THEN
      jsonb_build_object(
        'credits', COALESCE(pc.credits, 10000),
        'cosmos', COALESCE(pc.cosmos, 5000),
        'experience', COALESCE(pc.experience, 0),
        'honor', COALESCE(pc.honor, 0),
        'current_health', COALESCE(pc.current_health, 10000),
        'current_shield', COALESCE(pc.current_shield, 10000)
      )::text
    ELSE
      jsonb_build_object(
        'credits', 10000,
        'cosmos', 5000,
        'experience', 0,
        'honor', 0,
        'current_health', 10000,
        'current_shield', 10000
      )::text
    END as currencies_data,
    CASE WHEN pu.auth_id IS NOT NULL THEN
      jsonb_build_object(
        'hpUpgrades', pu.hp_upgrades,
        'shieldUpgrades', pu.shield_upgrades,
        'speedUpgrades', pu.speed_upgrades,
        'damageUpgrades', pu.damage_upgrades
      )::text
    ELSE
      jsonb_build_object(
        'hpUpgrades', 0,
        'shieldUpgrades', 0,
        'speedUpgrades', 0,
        'damageUpgrades', 0
      )::text
    END as upgrades_data,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'quest_id', qp_inner.quest_id,
          'objectives', qp_inner.objectives,
          'is_completed', qp_inner.is_completed,
          'started_at', qp_inner.started_at,
          'completed_at', qp_inner.completed_at
        )
      ) FROM quest_progress qp_inner WHERE qp_inner.auth_id = auth_id_param),
      '[]'::jsonb
    )::text as quests_data
  INTO result_record
  FROM user_profiles up
  LEFT JOIN player_currencies pc ON up.auth_id = pc.auth_id
  LEFT JOIN player_upgrades pu ON up.auth_id = pu.auth_id
  WHERE up.auth_id = auth_id_param;

  -- Se non trovato, restituisci record "not found"
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::BIGINT,
      NULL::VARCHAR(50),
      NULL::BOOLEAN,
      FALSE,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT;
  ELSE
    RETURN QUERY SELECT
      result_record.auth_id,
      result_record.player_id,
      result_record.username,
      result_record.is_administrator,
      result_record.found,
      result_record.currencies_data,
      result_record.upgrades_data,
      result_record.quests_data;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION get_player_complete_data_secure(UUID) TO service_role;