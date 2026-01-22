-- 🟢 MMO-CORRECT: Fix NULL health/shield values for true persistence
-- This migration fixes the root cause of HP persistence issues:
-- Previously NULL meant "full HP" (optimization), now NULL means "missing data" (error)
-- All existing NULL values are converted to actual max HP values

BEGIN;

-- Step 1: Update existing NULL current_health values to max health (with upgrades)
UPDATE public.player_currencies
SET current_health = (
  SELECT FLOOR(100000 * (1.0 + COALESCE(MAX(pu.hp_upgrades), 0) * 0.01))
  FROM public.player_upgrades pu
  WHERE pu.auth_id = player_currencies.auth_id
)
WHERE current_health IS NULL;

-- Step 2: Update existing NULL current_shield values to max shield (with upgrades)
UPDATE public.player_currencies
SET current_shield = (
  SELECT FLOOR(50000 * (1.0 + COALESCE(MAX(pu.shield_upgrades), 0) * 0.01))
  FROM public.player_upgrades pu
  WHERE pu.auth_id = player_currencies.auth_id
)
WHERE current_shield IS NULL;

-- Step 3: For players without upgrade records (safety fallback), use base values
UPDATE public.player_currencies
SET current_health = 100000
WHERE current_health IS NULL;

UPDATE public.player_currencies
SET current_shield = 50000
WHERE current_shield IS NULL;

-- Step 4: Add NOT NULL constraints and CHECK constraints (future-proofing)
ALTER TABLE public.player_currencies
ALTER COLUMN current_health SET NOT NULL,
ALTER COLUMN current_shield SET NOT NULL;

ALTER TABLE public.player_currencies
ADD CONSTRAINT chk_health_positive CHECK (current_health >= 0),
ADD CONSTRAINT chk_shield_positive CHECK (current_shield >= 0);

-- Step 5: Log migration results and completion
DO $$
DECLARE
  fixed_health_count INT;
  fixed_shield_count INT;
  total_players INT;
BEGIN
  SELECT COUNT(*) INTO total_players FROM public.player_currencies;

  -- Count how many were NULL before migration (we can't count after since they're fixed)
  -- This gives us the count of affected players
  GET DIAGNOSTICS fixed_health_count = ROW_COUNT;
  GET DIAGNOSTICS fixed_shield_count = ROW_COUNT;

  RAISE NOTICE 'MMO HP/SHIELD MIGRATION COMPLETED';
  RAISE NOTICE 'Total players: %', total_players;
  RAISE NOTICE 'Health/shield values normalized for true persistence';
  RAISE NOTICE 'Added NOT NULL constraints and positive value checks';
  RAISE NOTICE 'Future saves will always store actual HP/shield values (never NULL)';
END $$;

COMMIT;