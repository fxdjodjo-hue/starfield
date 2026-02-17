-- Migration: Add player pets persistence
-- Description: Stores server-authoritative pet progression and combat stats by auth_id.

CREATE TABLE IF NOT EXISTS public.player_pets (
  auth_id UUID NOT NULL REFERENCES public.user_profiles(auth_id) ON DELETE CASCADE,
  pet_id VARCHAR(100) NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  experience BIGINT NOT NULL DEFAULT 0 CHECK (experience >= 0),
  current_health BIGINT NOT NULL DEFAULT 0 CHECK (current_health >= 0),
  max_health BIGINT NOT NULL DEFAULT 1 CHECK (max_health >= 1),
  current_shield BIGINT NOT NULL DEFAULT 0 CHECK (current_shield >= 0),
  max_shield BIGINT NOT NULL DEFAULT 0 CHECK (max_shield >= 0),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (auth_id, pet_id)
);

CREATE INDEX IF NOT EXISTS idx_player_pets_auth_id
  ON public.player_pets(auth_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_player_pets_active_auth_id
  ON public.player_pets(auth_id)
  WHERE is_active = TRUE;

ALTER TABLE public.player_pets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own pets" ON public.player_pets;
CREATE POLICY "Users can manage their own pets" ON public.player_pets
  FOR ALL USING (player_pets.auth_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all pets" ON public.player_pets;
CREATE POLICY "Service role can manage all pets" ON public.player_pets
  FOR ALL USING (auth.role() = 'service_role');

GRANT ALL ON TABLE public.player_pets TO service_role;
GRANT ALL ON TABLE public.player_pets TO postgres;
