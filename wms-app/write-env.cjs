const fs = require('fs');
const path = require('path');

const url = process.env.VITE_SUPABASE_URL || 'NOT_SET';
const key = process.env.VITE_SUPABASE_ANON_KEY || 'NOT_SET';

const maskedKey = key !== 'NOT_SET' 
  ? key.slice(0, 10) + '...' + key.slice(-10) 
  : 'NOT_SET';

const data = {
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_ANON_KEY_MASKED: maskedKey,
  buildTime: new Date().toISOString()
};

// Ensure public directory exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

fs.writeFileSync(path.join(publicDir, 'env-check.json'), JSON.stringify(data, null, 2));
console.log("Wrote public/env-check.json for deployment debugging:", data);
