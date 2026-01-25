-- Hybrid Ranking System Migration
-- 1. Fixed ranks for top tiers (1, 2, 3, 5, 20 players)
-- 2. Percentile ranks for lower tiers (1% to 20% bands)

-- Helper function to determine rank name based on global position and total population
CREATE OR REPLACE FUNCTION get_rank_name(p_pos BIGINT, p_total BIGINT)
RETURNS VARCHAR AS $$
DECLARE
    v_percentile NUMERIC;
BEGIN
    -- Protection against division by zero
    IF p_total = 0 THEN
        RETURN 'Basic Space Pilot';
    END IF;

    -- 1. FIXED TOP TIERS (By absolute position)
    IF p_pos = 1 THEN RETURN 'Chief General'; END IF;
    IF p_pos <= 3 THEN RETURN 'General'; END IF;
    IF p_pos <= 6 THEN RETURN 'Basic General'; END IF;
    IF p_pos <= 11 THEN RETURN 'Chief Colonel'; END IF;
    IF p_pos <= 31 THEN RETURN 'Colonel'; END IF;

    -- 2. PERCENTILE TIERS
    -- Calculate percentile (1.0 = top 1%, 100.0 = total)
    v_percentile := (p_pos::NUMERIC / p_total::NUMERIC) * 100.0;

    -- Percentile cutoffs (Cumulative)
    IF v_percentile <= 1.0 THEN RETURN 'Basic Colonel'; END IF;
    IF v_percentile <= 2.5 THEN RETURN 'Chief Major'; END IF;     -- +1.5%
    IF v_percentile <= 4.5 THEN RETURN 'Major'; END IF;           -- +2.0%
    IF v_percentile <= 7.0 THEN RETURN 'Basic Major'; END IF;     -- +2.5%
    IF v_percentile <= 10.0 THEN RETURN 'Chief Captain'; END IF;  -- +3.0%
    IF v_percentile <= 13.5 THEN RETURN 'Captain'; END IF;        -- +3.5%
    IF v_percentile <= 17.5 THEN RETURN 'Basic Captain'; END IF;  -- +4.0%
    IF v_percentile <= 22.0 THEN RETURN 'Chief Lieutenant'; END IF; -- +4.5%
    IF v_percentile <= 27.0 THEN RETURN 'Lieutenant'; END IF;     -- +5.0%
    IF v_percentile <= 33.0 THEN RETURN 'Basic Lieutenant'; END IF; -- +6.0%
    IF v_percentile <= 40.0 THEN RETURN 'Chief Sergeant'; END IF;  -- +7.0%
    IF v_percentile <= 48.0 THEN RETURN 'Sergeant'; END IF;        -- +8.0%
    IF v_percentile <= 57.0 THEN RETURN 'Basic Sergeant'; END IF;  -- +9.0%
    IF v_percentile <= 67.0 THEN RETURN 'Chief Space Pilot'; END IF; -- +10.0%
    IF v_percentile <= 79.9 THEN RETURN 'Space Pilot'; END IF;     -- +12.9%
    
    RETURN 'Basic Space Pilot'; -- Remaining 20%
END;
$$ LANGUAGE plpgsql;

-- Update get_leaderboard to use dynamic ranks
DROP FUNCTION IF EXISTS get_leaderboard(INTEGER, VARCHAR);
CREATE OR REPLACE FUNCTION get_leaderboard(
  p_limit INTEGER DEFAULT 100,
  p_sort_by VARCHAR DEFAULT 'ranking_points'
)
RETURNS TABLE(
  rank_position BIGINT,
  player_id BIGINT,
  username VARCHAR(50),
  experience BIGINT,
  honor INTEGER,
  recent_honor NUMERIC,
  ranking_points NUMERIC,
  kills INTEGER,
  play_time INTEGER,
  rank_name VARCHAR
)
SECURITY DEFINER
AS $$
DECLARE
    v_total_players BIGINT;
BEGIN
  -- Get total count of non-admin players for percentile calculation
  SELECT COUNT(*) INTO v_total_players FROM public.user_profiles up WHERE COALESCE(up.is_administrator, FALSE) = FALSE;

  RETURN QUERY
  WITH player_ranking AS (
    SELECT
      up.player_id,
      up.username,
      COALESCE(pc.experience, 0)::BIGINT as experience,
      COALESCE(pc.honor, 0)::INTEGER as honor,
      COALESCE(
        (SELECT AVG(hs.honor_value)::NUMERIC
         FROM honor_snapshots hs
         WHERE hs.auth_id = up.auth_id
           AND hs.created_at >= NOW() - INTERVAL '30 days'),
        COALESCE(pc.honor, 0)::NUMERIC,
        0::NUMERIC
      ) as recent_honor,
      COALESCE(ps.kills, 0)::INTEGER as kills,
      COALESCE(ps.play_time, 0)::INTEGER as play_time,
      (COALESCE(pc.honor, 0)::NUMERIC) as ranking_points
    FROM public.user_profiles up
    LEFT JOIN public.player_currencies pc ON up.auth_id = pc.auth_id
    LEFT JOIN public.player_stats ps ON up.auth_id = ps.auth_id
    WHERE COALESCE(up.is_administrator, FALSE) = FALSE
  ),
  ordered_players AS (
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY
          CASE p_sort_by
            WHEN 'ranking_points' THEN pr.ranking_points
            WHEN 'honor' THEN pr.honor::NUMERIC
            WHEN 'experience' THEN pr.experience::NUMERIC
            WHEN 'kills' THEN pr.kills::NUMERIC
            ELSE pr.ranking_points
          END DESC,
          pr.player_id ASC
      )::BIGINT as pos,
      pr.*
    FROM player_ranking pr
  )
  SELECT
    op.pos as rank_position,
    op.player_id,
    op.username,
    op.experience,
    op.honor,
    op.recent_honor,
    op.ranking_points,
    op.kills,
    op.play_time,
    get_rank_name(op.pos, v_total_players) as rank_name
  FROM ordered_players op
  ORDER BY op.pos ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Update get_player_complete_data_secure to return dynamic rank
DROP FUNCTION IF EXISTS get_player_complete_data_secure(UUID);
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
  current_rank_name VARCHAR
) AS $$
DECLARE
  v_total_players BIGINT;
  v_player_pos BIGINT;
  result_record RECORD;
BEGIN
  -- Get total population
  SELECT COUNT(*) INTO v_total_players FROM public.user_profiles up WHERE COALESCE(up.is_administrator, FALSE) = FALSE;

  -- Get player position based on Honor
  -- Used a subquery to avoid PL/pgSQL vs CTE syntax issues and ambiguities
  SELECT sub.pos INTO v_player_pos
  FROM (
      SELECT 
          up_inner.auth_id as inner_auth_id,
          ROW_NUMBER() OVER (ORDER BY COALESCE(pc_inner.honor, 0) DESC, up_inner.auth_id ASC) as pos
      FROM public.user_profiles up_inner
      LEFT JOIN public.player_currencies pc_inner ON up_inner.auth_id = pc_inner.auth_id
      WHERE COALESCE(up_inner.is_administrator, FALSE) = FALSE
  ) sub
  WHERE sub.inner_auth_id = auth_id_param;

  -- Get profile data
  SELECT
    up.auth_id,
    up.player_id,
    up.username,
    COALESCE(up.is_administrator, FALSE) as is_administrator,
    TRUE as found,
    CASE WHEN pc.auth_id IS NOT NULL THEN
      jsonb_build_object(
        'credits', COALESCE(pc.credits, 1000),
        'cosmos', COALESCE(pc.cosmos, 100),
        'experience', COALESCE(pc.experience, 0),
        'honor', COALESCE(pc.honor, 0),
        'current_health', COALESCE(pc.current_health, 10000),
        'current_shield', COALESCE(pc.current_shield, 5000),
        'skill_points_current', 0,
        'skill_points_total', 0
      )::text
    ELSE
      '{"credits": 1000, "cosmos": 100, "experience": 0, "honor": 0, "current_health": 10000, "current_shield": 5000, "skill_points_current": 0, "skill_points_total": 0}'
    END as currencies_data,
    CASE WHEN pu.auth_id IS NOT NULL THEN
      jsonb_build_object(
        'hpUpgrades', pu.hp_upgrades,
        'shieldUpgrades', pu.shield_upgrades,
        'speedUpgrades', pu.speed_upgrades,
        'damageUpgrades', pu.damage_upgrades
      )::text
    ELSE
      '{"hpUpgrades": 0, "shieldUpgrades": 0, "speedUpgrades": 0, "damageUpgrades": 0}'
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
      )::text FROM quest_progress qp_inner WHERE qp_inner.auth_id = auth_id_param),
      '[]'
    ) as quests_data
  INTO result_record
  FROM user_profiles up
  LEFT JOIN player_currencies pc ON up.auth_id = pc.auth_id
  LEFT JOIN player_upgrades pu ON up.auth_id = pu.auth_id
  WHERE up.auth_id = auth_id_param;

  -- Se il profilo non esiste, restituisci valori di default
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::BIGINT,
      NULL::VARCHAR(50),
      FALSE::BOOLEAN,
      FALSE,
      '{"credits": 1000, "cosmos": 100, "experience": 0, "honor": 0, "skill_points_current": 0, "skill_points_total": 0}',
      '{"hpUpgrades": 0, "shieldUpgrades": 0, "speedUpgrades": 0, "damageUpgrades": 0}',
      '[]',
      'Basic Space Pilot'::VARCHAR;
  ELSE
    RETURN QUERY SELECT
      result_record.auth_id,
      result_record.player_id,
      result_record.username,
      result_record.is_administrator,
      result_record.found,
      result_record.currencies_data,
      result_record.upgrades_data,
      result_record.quests_data,
      CASE 
          WHEN result_record.is_administrator THEN 'Administrator'::VARCHAR
          ELSE get_rank_name(v_player_pos, v_total_players)
      END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_rank_name(BIGINT, BIGINT) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard(INTEGER, VARCHAR) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_player_complete_data_secure(UUID) TO service_role;
