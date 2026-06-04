import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testInsert() {
  console.log("Testing returns insert...");
  const { data, error } = await supabase.from('returns').insert([{
    employee: "Test",
    itemId: 1,
    qty: 1,
    reason: "Test",
    note: "Test",
    date: "2026-01-01",
    time: "12:00",
    itemName: "Test Item",
    status: "Diterima"
  }]);
  if (error) {
    console.log("ERROR:", JSON.stringify(error, null, 2));
  } else {
    console.log("SUCCESS:", data);
  }
}

testInsert();
