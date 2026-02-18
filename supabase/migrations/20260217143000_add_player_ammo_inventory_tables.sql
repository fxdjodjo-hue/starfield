-- Migration: Add dedicated ammo inventory tables
-- Description: Normalized ammo catalog, per-player ammo balances, ammo ledger and selected ammo loadout.

CREATE TABLE IF NOT EXISTS public.ammo_types (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  display_name VARCHAR(64) NOT NULL,
  damage_multiplier INTEGER NOT NULL CHECK (damage_multiplier >= 1),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.ammo_types (code, display_name, damage_multiplier, is_active)
VALUES
  ('x1', 'Ammo X1', 1, TRUE),
  ('x2', 'Ammo X2', 2, TRUE),
  ('x3', 'Ammo X3', 3, TRUE)
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  damage_multiplier = EXCLUDED.damage_multiplier,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS selected_ammo_code VARCHAR(32) NOT NULL DEFAULT 'x1';

ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_selected_ammo_code_fkey;

ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_selected_ammo_code_fkey
FOREIGN KEY (selected_ammo_code)
REFERENCES public.ammo_types(code);

CREATE TABLE IF NOT EXISTS public.player_ammo_inventory (
  auth_id UUID NOT NULL REFERENCES public.user_profiles(auth_id) ON DELETE CASCADE,
  ammo_type_id BIGINT NOT NULL REFERENCES public.ammo_types(id) ON DELETE RESTRICT,
  quantity BIGINT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (auth_id, ammo_type_id)
);

CREATE INDEX IF NOT EXISTS idx_player_ammo_inventory_auth_id
  ON public.player_ammo_inventory(auth_id);

CREATE TABLE IF NOT EXISTS public.player_ammo_transactions (
  id BIGSERIAL PRIMARY KEY,
  auth_id UUID NOT NULL REFERENCES public.user_profiles(auth_id) ON DELETE CASCADE,
  ammo_type_id BIGINT NOT NULL REFERENCES public.ammo_types(id) ON DELETE RESTRICT,
  delta BIGINT NOT NULL CHECK (delta <> 0),
  reason VARCHAR(64) NOT NULL,
  reference_id VARCHAR(128),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_ammo_transactions_auth_id_created_at
  ON public.player_ammo_transactions(auth_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_ammo_transactions_auth_id_ammo_type
  ON public.player_ammo_transactions(auth_id, ammo_type_id);

ALTER TABLE public.ammo_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ammo_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ammo_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view active ammo types" ON public.ammo_types;
CREATE POLICY "Users can view active ammo types" ON public.ammo_types
  FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Service role can manage ammo types" ON public.ammo_types;
CREATE POLICY "Service role can manage ammo types" ON public.ammo_types
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can manage their own ammo inventory" ON public.player_ammo_inventory;
CREATE POLICY "Users can manage their own ammo inventory" ON public.player_ammo_inventory
  FOR ALL USING (player_ammo_inventory.auth_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all ammo inventory" ON public.player_ammo_inventory;
CREATE POLICY "Service role can manage all ammo inventory" ON public.player_ammo_inventory
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view their own ammo transactions" ON public.player_ammo_transactions;
CREATE POLICY "Users can view their own ammo transactions" ON public.player_ammo_transactions
  FOR SELECT USING (player_ammo_transactions.auth_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all ammo transactions" ON public.player_ammo_transactions;
CREATE POLICY "Service role can manage all ammo transactions" ON public.player_ammo_transactions
  FOR ALL USING (auth.role() = 'service_role');

GRANT ALL ON TABLE public.ammo_types TO service_role;
GRANT ALL ON TABLE public.player_ammo_inventory TO service_role;
GRANT ALL ON TABLE public.player_ammo_transactions TO service_role;
GRANT ALL ON TABLE public.ammo_types TO postgres;
GRANT ALL ON TABLE public.player_ammo_inventory TO postgres;
GRANT ALL ON TABLE public.player_ammo_transactions TO postgres;
GRANT USAGE, SELECT ON SEQUENCE public.ammo_types_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.player_ammo_transactions_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ammo_types_id_seq TO postgres;
GRANT USAGE, SELECT ON SEQUENCE public.player_ammo_transactions_id_seq TO postgres;

