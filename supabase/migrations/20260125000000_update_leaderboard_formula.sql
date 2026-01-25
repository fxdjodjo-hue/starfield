-- Migration per aggiornare la formula della classifica (Leaderboard)
-- 1. Forza RankingPoints = Honor (solo Onore)
-- 2. Rimuove la colonna Level (Livello) come richiesto dall'utente

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
  play_time INTEGER
)
SECURITY DEFINER
AS $$
BEGIN
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
      -- 🟢 NUOVA FORMULA: RankingPoints = Onore (Semplificata)
      (COALESCE(pc.honor, 0)::NUMERIC) as ranking_points
    FROM public.user_profiles up
    LEFT JOIN public.player_currencies pc ON up.auth_id = pc.auth_id
    LEFT JOIN public.player_stats ps ON up.auth_id = ps.auth_id
    WHERE up.is_administrator = FALSE
  )
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
    )::BIGINT as rank_position,
    pr.player_id,
    pr.username,
    pr.experience,
    pr.honor,
    pr.recent_honor,
    pr.ranking_points,
    pr.kills,
    pr.play_time
  FROM player_ranking pr
  ORDER BY
    CASE p_sort_by
      WHEN 'ranking_points' THEN pr.ranking_points
      WHEN 'honor' THEN pr.honor::NUMERIC
      WHEN 'experience' THEN pr.experience::NUMERIC
      WHEN 'kills' THEN pr.kills::NUMERIC
      ELSE pr.ranking_points
    END DESC,
    pr.player_id ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions for the leaderboard function
GRANT EXECUTE ON FUNCTION get_leaderboard(INTEGER, VARCHAR) TO service_role, anon, authenticated;
