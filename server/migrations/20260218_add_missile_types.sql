INSERT INTO public.ammo_types (code, display_name, damage_multiplier, is_active) VALUES 
('m1', 'Missile M1', 1.0, true),
('m2', 'Missile M2', 2.0, true),
('m3', 'Missile M3', 3.0, true)
ON CONFLICT (code) DO NOTHING;
