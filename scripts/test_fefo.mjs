import 'dotenv/config';
import { Client } from 'pg';

const url = process.env.DIRECT_URL;
if (!url) {
  console.error('DIRECT_URL is not set in .env');
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString: url });
  await client.connect();
  console.log('Connected. Running FEFO test...');
  try {
    // Ensure drug exists
    const drugName = 'Paracetamol';
    let r = await client.query('SELECT id FROM drugs WHERE name=$1 AND deleted_at IS NULL', [drugName]);
    let drugId = r.rows[0]?.id;
    if (!drugId) {
      r = await client.query(
        'INSERT INTO drugs(name,unit,price,min_stock) VALUES($1,$2,$3,$4) RETURNING id',
        [drugName, 'Tablet', 0, 0]
      );
      drugId = r.rows[0].id;
      console.log('Inserted drug', drugId);
    } else {
      console.log('Using existing drug', drugId);
    }

    // Create an expense and two purchase items (two batches)
    r = await client.query(
      'INSERT INTO finance_expenses(date,category_name,description,amount) VALUES($1,$2,$3,$4) RETURNING id',
      ['2025-12-31', 'Pembelian Obat', 'Test FEFO purchase', 10000]
    );
    const expenseId = r.rows[0].id;
    await client.query(
      'INSERT INTO purchase_items(expense_id,drug_id,qty,batch_code,expires_at) VALUES($1,$2,$3,$4,$5)',
      [expenseId, drugId, 10, 'B1', '2025-01-31']
    );
    await client.query(
      'INSERT INTO purchase_items(expense_id,drug_id,qty,batch_code,expires_at) VALUES($1,$2,$3,$4,$5)',
      [expenseId, drugId, 10, 'B2', '2026-06-30']
    );
    console.log('Inserted purchase items for batches B1 (2025-01-31) and B2 (2026-06-30)');

    // Upsert patient
    r = await client.query(
      'INSERT INTO patients(nrm,name) VALUES($1,$2) ON CONFLICT (nrm) DO UPDATE SET name=excluded.name RETURNING id',
      ['NRM-TEST-001', 'Test Patient']
    );
    const patientId = r.rows[0].id;

    // Create medical record and consume 12 units -> FEFO should consume B1(10) then B2(2)
    r = await client.query(
      'INSERT INTO medical_records(patient_id,date,diagnosis,action,complaint,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [patientId, '2025-12-31', 'Test', 'Test', '-', 'in_progress']
    );
    const recordId = r.rows[0].id;
    await client.query(
      'INSERT INTO medical_record_medications(record_id,drug_id,qty,unit,price) VALUES($1,$2,$3,$4,$5)',
      [recordId, drugId, 12, 'tablet', 0]
    );
    console.log('Inserted medical record medication with qty=12');

    // Check batches after FEFO consumption
    r = await client.query(
      'SELECT batch_code, qty, expires_at FROM drug_batches WHERE drug_id=$1 AND deleted_at IS NULL ORDER BY batch_code',
      [drugId]
    );
    console.log('Batches after consumption:', r.rows);

    // Check inventory movements
    r = await client.query(
      "SELECT movement, batch_id, quantity FROM inventory_movements WHERE drug_id=$1 ORDER BY created_at DESC LIMIT 5",
      [drugId]
    );
    console.log('Recent movements:', r.rows);
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();

