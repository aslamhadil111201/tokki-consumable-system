import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Helper to load .env.local variables
function loadEnv() {
  const envPath = path.resolve('.env.local');
  if (fs.existsSync(envPath)) {
    console.log("Found .env.local, loading credentials...");
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split(/\r?\n/).forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = value;
      }
    });
  } else {
    console.warn("WARNING: .env.local not found. Running with current environment variables.");
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be defined in your environment or .env.local!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Highly robust CSV parser that handles escaped quotes, nested commas, and newlines in fields.
 */
function parseCSV(content: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" inside a quoted field
          field += '"';
          i++; // skip next quote
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\r' || char === '\n') {
        row.push(field);
        if (row.some(f => f.trim() !== '')) {
          result.push(row);
        }
        row = [];
        field = '';
        // Skip over \n if this was \r\n
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        field += char;
      }
    }
  }

  // Push remaining field & row if file doesn't end with a newline
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some(f => f.trim() !== '')) {
      result.push(row);
    }
  }

  return result;
}

// Convert CSV rows to array of objects mapped by header keys
function csvToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ? row[index].trim() : '';
    });
    return obj;
  });
}

async function migrateAddresses() {
  const filePath = path.resolve('data/addresses.csv');
  if (!fs.existsSync(filePath)) {
    console.log("[-] data/addresses.csv not found. Skipping shipping addresses migration.");
    return;
  }

  console.log("[*] Reading data/addresses.csv...");
  const rawContent = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(rawContent);
  const records = csvToObjects(rows);

  if (records.length === 0) {
    console.log("[-] No address records found in CSV.");
    return;
  }

  console.log(`[*] Preparing to migrate ${records.length} shipping addresses...`);
  const payloads = records.map(r => ({
    destination: r.destination || r.nama || r.tujuan || 'Unknown',
    attn: r.attn || r.penerima || null,
    contact: r.contact || r.telepon || r.kontak || null,
    full_address: r.full_address || r.alamat || null
  }));

  // Chunk array to avoid Supabase query size limits (500 records at a time)
  const chunkSize = 200;
  let successCount = 0;

  for (let i = 0; i < payloads.length; i += chunkSize) {
    const chunk = payloads.slice(i, i + chunkSize);
    const { error } = await supabase.from('shipping_addresses').insert(chunk);
    
    if (error) {
      console.error(`[X] Error inserting address chunk starting at index ${i}:`, error.message);
    } else {
      successCount += chunk.length;
      console.log(`[✓] Migrated ${successCount}/${payloads.length} shipping addresses...`);
    }
  }

  console.log(`[✓] Finished shipping addresses migration. Successfully imported: ${successCount}`);
}

async function migrateDeliveryNotes() {
  const filePath = path.resolve('data/notes.csv');
  if (!fs.existsSync(filePath)) {
    console.log("[-] data/notes.csv not found. Skipping delivery notes migration.");
    return;
  }

  console.log("[*] Reading data/notes.csv...");
  const rawContent = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(rawContent);
  const records = csvToObjects(rows);

  if (records.length === 0) {
    console.log("[-] No delivery note records found in CSV.");
    return;
  }

  console.log(`[*] Preparing to migrate ${records.length} delivery notes...`);
  const payloads = records.map(r => {
    // Attempt to parse items JSON safely
    let items: any[] = [];
    try {
      if (r.items) {
        items = JSON.parse(r.items);
      } else if (r.items_json) {
        items = JSON.parse(r.items_json);
      }
    } catch {
      // Fallback: If not a valid JSON array, create a single item representing the cargo text
      items = [{
        qty: parseInt(r.qty || r.jumlah || '1', 10) || 1,
        uom: r.uom || r.satuan || 'pcs',
        description: r.item_description || r.description || r.barang || 'Legacy cargo item'
      }];
    }

    if (!Array.isArray(items) || items.length === 0) {
      items = [{ qty: 1, uom: 'pcs', description: r.description || 'Legacy cargo item' }];
    }

    return {
      batch: r.batch || r.no_surat_jalan || r.no_sj || 'SJ000',
      category: (r.category || r.kategori || 'ETC').toUpperCase(),
      date: r.date || r.tanggal || new Date().toISOString().split('T')[0],
      project_no: r.project_no || r.no_proyek || null,
      no_kendaraan: r.no_kendaraan || r.nopol || null,
      destination: r.destination || r.tujuan || 'Unknown Customer',
      attn: r.attn || r.penerima || null,
      full_address: r.full_address || r.alamat || null,
      items: items
    };
  });

  const chunkSize = 150;
  let successCount = 0;

  for (let i = 0; i < payloads.length; i += chunkSize) {
    const chunk = payloads.slice(i, i + chunkSize);
    const { error } = await supabase.from('delivery_notes').insert(chunk);
    
    if (error) {
      console.error(`[X] Error inserting note chunk starting at index ${i}:`, error.message);
    } else {
      successCount += chunk.length;
      console.log(`[✓] Migrated ${successCount}/${payloads.length} delivery notes...`);
    }
  }

  console.log(`[✓] Finished delivery notes migration. Successfully imported: ${successCount}`);
}

async function startMigration() {
  console.log("=== TOKKI DELIVERY SYSTEM DATA MIGRATOR ===");
  console.log(`Connecting to Supabase at: ${supabaseUrl}`);

  try {
    await migrateAddresses();
    await migrateDeliveryNotes();
    console.log("=== MIGRATION COMPLETED ===");
  } catch (err: any) {
    console.error("FATAL ERROR DURING MIGRATION:", err.message || err);
  }
}

startMigration();
