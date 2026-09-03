const { createClient } = require('@supabase/supabase-js');

// ==========================================
// 1. ISI DENGAN KREDENSIAL SUPABASE LAMA (WMS)
// ==========================================
const OLD_URL = 'https://fgmejtaxgsmhyfvsnvmn.supabase.co';
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnbWVqdGF4Z3NtaHlmdnNudm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzUyNzgsImV4cCI6MjEwMTQ1MTI3OH0.elEzqpz8j5AQi9kZ74_PFcEd0nhRZzOtB3PQTMLUTr0';

// ==========================================
// 2. ISI DENGAN KREDENSIAL SUPABASE BARU (DELIVERY)
// ==========================================
const NEW_URL = 'https://vbswgzysrkjiehaujoqv.supabase.co';
const NEW_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZic3dnenlzcmtqaWVoYXVqb3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzOTQzNDEsImV4cCI6MjEwMzk3MDM0MX0.7qU8QkcsLRI_IQ2gaMXlqylSZh-G6z55e0L-Ztutqxk';

const oldDb = createClient(OLD_URL, OLD_KEY);
const newDb = createClient(NEW_URL, NEW_KEY);

async function migrateData() {
  console.log("Mulai memigrasikan data...");

  // 1. Migrasi Shipping Addresses
  console.log("\nMengambil data Shipping Addresses dari DB Lama...");
  const { data: addresses, error: errAddr } = await oldDb.from('shipping_addresses').select('*');
  if (errAddr) {
    console.error("Gagal mengambil alamat:", errAddr.message);
  } else if (addresses && addresses.length > 0) {
    console.log(`Ditemukan ${addresses.length} alamat. Menyimpan ke DB Baru...`);
    const { error: errInsAddr } = await newDb.from('shipping_addresses').upsert(addresses);
    if (errInsAddr) console.error("Gagal menyimpan alamat:", errInsAddr.message);
    else console.log("Berhasil memigrasikan Shipping Addresses!");
  }

  // 2. Migrasi Delivery Notes
  console.log("\nMengambil data Delivery Notes dari DB Lama...");
  const { data: notes, error: errNotes } = await oldDb.from('delivery_notes').select('*');
  if (errNotes) {
    console.error("Gagal mengambil Surat Jalan:", errNotes.message);
  } else if (notes && notes.length > 0) {
    console.log(`Ditemukan ${notes.length} Surat Jalan. Menyimpan ke DB Baru...`);
    const { error: errInsNotes } = await newDb.from('delivery_notes').upsert(notes);
    if (errInsNotes) console.error("Gagal menyimpan Surat Jalan:", errInsNotes.message);
    else console.log("Berhasil memigrasikan Delivery Notes!");
  }

  // 3. (Opsional) Migrasi Admins / Users agar bisa login
  console.log("\nMengambil data Admins dari DB Lama...");
  const { data: admins, error: errAdmins } = await oldDb.from('admins').select('*');
  if (errAdmins) {
    console.error("Gagal mengambil Admins:", errAdmins.message);
  } else if (admins && admins.length > 0) {
    console.log(`Ditemukan ${admins.length} Admin. Menyimpan ke DB Baru...`);
    const { error: errInsAdmins } = await newDb.from('admins').upsert(admins);
    if (errInsAdmins) console.error("Gagal menyimpan Admins:", errInsAdmins.message);
    else console.log("Berhasil memigrasikan Admins!");
  }

  // 4. Migrasi Users (Dibutuhkan untuk login)
  console.log("\nMengambil data Users dari DB Lama...");
  const { data: users, error: errUsers } = await oldDb.from('users').select('*');
  if (errUsers) {
    console.error("Gagal mengambil Users:", errUsers.message);
  } else if (users && users.length > 0) {
    console.log(`Ditemukan ${users.length} User. Menyimpan ke DB Baru...`);
    const { error: errInsUsers } = await newDb.from('users').upsert(users);
    if (errInsUsers) console.error("Gagal menyimpan Users:", errInsUsers.message);
    else console.log("Berhasil memigrasikan Users!");
  }

  console.log("\nSelesai!");
}

migrateData();
