const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve('.env');
let supabaseUrl = '';
let supabaseAnonKey = '';

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split(/\r?\n/).forEach((line) => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key === 'VITE_SUPABASE_URL') supabaseUrl = value;
      if (key === 'VITE_SUPABASE_ANON_KEY') supabaseAnonKey = value;
    }
  });
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERROR: Supabase credentials not found in .env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const dbPath = path.resolve('data/db.json');
  if (!fs.existsSync(dbPath)) {
    console.error("ERROR: data/db.json not found!");
    process.exit(1);
  }

  const raw = fs.readFileSync(dbPath, 'utf-8');
  let db;
  try {
    db = JSON.parse(raw);
  } catch (e) {
    console.error("ERROR: Failed to parse JSON in data/db.json!", e.message);
    process.exit(1);
  }

  const tables = ['users', 'admins', 'departments', 'employees', 'workOrders'];

  console.log("Starting master tables restore from data/db.json...");

  for (const table of tables) {
    const rows = db[table] || [];
    console.log(`Processing table: ${table} (${rows.length} rows)`);

    // Delete existing rows
    const { error: delError } = await supabase.from(table).delete().neq('id', -1);
    if (delError) {
      console.error(`[-] Failed to clear table ${table}:`, delError.message);
      continue;
    }

    if (rows.length === 0) {
      console.log(`[✓] Table ${table} is empty. Skipped insert.`);
      continue;
    }

    // Insert chunked
    const chunkSize = 100;
    try {
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error: insError } = await supabase.from(table).insert(chunk);
        if (insError) {
          console.error(`[-] Error inserting chunk for ${table} at index ${i}:`, insError.message);
          throw insError;
        }
      }
      console.log(`[✓] Restored ${table} (${rows.length} rows)`);
    } catch (err) {
      console.error(`[-] Failed to restore table ${table}`);
    }
  }

  console.log("=== MASTER TABLES RESTORE COMPLETED ===");
}

run();
