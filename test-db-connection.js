// Script per testare la connessione a Supabase
// Esegui con: node test-db-connection.js

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Leggi le variabili d'ambiente da .env
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
    console.log('❌ File .env non trovato. Configura prima le variabili d\'ambiente.');
    return {};
  }
}

async function testConnection() {
  console.log('🔍 Test connessione Supabase...\n');

  const env = loadEnv();

  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    console.log('❌ Configurazione mancante nel file .env');
    console.log('VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL ? '✅' : '❌');
    console.log('VITE_SUPABASE_ANON_KEY:', env.VITE_SUPABASE_ANON_KEY ? '✅' : '❌');
    console.log('\n📖 Leggi SUPABASE_SETUP.md per istruzioni');
    return;
  }

  try {
    const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

    // Test connessione base
    console.log('🌐 Test connessione...');
    const { data, error } = await supabase.from('user_profiles').select('count').limit(1);

    if (error) {
      console.log('❌ Errore connessione:', error.message);
      return;
    }

    console.log('✅ Connessione Supabase OK!');

    // Test autenticazione
    console.log('🔐 Test autenticazione...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.log('⚠️  Nessun utente autenticato (normale se non hai fatto login)');
    } else if (user) {
      console.log('✅ Utente autenticato:', user.email);
    }

    // Test lettura tabelle
    console.log('📊 Test lettura schema database...');
    const tables = ['user_profiles', 'player_stats', 'player_upgrades', 'player_currencies', 'quest_progress'];

    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          console.log(`❌ Tabella ${table}: ${error.message}`);
        } else {
          console.log(`✅ Tabella ${table}: OK`);
        }
      } catch (err) {
        console.log(`❌ Tabella ${table}: Errore - ${err.message}`);
      }
    }

    console.log('\n🎉 Setup Supabase completato!');
    console.log('Ora puoi applicare le migrazioni: npx supabase db push');

  } catch (error) {
    console.log('❌ Errore generico:', error.message);
  }
}

testConnection();
