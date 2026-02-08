const { createClient } = require('@supabase/supabase-js');

function getRequiredEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    console.error(`[SUPABASE CONFIG] Missing required env ${name}. Set it in .env before starting the server.`);
    throw new Error(`[SUPABASE CONFIG] Missing required env ${name}.`);
  }
  return value;
}

function validateSupabaseEnv() {
  const missing = [];
  if (!((process.env.SUPABASE_URL || '').trim())) missing.push('SUPABASE_URL');
  if (!((process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim())) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    console.error(`[SUPABASE CONFIG] Missing required env: ${missing.join(', ')}. Set them in .env before starting the server.`);
    throw new Error(`[SUPABASE CONFIG] Missing required env: ${missing.join(', ')}.`);
  }
}

function getSupabaseConfig() {
  const url = getRequiredEnv('SUPABASE_URL');
  const serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return { url, serviceKey };
}

function createSupabaseClient(options = {}) {
  const { url, serviceKey } = getSupabaseConfig();
  return createClient(url, serviceKey, options);
}

module.exports = {
  getSupabaseConfig,
  createSupabaseClient,
  validateSupabaseEnv
};
