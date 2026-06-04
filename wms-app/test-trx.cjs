const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

fetch(env.VITE_SUPABASE_URL + '/rest/v1/transactions', {
  method: 'POST',
  headers: {
    'apikey': env.VITE_SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + env.VITE_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    taker: "Test",
    dept: "Test",
    workOrder: "Test",
    note: "Test",
    date: "2026-01-01",
    time: "12:00",
    admin: "Test",
    items: [],
    approvalStatus: "approved",
    approvedBy: "system",
    approvedAt: "2026-01-01T12:00:00.000Z"
  })
}).then(r => r.json()).then(data => {
  console.log("INSERT RESULT:", data);
}).catch(console.error);
