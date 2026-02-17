-- Migration: Add pet nickname to persisted player pets
-- Description: Adds server-authoritative nickname field for each player's pet.

ALTER TABLE public.player_pets
  ADD COLUMN IF NOT EXISTS pet_nickname VARCHAR(64);

