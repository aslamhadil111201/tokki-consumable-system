import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
const envContent = fs.readFileSync('.env', 'utf-8');
let supabaseUrl = '';
let supabaseAnonKey = '';
envContent.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseAnonKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: users, error: err1 } = await supabase.from('users').select('*');
  console.log("Users:", users, err1);
  const { data: admins, error: err2 } = await supabase.from('admins').select('*');
  console.log("Admins:", admins, err2);
}

check();
