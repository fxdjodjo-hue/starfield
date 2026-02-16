-- Migration: Add player resources persistence
-- Description: Stores collected world resources by auth_id and resource_type.

CREATE TABLE IF NOT EXISTS public.player_resources (
  auth_id UUID NOT NULL REFERENCES public.user_profiles(auth_id) ON DELETE CASCADE,
  resource_type VARCHAR(100) NOT NULL,
  quantity BIGINT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (auth_id, resource_type)
);

CREATE INDEX IF NOT EXISTS idx_player_resources_auth_id
  ON public.player_resources(auth_id);

ALTER TABLE public.player_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own resources" ON public.player_resources;
CREATE POLICY "Users can manage their own resources" ON public.player_resources
  FOR ALL USING (player_resources.auth_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all resources" ON public.player_resources;
CREATE POLICY "Service role can manage all resources" ON public.player_resources
  FOR ALL USING (auth.role() = 'service_role');

GRANT ALL ON TABLE public.player_resources TO service_role;
GRANT ALL ON TABLE public.player_resources TO postgres;
