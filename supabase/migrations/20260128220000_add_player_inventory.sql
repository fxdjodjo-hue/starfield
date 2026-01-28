-- Migration: Add player inventory persistence
-- Description: Creates player_inventory table and updates get_player_complete_data_secure

-- 1. Ricrea la tabella player_inventory (drop se esiste per ripulire schema errato)
-- NOTA: Se la tabella ha già dati, questo li cancellerà. Assicurarsi di aver fatto backup se necessario.
DROP TABLE IF EXISTS public.player_inventory CASCADE;

CREATE TABLE public.player_inventory (
  auth_id UUID REFERENCES public.user_profiles(auth_id) ON DELETE CASCADE,
  instance_id VARCHAR(50) NOT NULL,
  item_id VARCHAR(100) NOT NULL,
  slot VARCHAR(50), -- NULL se non equipaggiato, altrimenti 'HULL', 'SHIELD', etc.
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (auth_id, instance_id)
);

CREATE INDEX idx_player_inventory_auth_id ON public.player_inventory(auth_id);

-- 2. RLS Policies per player_inventory
ALTER TABLE public.player_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own inventory" ON public.player_inventory
  FOR ALL USING (player_inventory.auth_id = auth.uid());

CREATE POLICY "Service role can manage all inventory" ON public.player_inventory
  FOR ALL USING (auth.role() = 'service_role');

-- 🛡️ CRITICAL FIX: Permessi espliciti per il service role
GRANT ALL ON TABLE public.player_inventory TO service_role;
GRANT ALL ON TABLE public.player_inventory TO postgres;
GRANT ALL ON TABLE public.player_inventory TO authenticated;
GRANT ALL ON TABLE public.player_inventory TO anon;


-- 3. Aggiorna get_player_complete_data_secure per includere items_data
CREATE OR REPLACE FUNCTION get_player_complete_data_secure(auth_id_param UUID)
RETURNS TABLE(
  auth_id UUID,
  player_id BIGINT,
  username VARCHAR(50),
  is_administrator BOOLEAN,
  found BOOLEAN,
  currencies_data TEXT,
  upgrades_data TEXT,
  quests_data TEXT,
  current_rank_name VARCHAR,
  last_x DOUBLE PRECISION,
  last_y DOUBLE PRECISION,
  last_rotation DOUBLE PRECISION,
  items_data TEXT
) AS $$
DECLARE
  v_total_players BIGINT;
  v_player_pos BIGINT;
  v_auth_id UUID;
  v_player_id BIGINT;
  v_username VARCHAR(50);
  v_is_administrator BOOLEAN;
  v_currencies_data TEXT;
  v_upgrades_data TEXT;
  v_quests_data TEXT;
  v_items_data TEXT;
  v_last_x DOUBLE PRECISION;
  v_last_y DOUBLE PRECISION;
  v_last_rotation DOUBLE PRECISION;
BEGIN
  -- Context for ranking
  SELECT COUNT(*) INTO v_total_players FROM public.user_profiles up WHERE COALESCE(up.is_administrator, FALSE) = FALSE;
  SELECT sub.pos INTO v_player_pos FROM (SELECT up_inner.auth_id as inner_auth_id, ROW_NUMBER() OVER (ORDER BY COALESCE(pc_inner.honor, 0) DESC, up_inner.auth_id ASC) as pos FROM public.user_profiles up_inner LEFT JOIN public.player_currencies pc_inner ON up_inner.auth_id = pc_inner.auth_id WHERE COALESCE(up_inner.is_administrator, FALSE) = FALSE) sub WHERE sub.inner_auth_id = auth_id_param;

  -- Data retrieval
  SELECT
    up.auth_id,
    up.player_id,
    up.username,
    COALESCE(up.is_administrator, FALSE),
    up.last_x,
    up.last_y,
    up.last_rotation,
    jsonb_build_object(
      'credits', COALESCE(pc.credits, 10000), 
      'cosmos', COALESCE(pc.cosmos, 5000), 
      'experience', COALESCE(pc.experience, 0), 
      'honor', COALESCE(pc.honor, 0), 
      'current_health', COALESCE(pc.current_health, 10000), 
      'current_shield', COALESCE(pc.current_shield, 5000)
    )::text,
    jsonb_build_object(
      'hpUpgrades', COALESCE(pu.hp_upgrades, 0), 
      'shieldUpgrades', COALESCE(pu.shield_upgrades, 0), 
      'speedUpgrades', COALESCE(pu.speed_upgrades, 0), 
      'damageUpgrades', COALESCE(pu.damage_upgrades, 0), 
      'missileDamageUpgrades', COALESCE(pu.missile_damage_upgrades, 0)
    )::text,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('quest_id', qp.quest_id, 'objectives', qp.objectives, 'is_completed', qp.is_completed, 'started_at', qp.started_at, 'completed_at', qp.completed_at))::text FROM public.quest_progress qp WHERE qp.auth_id = auth_id_param), '[]'),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', pi.item_id, 'instanceId', pi.instance_id, 'slot', pi.slot, 'acquiredAt', pi.acquired_at))::text FROM public.player_inventory pi WHERE pi.auth_id = auth_id_param), '[]')
  INTO v_auth_id, v_player_id, v_username, v_is_administrator, v_last_x, v_last_y, v_last_rotation, v_currencies_data, v_upgrades_data, v_quests_data, v_items_data
  FROM public.user_profiles up
  LEFT JOIN public.player_currencies pc ON up.auth_id = pc.auth_id
  LEFT JOIN public.player_upgrades pu ON up.auth_id = pu.auth_id
  WHERE up.auth_id = auth_id_param;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::BIGINT, NULL::VARCHAR(50), FALSE::BOOLEAN, FALSE, 
      '{"credits": 10000, "cosmos": 5000, "experience": 0, "honor": 0, "current_health": 10000, "current_shield": 5000}'::TEXT, 
      '{"hpUpgrades": 0, "shieldUpgrades": 0, "speedUpgrades": 0, "damageUpgrades": 0, "missileDamageUpgrades": 0}'::TEXT, 
      '[]', 'Basic Space Pilot'::VARCHAR, 200::DOUBLE PRECISION, 200::DOUBLE PRECISION, 0::DOUBLE PRECISION, '[]'::TEXT;
  ELSE
    RETURN QUERY SELECT 
      v_auth_id, v_player_id, v_username, v_is_administrator, TRUE, 
      v_currencies_data, v_upgrades_data, v_quests_data, 
      CASE WHEN v_is_administrator THEN 'Administrator'::VARCHAR ELSE get_rank_name(v_player_pos, v_total_players) END,
      v_last_x, v_last_y, v_last_rotation, v_items_data;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_player_complete_data_secure(UUID) TO service_role;
