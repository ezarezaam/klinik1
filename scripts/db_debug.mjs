import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) {
    console.error('DIRECT_URL is not set');
    process.exit(1);
  }
  const c = new Client({ connectionString: url });
  await c.connect();
  console.log('Connected. Checking data...');
  const { rows: doctors } = await c.query('SELECT id,name,poli_id,deleted_at FROM public.doctors ORDER BY name');
  console.log('Doctors:', doctors);
  const { rows: polies } = await c.query('SELECT id,name,deleted_at FROM public.polies ORDER BY name');
  console.log('Polies:', polies);
  const { rows: docColumns } = await c.query(`
    SELECT column_name,data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='doctors'
    ORDER BY ordinal_position
  `);
  console.log('Doctors table columns:', docColumns);
  const { rows: policies } = await c.query(`
    SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('doctors','polies')
    ORDER BY tablename, policyname
  `);
  console.log('RLS policies (doctors/polies):', policies);
  // Ensure a default poli exists
  await c.query('INSERT INTO public.polies(name) VALUES ($1) ON CONFLICT(name) DO NOTHING', ['Umum']);
  const { rows: pr } = await c.query('SELECT id FROM public.polies WHERE name=$1', ['Umum']);
  const poliId = pr[0]?.id;
  if (poliId) {
    const { rows: ins } = await c.query('INSERT INTO public.doctors(name,poli_id) VALUES ($1,$2) RETURNING id', ['dr Debug', poliId]);
    console.log('Inserted doctor id:', ins[0]?.id);
  } else {
    console.log('No poli id found for "Umum"');
  }
  // Drugs check
  const { rows: drugs } = await c.query('SELECT id,name,unit,price,active,deleted_at FROM public.drugs ORDER BY name');
  console.log('Drugs:', drugs);
  await c.query('UPDATE public.drugs SET price=$1 WHERE name=$2', [12345, 'Alpara']);
  const { rows: afterPrice } = await c.query('SELECT name,price FROM public.drugs WHERE name=$1', ['Alpara']);
  console.log('After price update (Alpara):', afterPrice);
  const { rows: drugCols } = await c.query(`
    SELECT column_name,data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='drugs'
    ORDER BY ordinal_position
  `);
  console.log('Drugs table columns:', drugCols);
  const { rows: drIns } = await c.query(
    'INSERT INTO public.drugs(name,unit,price,active) VALUES ($1,$2,$3,true) ON CONFLICT(name) DO NOTHING RETURNING id',
    ['Obat Debug', 'Tablet', 1234]
  );
  if (drIns[0]?.id) console.log('Inserted drug id:', drIns[0].id);
  // Inspect Alpara stock and movements
  const { rows: vstock } = await c.query(
    "SELECT drug_id,name,total_qty,nearest_exp FROM public.v_drug_stock WHERE name ILIKE 'Alpara%' ORDER BY name"
  );
  console.log('v_drug_stock Alpara*:', vstock);
  const { rows: batches } = await c.query(
    `SELECT d.name, b.batch_code, b.qty, b.expires_at
     FROM public.drug_batches b
     JOIN public.drugs d ON d.id=b.drug_id
     WHERE d.name ILIKE 'Alpara%' AND b.deleted_at IS NULL
     ORDER BY d.name, b.batch_code`
  );
  console.log('drug_batches Alpara*:', batches);
  const { rows: purchases } = await c.query(
    `SELECT d.name, pi.qty, pi.batch_code, pi.expires_at
     FROM public.purchase_items pi
     JOIN public.drugs d ON d.id=pi.drug_id
     WHERE d.name ILIKE 'Alpara%'
     ORDER BY pi.created_at DESC
     LIMIT 20`
  );
  console.log('purchase_items Alpara*:', purchases);
  const { rows: outs } = await c.query(
    `SELECT d.name, m.qty, m.unit, mr.date
     FROM public.medical_record_medications m
     JOIN public.drugs d ON d.id=m.drug_id
     JOIN public.medical_records mr ON mr.id=m.record_id
     WHERE d.name ILIKE 'Alpara%'
     ORDER BY mr.date DESC
     LIMIT 20`
  );
  console.log('medications OUT Alpara*:', outs);
  const { rows: sumOut } = await c.query(
    `SELECT d.name, COALESCE(SUM(m.qty),0) AS total_out
     FROM public.medical_record_medications m
     JOIN public.drugs d ON d.id=m.drug_id
     WHERE d.name ILIKE 'Alpara%'
     GROUP BY d.name
     ORDER BY d.name`
  );
  console.log('Total OUT Alpara*:', sumOut);
  const { rows: movs } = await c.query(
    `SELECT movement, quantity, source, source_id, batch_id
     FROM public.inventory_movements
     WHERE drug_id = (SELECT id FROM public.drugs WHERE name='Alpara' LIMIT 1)
     ORDER BY created_at`
  );
  console.log('inventory_movements Alpara:', movs);
  const { rows: mrmLarge } = await c.query(
    `SELECT mr.id AS record_id, d.name, m.qty, m.unit
     FROM public.medical_record_medications m
     JOIN public.drugs d ON d.id=m.drug_id
     JOIN public.medical_records mr ON mr.id=m.record_id
     WHERE d.name='Alpara' AND m.qty >= 10
     ORDER BY mr.date DESC`
  );
  console.log('medical_record_medications (qty>=10, Alpara):', mrmLarge);
  await c.end();
}

main().catch((e) => {
  console.error('Debug failed:', e.message);
  process.exitCode = 1;
});
