import { createClient } from '@supabase/supabase-js';

// Trigger build with new environment variables
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/^['"]|['"]$/g, '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').replace(/^['"]|['"]$/g, '').trim();

console.log("Supabase URL initialized as:", supabaseUrl);
console.log("Supabase Key exists:", !!supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);



