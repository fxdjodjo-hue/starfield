-- Migration: Add leaderboard RPC function
-- Returns top players ranked by ranking points (exp + recent_honor * 2)

-- Function to get leaderboard (top N players)
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_limit INTEGER DEFAULT 100,
  p_sort_by VARCHAR(20) DEFAULT 'ranking_points' -- 'ranking_points', 'honor', 'experience', 'kills'
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
  level INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH player_rankings AS (
    SELECT
      up.player_id,
      up.username,
      COALESCE(pc.experience, 0)::BIGINT as experience,
      COALESCE(pc.honor, 0)::INTEGER as honor,
      -- Use honor as recent_honor if honor_history table doesn't exist
      COALESCE(pc.honor, 0)::NUMERIC as recent_honor,
      COALESCE(ps.kills, 0)::INTEGER as kills,
      COALESCE(ps.play_time, 0)::INTEGER as play_time,
      -- Calculate ranking points: exp + (honor * 2)
      (
        COALESCE(pc.experience, 0)::BIGINT +
        (COALESCE(pc.honor, 0) * 2)
      )::NUMERIC as ranking_points,
      -- Calculate level based on experience (same logic as client)
      CASE
        WHEN COALESCE(pc.experience, 0) >= 5498470400000000 THEN 44
        WHEN COALESCE(pc.experience, 0) >= 43987763200000000 THEN 43
        WHEN COALESCE(pc.experience, 0) >= 21993881600000000 THEN 42
        WHEN COALESCE(pc.experience, 0) >= 10996940800000000 THEN 41
        WHEN COALESCE(pc.experience, 0) >= 5498470400000000 THEN 40
        WHEN COALESCE(pc.experience, 0) >= 2749235200000000 THEN 39
        WHEN COALESCE(pc.experience, 0) >= 1374617600000000 THEN 38
        WHEN COALESCE(pc.experience, 0) >= 687308800000000 THEN 37
        WHEN COALESCE(pc.experience, 0) >= 343654400000000 THEN 36
        WHEN COALESCE(pc.experience, 0) >= 171827200000000 THEN 35
        WHEN COALESCE(pc.experience, 0) >= 85913600000000 THEN 34
        WHEN COALESCE(pc.experience, 0) >= 42956800000000 THEN 33
        WHEN COALESCE(pc.experience, 0) >= 21478400000000 THEN 32
        WHEN COALESCE(pc.experience, 0) >= 10739200000000 THEN 31
        WHEN COALESCE(pc.experience, 0) >= 5369700000000 THEN 30
        WHEN COALESCE(pc.experience, 0) >= 2685000000000 THEN 29
        WHEN COALESCE(pc.experience, 0) >= 1342496000000 THEN 28
        WHEN COALESCE(pc.experience, 0) >= 671248000000 THEN 27
        WHEN COALESCE(pc.experience, 0) >= 335621600000 THEN 26
        WHEN COALESCE(pc.experience, 0) >= 167808800000 THEN 25
        WHEN COALESCE(pc.experience, 0) >= 83902400000 THEN 24
        WHEN COALESCE(pc.experience, 0) >= 41951120000 THEN 23
        WHEN COALESCE(pc.experience, 0) >= 20973860000 THEN 22
        WHEN COALESCE(pc.experience, 0) >= 10487010000 THEN 21
        WHEN COALESCE(pc.experience, 0) >= 5243410000 THEN 20
        WHEN COALESCE(pc.experience, 0) >= 2621710000 THEN 19
        WHEN COALESCE(pc.experience, 0) >= 1310790000 THEN 18
        WHEN COALESCE(pc.experience, 0) >= 655430000 THEN 17
        WHEN COALESCE(pc.experience, 0) >= 327750000 THEN 16
        WHEN COALESCE(pc.experience, 0) >= 163910000 THEN 15
        WHEN COALESCE(pc.experience, 0) >= 81910000 THEN 14
        WHEN COALESCE(pc.experience, 0) >= 40950000 THEN 13
        WHEN COALESCE(pc.experience, 0) >= 20470000 THEN 12
        WHEN COALESCE(pc.experience, 0) >= 10230000 THEN 11
        WHEN COALESCE(pc.experience, 0) >= 5110000 THEN 10
        WHEN COALESCE(pc.experience, 0) >= 2550000 THEN 9
        WHEN COALESCE(pc.experience, 0) >= 1270000 THEN 8
        WHEN COALESCE(pc.experience, 0) >= 630000 THEN 7
        WHEN COALESCE(pc.experience, 0) >= 310000 THEN 6
        WHEN COALESCE(pc.experience, 0) >= 150000 THEN 5
        WHEN COALESCE(pc.experience, 0) >= 70000 THEN 4
        WHEN COALESCE(pc.experience, 0) >= 30000 THEN 3
        WHEN COALESCE(pc.experience, 0) >= 10000 THEN 2
        ELSE 1
      END::INTEGER as level
    FROM public.user_profiles up
    LEFT JOIN public.player_currencies pc ON up.auth_id = pc.auth_id
    LEFT JOIN public.player_stats ps ON up.auth_id = ps.auth_id
    WHERE up.username IS NOT NULL 
      AND up.username != ''
  ),
  ranked_players AS (
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY
          CASE p_sort_by
            WHEN 'honor' THEN pr.honor
            WHEN 'experience' THEN pr.experience
            WHEN 'kills' THEN pr.kills
            WHEN 'play_time' THEN pr.play_time
            ELSE pr.ranking_points
          END DESC
      )::BIGINT as rank_position,
      pr.player_id as player_id,
      pr.username as username,
      pr.experience as experience,
      pr.honor as honor,
      pr.recent_honor as recent_honor,
      pr.ranking_points as ranking_points,
      pr.kills as kills,
      pr.play_time as play_time,
      pr.level as level
    FROM player_rankings pr
    ORDER BY
      CASE p_sort_by
        WHEN 'honor' THEN pr.honor
        WHEN 'experience' THEN pr.experience
        WHEN 'kills' THEN pr.kills
        WHEN 'play_time' THEN pr.play_time
        ELSE pr.ranking_points
      END DESC
    LIMIT p_limit
  )
  SELECT * FROM ranked_players;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to service_role
GRANT EXECUTE ON FUNCTION public.get_leaderboard(INTEGER, VARCHAR) TO service_role;

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_player_currencies_experience ON public.player_currencies(experience DESC);
CREATE INDEX IF NOT EXISTS idx_player_currencies_honor ON public.player_currencies(honor DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_kills ON public.player_stats(kills DESC);
