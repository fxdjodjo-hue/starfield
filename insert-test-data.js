// Script per inserire dati di test nel database Supabase
// Esegui con: node insert-test-data.js

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Leggi le variabili d'ambiente
function loadEnv() {
  try {
    const envContent = readFileSync('.env', 'utf8');
    const env = {};

    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && key.startsWith('VITE_SUPABASE_')) {
        const value = valueParts.join('=').trim();
        if (value && !value.includes('your-')) {
          env[key] = value;
        }
      }
    });

    return env;
  } catch (error) {
    console.log('❌ File .env non trovato');
    return {};
  }
}

async function insertTestData() {
  console.log('🧪 Inserendo dati di test per player-1...\n');

  const env = loadEnv();

  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    console.log('❌ Configurazione .env mancante');
    return;
  }

  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

  try {
    // Usa un UUID valido per i test (questo è un UUID valido generato)
    const testUserId = '550e8400-e29b-41d4-a716-446655440000';

    // Per test: disabilita temporaneamente RLS
    console.log('🔓 Disabilitando RLS per test...');
    await supabase.rpc('disable_rls_for_testing');

    // Crea profilo utente di test

    // Crea profilo utente di test
    console.log('👤 Creando profilo utente...');
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: testUserId,
        username: 'TestPlayer',
        display_name: 'Giocatore di Test'
      })
      .select();

    if (profileError) {
      console.log('⚠️ Errore profilo:', profileError.message);
    } else {
      console.log('✅ Profilo creato:', profile);
    }

    // Inserisci statistiche di test
    console.log('📊 Inserendo statistiche...');
    const { data: stats, error: statsError } = await supabase
      .from('player_stats')
      .upsert({
        user_id: testUserId,
        kills: 15,
        deaths: 3,
        missions_completed: 5,
        play_time: 3600 // 1 ora
      })
      .select();

    if (statsError) {
      console.log('❌ Errore statistiche:', statsError.message);
    } else {
      console.log('✅ Statistiche inserite:', stats);
    }

    // Inserisci upgrades di test
    console.log('⬆️ Inserendo upgrades...');
    const { data: upgrades, error: upgradesError } = await supabase
      .from('player_upgrades')
      .upsert({
        user_id: testUserId,
        hp_upgrades: 2,
        shield_upgrades: 1,
        speed_upgrades: 3,
        damage_upgrades: 1
      })
      .select();

    if (upgradesError) {
      console.log('❌ Errore upgrades:', upgradesError.message);
    } else {
      console.log('✅ Upgrades inseriti:', upgrades);
    }

    // Inserisci valute di test
    console.log('💰 Inserendo valute...');
    const { data: currencies, error: currenciesError } = await supabase
      .from('player_currencies')
      .upsert({
        user_id: testUserId,
        credits: 2500,
        cosmos: 150,
        experience: 25000,
        honor: 250,
        skill_points_current: 5,
        skill_points_total: 8
      })
      .select();

    if (currenciesError) {
      console.log('❌ Errore valute:', currenciesError.message);
    } else {
      console.log('✅ Valute inserite:', currencies);
    }

    // Inserisci progresso quest di test
    console.log('📜 Inserendo progresso quest...');
    const { data: quests, error: questsError } = await supabase
      .from('quest_progress')
      .upsert({
        user_id: testUserId,
        quest_id: 'tutorial_quest',
        objectives: [
          { id: 'kill_5_scouters', current: 3, target: 5 },
          { id: 'collect_10_credits', current: 10, target: 10 }
        ],
        is_completed: false
      })
      .select();

    if (questsError) {
      console.log('❌ Errore quest:', questsError.message);
    } else {
      console.log('✅ Quest inserita:', quests);
    }

    console.log('\n🎉 Tutti i dati di test inseriti!');
    console.log('Ora avvia il gioco per vedere se vengono caricati!');

  } catch (error) {
    console.log('❌ Errore generale:', error.message);
  }
}

insertTestData();
