-- Migration: Fix service_role permissions on user_profiles for ammo selected tier persistence
-- Description: Grant only the minimum columns needed by backend ammo persistence code.
--
-- Why column-level grants:
-- - SELECT on auth_id + selected_ammo_code is needed to read selected tier for one player.
-- - UPDATE on selected_ammo_code + updated_at is needed to persist tier changes.
-- - We intentionally avoid broad table-wide SELECT/UPDATE grants.
-- - We intentionally avoid touching existing RLS policies in this migration.

GRANT SELECT (auth_id, selected_ammo_code) ON TABLE public.user_profiles TO service_role;
GRANT UPDATE (selected_ammo_code, updated_at) ON TABLE public.user_profiles TO service_role;
