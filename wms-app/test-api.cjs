const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

fetch(env.VITE_SUPABASE_URL + '/rest/v1/returns?limit=1', {
  headers: { 'apikey': env.VITE_SUPABASE_ANON_KEY }
}).then(r => r.json()).then(data => {
  console.log("TABLE ROWS:", data);
}).catch(console.error);
