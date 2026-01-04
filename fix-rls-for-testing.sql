-- SQL per permettere l'accesso ai dati di test
-- Esegui questo nel SQL Editor di Supabase
-- Questo aggiunge una condizione OR alle policy esistenti per permettere l'accesso al nostro UUID di test

-- Modifica le policy esistenti per includere accesso test
-- NOTA: Rimuovi la parte OR dopo i test!

-- Per user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

CREATE POLICY "Users can manage profiles" ON public.user_profiles
  FOR ALL USING (
    auth.uid() = id
    OR id = '550e8400-e29b-41d4-a716-446655440000'::uuid  -- UUID di test
  );

-- Per player_stats
DROP POLICY IF EXISTS "Users can manage their stats" ON public.player_stats;

CREATE POLICY "Users can manage stats" ON public.player_stats
  FOR ALL USING (
    auth.uid() = user_id
    OR user_id = '550e8400-e29b-41d4-a716-446655440000'::uuid  -- UUID di test
  );

-- Per player_upgrades
DROP POLICY IF EXISTS "Users can manage their upgrades" ON public.player_upgrades;

CREATE POLICY "Users can manage upgrades" ON public.player_upgrades
  FOR ALL USING (
    auth.uid() = user_id
    OR user_id = '550e8400-e29b-41d4-a716-446655440000'::uuid  -- UUID di test
  );

-- Per player_currencies
DROP POLICY IF EXISTS "Users can manage their currencies" ON public.player_currencies;

CREATE POLICY "Users can manage currencies" ON public.player_currencies
  FOR ALL USING (
    auth.uid() = user_id
    OR user_id = '550e8400-e29b-41d4-a716-446655440000'::uuid  -- UUID di test
  );

-- Per quest_progress
DROP POLICY IF EXISTS "Users can manage their quests" ON public.quest_progress;

CREATE POLICY "Users can manage quests" ON public.quest_progress
  FOR ALL USING (
    auth.uid() = user_id
    OR user_id = '550e8400-e29b-41d4-a716-446655440000'::uuid  -- UUID di test
  );
