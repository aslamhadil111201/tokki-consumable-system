import { createClient } from '@supabase/supabase-js';

// Trigger build with new environment variables
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/^['"]|['"]$/g, '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').replace(/^['"]|['"]$/g, '').trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


