-- Migration: Add pet module persistence columns
-- Description: Adds module slot + cargo fields used by pet crafting.

ALTER TABLE public.player_pets
  ADD COLUMN IF NOT EXISTS module_slot JSONB,
  ADD COLUMN IF NOT EXISTS inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS inventory_capacity INTEGER NOT NULL DEFAULT 8;
