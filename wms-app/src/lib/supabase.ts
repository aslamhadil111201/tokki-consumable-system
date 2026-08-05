import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/^['"]|['"]$/g, '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').replace(/^['"]|['"]$/g, '').trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

