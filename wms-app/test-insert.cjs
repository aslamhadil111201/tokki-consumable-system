const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

fetch(env.VITE_SUPABASE_URL + '/rest/v1/returns', {
  method: 'POST',
  headers: {
    'apikey': env.VITE_SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + env.VITE_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    employee: "Test",
    itemId: 1,
    qty: 1,
    reason: "Test",
    note: "Test",
    date: "2026-01-01",
    time: "12:00"
  })
}).then(r => r.json()).then(data => {
  console.log("INSERT RESULT:", data);
}).catch(console.error);
