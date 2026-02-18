const { createSupabaseClient, getSupabaseConfig } = require('./server/config/supabase.cjs');
require('dotenv').config();

const { url, serviceKey } = getSupabaseConfig();
const supabase = createSupabaseClient();

async function runMigration() {
    console.log('Running migration to add missile types...');

    const missileTypes = [
        { code: 'm1', display_name: 'Missile M1', damage_multiplier: 1.0, is_active: true },
        { code: 'm2', display_name: 'Missile M2', damage_multiplier: 2.0, is_active: true },
        { code: 'm3', display_name: 'Missile M3', damage_multiplier: 3.0, is_active: true },
    ];

    for (const type of missileTypes) {
        const { error } = await supabase
            .from('ammo_types')
            .upsert(type, { onConflict: 'code' });

        if (error) {
            console.error(`Error adding ${type.code}:`, error.message);
        } else {
            console.log(`Added/Updated ${type.code}`);
        }
    }
}

runMigration().catch(console.error);
