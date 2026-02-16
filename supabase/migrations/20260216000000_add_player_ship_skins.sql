-- Migration: Add persistent ship skin ownership/equip state
-- Description: Introduces player_ship_skins table used by server-authoritative skin purchase/equip flow

CREATE TABLE IF NOT EXISTS public.player_ship_skins (
  auth_id UUID PRIMARY KEY REFERENCES public.user_profiles(auth_id) ON DELETE CASCADE,
  selected_skin_id VARCHAR(100) NOT NULL DEFAULT 'ship50',
  unlocked_skin_ids JSONB NOT NULL DEFAULT '["ship50"]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_ship_skins_auth_id
  ON public.player_ship_skins(auth_id);

ALTER TABLE public.player_ship_skins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own ship skins" ON public.player_ship_skins;
CREATE POLICY "Users can manage their own ship skins" ON public.player_ship_skins
  FOR ALL USING (player_ship_skins.auth_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all ship skins" ON public.player_ship_skins;
CREATE POLICY "Service role can manage all ship skins" ON public.player_ship_skins
  FOR ALL USING (auth.role() = 'service_role');

-- Bootstrap defaults for existing accounts
INSERT INTO public.player_ship_skins (auth_id, selected_skin_id, unlocked_skin_ids)
SELECT auth_id, 'ship50', '["ship50"]'::jsonb
FROM public.user_profiles
ON CONFLICT (auth_id) DO NOTHING;

-- Force ship50 as the ONLY unlocked + selected skin for all existing players.
UPDATE public.player_ship_skins
SET
  selected_skin_id = 'ship50',
  unlocked_skin_ids = '["ship50"]'::jsonb,
  updated_at = NOW();

GRANT ALL ON TABLE public.player_ship_skins TO service_role;
GRANT ALL ON TABLE public.player_ship_skins TO postgres;
