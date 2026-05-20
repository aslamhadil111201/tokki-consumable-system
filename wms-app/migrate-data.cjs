
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const db = JSON.parse(fs.readFileSync('../../wms-backend/db.json'));

async function migrate() {
  console.log("Memulai migrasi data ke Supabase...");
  
  // 1. Users
  if (db.users?.length) {
    const { error } = await supabase.from('users').insert(db.users);
    if (error) console.error("Error users:", error.message);
    else console.log("✓ Users bermigrasi");
  }

  // 2. Admins, Depts, Employees, WorkOrders
  const master = [
    { table: 'admins', data: db.admins },
    { table: 'departments', data: db.departments },
    { table: 'employees', data: db.employees },
    { table: 'workOrders', data: db.workOrders }
  ];
  for (const m of master) {
    if (m.data?.length) {
      const { error } = await supabase.from(m.table).insert(m.data);
      if (error) console.error(`Error ${m.table}:`, error.message);
      else console.log(`✓ ${m.table} bermigrasi`);
    }
  }

  // 3. Items
  if (db.items?.length) {
    const itemsToInsert = db.items.map(({hargaAwal, ...rest}) => rest);
    const { error } = await supabase.from('items').insert(itemsToInsert);
    if (error) console.error("Error items:", error.message);
    else console.log("✓ Items bermigrasi");
  }

  // 4. Receives
  if (db.receives?.length) {
    const { error } = await supabase.from('receives').insert(db.receives);
    if (error) console.error("Error receives:", error.message);
    else console.log("✓ Receives bermigrasi");
  }

  // 5. Transactions
  if (db.transactions?.length) {
    const trxToInsert = db.transactions.map(({approvalReason, type, movementType, totalCostOut, ...rest}) => rest);
    const { error } = await supabase.from('transactions').insert(trxToInsert);
    if (error) console.error("Error transactions:", error.message);
    else console.log("✓ Transactions bermigrasi");
  }

  console.log("Selesai!");
}

migrate();
