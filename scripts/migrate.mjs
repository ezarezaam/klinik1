import 'dotenv/config';
import { Client } from 'pg';

const url = process.env.DIRECT_URL;
if (!url) {
  console.warn('DIRECT_URL is not set in .env. Skipping migration (app will still run).');
  process.exit(0);
}

const sql = `
-- Enable required extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT INSERT, UPDATE ON TABLE patients TO anon;
GRANT INSERT, UPDATE ON TABLE patients TO authenticated;
GRANT INSERT, UPDATE ON TABLE registrations TO anon;
GRANT INSERT, UPDATE ON TABLE registrations TO authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'polies','doctors','suppliers','drugs','drug_batches','inventory_movements',
    'medical_records','medical_record_medications',
    'expense_categories','finance_expenses','purchase_items','finance_incomes',
    'invoices','diagnoses','procedures','administrations'
  ]
  LOOP
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON %I TO anon;', t);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON %I TO authenticated;', t);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT, UPDATE, DELETE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Updated-at trigger function (idempotent replace)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create enum types if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registration_status') THEN
    CREATE TYPE registration_status AS ENUM ('antrian','batal','selesai');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'record_status') THEN
    CREATE TYPE record_status AS ENUM ('completed','in_progress','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_type') THEN
    CREATE TYPE movement_type AS ENUM ('IN','OUT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_source') THEN
    CREATE TYPE movement_source AS ENUM ('purchase','prescription','adjustment');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('open','partial','paid','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_status') THEN
    CREATE TYPE expense_status AS ENUM ('draft','selesai');
  END IF;
END$$;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(50) UNIQUE NOT NULL,
  full_name varchar(150) NOT NULL,
  email varchar(150) UNIQUE,
  phone varchar(30),
  role varchar(50) NOT NULL,
  password_hash text,
  active boolean NOT NULL DEFAULT true,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_set_updated_at') THEN
    CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
 
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS last_login timestamptz;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION login_user(p_email text, p_password text)
RETURNS TABLE(id uuid, email text, full_name text, role text) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH u AS (
    SELECT users.id
    FROM users
    WHERE deleted_at IS NULL
      AND users.email = p_email
      AND password_hash = crypt(p_password, password_hash)
    LIMIT 1
  )
  UPDATE users
  SET last_login = NOW()
  FROM u
  WHERE users.id = u.id
  RETURNING users.id, users.email::text, users.full_name::text, users.role::text;
END;
$$;

DO $$
BEGIN
  INSERT INTO users (username, full_name, email, role, password_hash)
  VALUES ('admin', 'Administrator', 'admin@klinik.local', 'admin', crypt('admin123', gen_salt('bf')))
  ON CONFLICT (username) DO NOTHING;
END $$;

-- User management RPCs
CREATE OR REPLACE FUNCTION create_user(
  p_username text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_role text,
  p_password text
)
RETURNS TABLE(id uuid, username text, email text, full_name text, role text, active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO users (username, full_name, email, phone, role, password_hash, active)
  VALUES (p_username, p_full_name, p_email, p_phone, p_role, crypt(p_password, gen_salt('bf')), true)
  RETURNING users.id INTO v_id;
  RETURN QUERY
  SELECT u.id, u.username::text, u.email::text, u.full_name::text, u.role::text, u.active
  FROM users u
  WHERE u.id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_user(
  p_id uuid,
  p_username text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_role text
)
RETURNS TABLE(id uuid, username text, email text, full_name text, role text, active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET username = COALESCE(p_username, username),
      full_name = COALESCE(p_full_name, full_name),
      email = COALESCE(p_email, email),
      phone = COALESCE(p_phone, phone),
      role = COALESCE(p_role, role)
  WHERE users.id = p_id;
  RETURN QUERY
  SELECT u.id, u.username::text, u.email::text, u.full_name::text, u.role::text, u.active
  FROM users u
  WHERE u.id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION set_user_password(
  p_id uuid,
  p_password text
)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET password_hash = crypt(p_password, gen_salt('bf'))
  WHERE users.id = p_id;
  RETURN QUERY SELECT p_id;
END;
$$;

CREATE OR REPLACE FUNCTION set_user_active(
  p_id uuid,
  p_active boolean
)
RETURNS TABLE(id uuid, active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET active = COALESCE(p_active, users.active)
  WHERE users.id = p_id;
  RETURN QUERY SELECT p_id, (SELECT users.active FROM users WHERE users.id = p_id) AS active;
END;
$$;

CREATE OR REPLACE FUNCTION delete_user_soft(
  p_id uuid
)
RETURNS TABLE(id uuid, deleted_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET deleted_at = NOW()
  WHERE users.id = p_id AND users.deleted_at IS NULL;
  RETURN QUERY SELECT p_id, (SELECT deleted_at FROM users WHERE users.id = p_id);
END;
$$;

GRANT EXECUTE ON FUNCTION create_user(text, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION update_user(uuid, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION set_user_password(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION set_user_active(uuid, boolean) TO anon;
GRANT EXECUTE ON FUNCTION delete_user_soft(uuid) TO anon;

-- RLS: allow anon delete and soft-delete for medical records tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'medical_records' AND policyname = 'anon_delete_medical_records') THEN
    CREATE POLICY anon_delete_medical_records ON medical_records FOR DELETE TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'medical_record_medications' AND policyname = 'anon_delete_mrm') THEN
    CREATE POLICY anon_delete_mrm ON medical_record_medications FOR DELETE TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'medical_records' AND policyname = 'anon_soft_delete_update_medical_records') THEN
    CREATE POLICY anon_soft_delete_update_medical_records ON medical_records FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'medical_record_medications' AND policyname = 'anon_soft_delete_update_mrm') THEN
    CREATE POLICY anon_soft_delete_update_mrm ON medical_record_medications FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Polies
CREATE TABLE IF NOT EXISTS polies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) UNIQUE NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'polies_set_updated_at') THEN
    CREATE TRIGGER polies_set_updated_at BEFORE UPDATE ON polies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Align polies with app needs: add code column and unique constraint
ALTER TABLE IF EXISTS polies ADD COLUMN IF NOT EXISTS code varchar(50);
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'polies_code_unique'
  ) THEN
    ALTER TABLE polies ADD CONSTRAINT polies_code_unique UNIQUE (code);
  END IF;
END $$;

-- Backfill codes for existing polies (assign sequential PL-000001+ where code is NULL)
WITH existing_max AS (
  SELECT COALESCE(MAX((regexp_replace(code, '^PL-', ''))::int), 0) AS max_num
  FROM polies
  WHERE code ~ '^PL-\\d+$'
),
to_fill AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, name, id) AS rn
  FROM polies
  WHERE code IS NULL
)
UPDATE polies p
SET code = 'PL-' || LPAD((e.max_num + t.rn)::text, 6, '0')
FROM existing_max e, to_fill t
WHERE p.id = t.id;

-- Doctors
CREATE TABLE IF NOT EXISTS doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(150) NOT NULL,
  phone varchar(30),
  email varchar(150),
  poli_id uuid REFERENCES polies(id),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
-- Align schema with UI: add SIP number column if missing
ALTER TABLE IF EXISTS doctors ADD COLUMN IF NOT EXISTS sip varchar(100);
-- Active status instead of hard delete
ALTER TABLE IF EXISTS doctors ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS doctors_poli_id_idx ON doctors(poli_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'doctors_set_updated_at') THEN
    CREATE TRIGGER doctors_set_updated_at BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(150) NOT NULL,
  contact varchar(150),
  phone varchar(30),
  email varchar(150),
  address text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'suppliers_set_updated_at') THEN
    CREATE TRIGGER suppliers_set_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Drugs
CREATE TABLE IF NOT EXISTS drugs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(150) UNIQUE NOT NULL,
  unit varchar(50) NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  supplier_id uuid REFERENCES suppliers(id),
  min_stock integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
-- Active status for drugs
ALTER TABLE IF EXISTS drugs ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
-- Default dose info for drugs (optional)
ALTER TABLE IF EXISTS drugs ADD COLUMN IF NOT EXISTS dose varchar(100);
ALTER TABLE IF EXISTS drugs ADD COLUMN IF NOT EXISTS dose_unit varchar(50);
ALTER TABLE IF EXISTS drugs ADD COLUMN IF NOT EXISTS brand varchar(100);
ALTER TABLE IF EXISTS drugs ADD COLUMN IF NOT EXISTS type varchar(100);
ALTER TABLE IF EXISTS drugs ADD COLUMN IF NOT EXISTS indication text;
ALTER TABLE IF EXISTS drugs ADD COLUMN IF NOT EXISTS kandungan text;
CREATE INDEX IF NOT EXISTS drugs_supplier_id_idx ON drugs(supplier_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'drugs_set_updated_at') THEN
    CREATE TRIGGER drugs_set_updated_at BEFORE UPDATE ON drugs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

INSERT INTO drugs (name, unit, price, min_stock, active, type, dose, dose_unit, indication, kandungan)
VALUES
('Paracetamol', 'Tablet', 0, 0, true, 'Analgesik/Antipiretik', '500', 'mg', 'Demam, nyeri', 'Paracetamol'),
('Ibuprofen', 'Tablet', 0, 0, true, 'NSAID', '200', 'mg', 'Nyeri, inflamasi', 'Ibuprofen'),
('Asam Mefenamat', 'Tablet', 0, 0, true, 'NSAID', '500', 'mg', 'Nyeri', 'Mefenamat'),
('Diclofenac', 'Tablet', 0, 0, true, 'NSAID', '50', 'mg', 'Nyeri, inflamasi', 'Diclofenac'),
('Amoxicillin', 'Kapsul', 0, 0, true, 'Antibiotik', '500', 'mg', 'Infeksi bakteri', 'Amoxicillin'),
('Ampicillin', 'Kapsul', 0, 0, true, 'Antibiotik', '500', 'mg', 'Infeksi bakteri', 'Ampicillin'),
('Ciprofloxacin', 'Tablet', 0, 0, true, 'Antibiotik', '500', 'mg', 'Infeksi bakteri', 'Ciprofloxacin'),
('Cotrimoxazole', 'Tablet', 0, 0, true, 'Antibiotik', NULL, NULL, 'Infeksi bakteri', 'Sulfamethoxazole + Trimethoprim'),
('Metronidazole', 'Tablet', 0, 0, true, 'Antiprotozoa/Antibiotik', '500', 'mg', 'Infeksi protozoa/bakteri anaerob', 'Metronidazole'),
('Omeprazole', 'Kapsul', 0, 0, true, 'PPI', '20', 'mg', 'Gastritis, GERD', 'Omeprazole'),
('Famotidine', 'Tablet', 0, 0, true, 'H2 Blocker', '20', 'mg', 'Dyspepsia, ulkus', 'Famotidine'),
('Antasida DO', 'Tablet', 0, 0, true, 'Antasida', NULL, NULL, 'Dyspepsia', 'Aluminium hidroksida + Magnesium hidroksida + Simetikon'),
('Loperamide', 'Tablet', 0, 0, true, 'Antidiare', '2', 'mg', 'Diare akut', 'Loperamide'),
('Domperidone', 'Tablet', 0, 0, true, 'Antiemetik', '10', 'mg', 'Mual, muntah', 'Domperidone'),
('Metoclopramide', 'Tablet', 0, 0, true, 'Antiemetik', '10', 'mg', 'Mual, muntah', 'Metoclopramide'),
('Chlorpheniramine Maleate', 'Tablet', 0, 0, true, 'Antihistamin', '4', 'mg', 'Alergi, flu', 'Chlorpheniramine Maleate'),
('Cetirizine', 'Tablet', 0, 0, true, 'Antihistamin', '10', 'mg', 'Alergi', 'Cetirizine'),
('Loratadine', 'Tablet', 0, 0, true, 'Antihistamin', '10', 'mg', 'Alergi', 'Loratadine'),
('Dextromethorphan HBr', 'Sirup', 0, 0, true, 'Antitusif', NULL, NULL, 'Batuk kering', 'Dextromethorphan Hydrobromide'),
('Ambroxol', 'Tablet', 0, 0, true, 'Ekspektoran', '30', 'mg', 'Batuk berdahak', 'Ambroxol'),
('Salbutamol', 'Tablet', 0, 0, true, 'Bronkodilator', '4', 'mg', 'Asma, bronkospasme', 'Salbutamol'),
('Amlodipine', 'Tablet', 0, 0, true, 'Antihipertensi', '5', 'mg', 'Hipertensi', 'Amlodipine'),
('Captopril', 'Tablet', 0, 0, true, 'Antihipertensi', '25', 'mg', 'Hipertensi', 'Captopril'),
('Metformin', 'Tablet', 0, 0, true, 'Antidiabetik', '500', 'mg', 'Diabetes tipe 2', 'Metformin'),
('Ferrous Sulfate', 'Tablet', 0, 0, true, 'Suplemen', '200', 'mg', 'Anemia defisiensi besi', 'Ferrous Sulfate'),
('Folic Acid', 'Tablet', 0, 0, true, 'Vitamin', '1', 'mg', 'Suplementasi kehamilan', 'Folic Acid'),
('Vitamin B Kompleks', 'Tablet', 0, 0, true, 'Vitamin', NULL, NULL, 'Suplementasi', 'Vitamin B Complex'),
('Zinc', 'Tablet', 0, 0, true, 'Suplemen', '20', 'mg', 'Diare anak, suplementasi', 'Zinc Sulfate')
ON CONFLICT (name) DO UPDATE
SET unit = EXCLUDED.unit,
    min_stock = EXCLUDED.min_stock,
    active = EXCLUDED.active,
    type = EXCLUDED.type,
    dose = EXCLUDED.dose,
    dose_unit = EXCLUDED.dose_unit,
    indication = EXCLUDED.indication,
    kandungan = EXCLUDED.kandungan;

INSERT INTO drugs (name, unit, price, min_stock, active, type, dose, dose_unit, indication, kandungan)
VALUES
('Alpara', 'Tablet', 0, 0, true, 'Analgesik/Antipiretik', '500', 'mg', 'Demam, nyeri', 'Paracetamol'),
('Paratusin', 'Tablet', 0, 0, true, 'Flu & Batuk', NULL, NULL, 'Gejala flu dan batuk', 'Paracetamol + Pseudoephedrine HCl + Dextromethorphan HBr + Chlorpheniramine Maleate'),
('Sanmol', 'Tablet', 0, 0, true, 'Analgesik/Antipiretik', '500', 'mg', 'Demam, nyeri', 'Paracetamol'),
('Mixagrip', 'Tablet', 0, 0, true, 'Flu & Batuk', NULL, NULL, 'Gejala flu', 'Paracetamol + Phenylephrine HCl + Chlorpheniramine Maleate'),
('Decolsin', 'Tablet', 0, 0, true, 'Flu & Batuk', NULL, NULL, 'Gejala flu dan batuk', 'Paracetamol + Pseudoephedrine HCl + Dextromethorphan HBr + Chlorpheniramine Maleate')
ON CONFLICT (name) DO UPDATE
SET unit = EXCLUDED.unit,
    min_stock = EXCLUDED.min_stock,
    active = EXCLUDED.active,
    type = EXCLUDED.type,
    dose = EXCLUDED.dose,
    dose_unit = EXCLUDED.dose_unit,
    indication = EXCLUDED.indication,
    kandungan = EXCLUDED.kandungan;

-- Drug Batches
CREATE TABLE IF NOT EXISTS drug_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id uuid NOT NULL REFERENCES drugs(id),
  batch_code varchar(100),
  qty integer NOT NULL CHECK (qty >= 0),
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS drug_batches_drug_id_idx ON drug_batches(drug_id);
CREATE INDEX IF NOT EXISTS drug_batches_expires_at_idx ON drug_batches(expires_at);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'drug_batches_set_updated_at') THEN
    CREATE TRIGGER drug_batches_set_updated_at BEFORE UPDATE ON drug_batches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Inventory Movements
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id uuid NOT NULL REFERENCES drugs(id),
  batch_id uuid REFERENCES drug_batches(id),
  movement movement_type NOT NULL,
  source movement_source NOT NULL,
  source_id uuid,
  quantity integer NOT NULL CHECK (quantity > 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS inventory_movements_drug_idx ON inventory_movements(drug_id);
CREATE INDEX IF NOT EXISTS inventory_movements_batch_idx ON inventory_movements(batch_id);

-- Manual stock adjustment RPC
CREATE OR REPLACE FUNCTION adjust_stock(
  p_drug_id uuid,
  p_quantity integer,
  p_movement movement_type,
  p_batch_code text DEFAULT NULL,
  p_expires date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_id uuid;
  v_auto_code text;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN;
  END IF;

  IF p_movement = 'IN' THEN
    IF p_batch_code IS NOT NULL THEN
      SELECT id INTO v_batch_id
      FROM drug_batches
      WHERE drug_id = p_drug_id AND batch_code = p_batch_code AND deleted_at IS NULL
      LIMIT 1;
      IF v_batch_id IS NULL THEN
        INSERT INTO drug_batches (drug_id, batch_code, qty, expires_at)
        VALUES (p_drug_id, p_batch_code, 0, p_expires)
        RETURNING id INTO v_batch_id;
      ELSE
        IF p_expires IS NOT NULL THEN
          UPDATE drug_batches SET expires_at = p_expires WHERE id = v_batch_id;
        END IF;
      END IF;
    ELSE
      SELECT id INTO v_batch_id
      FROM drug_batches
      WHERE drug_id = p_drug_id AND deleted_at IS NULL
      ORDER BY expires_at NULLS LAST
      LIMIT 1;
      IF v_batch_id IS NULL THEN
        v_auto_code := 'ADJ-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(p_drug_id::text, 1, 8);
        INSERT INTO drug_batches (drug_id, batch_code, qty, expires_at)
        VALUES (p_drug_id, v_auto_code, 0, p_expires)
        RETURNING id INTO v_batch_id;
      END IF;
    END IF;
    UPDATE drug_batches SET qty = qty + p_quantity WHERE id = v_batch_id;
    INSERT INTO inventory_movements (drug_id, batch_id, movement, source, quantity)
    VALUES (p_drug_id, v_batch_id, 'IN', 'adjustment', p_quantity);
  ELSE
    IF p_batch_code IS NOT NULL THEN
      SELECT id INTO v_batch_id
      FROM drug_batches
      WHERE drug_id = p_drug_id AND batch_code = p_batch_code AND deleted_at IS NULL
      LIMIT 1;
    END IF;
    IF v_batch_id IS NULL THEN
      SELECT id INTO v_batch_id
      FROM drug_batches
      WHERE drug_id = p_drug_id AND deleted_at IS NULL
      ORDER BY expires_at NULLS LAST
      LIMIT 1;
    END IF;
    IF v_batch_id IS NULL THEN
      RAISE EXCEPTION 'No batch available for OUT';
    END IF;
    UPDATE drug_batches SET qty = GREATEST(0, qty - p_quantity) WHERE id = v_batch_id;
    INSERT INTO inventory_movements (drug_id, batch_id, movement, source, quantity)
    VALUES (p_drug_id, v_batch_id, 'OUT', 'adjustment', p_quantity);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION adjust_stock(uuid, integer, movement_type, text, date) TO anon;

-- Patients
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nrm varchar(50) UNIQUE NOT NULL,
  name varchar(150) NOT NULL,
  primary_poli_id uuid REFERENCES polies(id),
  birth_date date,
  address text,
  phone varchar(30),
  email varchar(150),
  parent_name varchar(150),
  parent_phone varchar(30),
  parent_email varchar(150),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS patients_primary_poli_id_idx ON patients(primary_poli_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'patients_set_updated_at') THEN
    CREATE TRIGGER patients_set_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Registrations
CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  queue integer NOT NULL,
  patient_id uuid NOT NULL REFERENCES patients(id),
  poli_id uuid REFERENCES polies(id),
  doctor_id uuid REFERENCES doctors(id),
  complaint text,
  status registration_status NOT NULL DEFAULT 'antrian',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS registrations_date_idx ON registrations(date);
CREATE INDEX IF NOT EXISTS registrations_patient_idx ON registrations(patient_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'registrations_set_updated_at') THEN
    CREATE TRIGGER registrations_set_updated_at BEFORE UPDATE ON registrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Medical Records
CREATE TABLE IF NOT EXISTS medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  date date NOT NULL,
  poli_id uuid REFERENCES polies(id),
  doctor_id uuid REFERENCES doctors(id),
  diagnosis text,
  action text,
  complaint text,
  status record_status NOT NULL DEFAULT 'in_progress',
  cost numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS medical_records_patient_idx ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS medical_records_date_idx ON medical_records(date);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'medical_records_set_updated_at') THEN
    CREATE TRIGGER medical_records_set_updated_at BEFORE UPDATE ON medical_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Medical Record Medications
CREATE TABLE IF NOT EXISTS medical_record_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  drug_id uuid REFERENCES drugs(id),
  dose varchar(100),
  qty integer NOT NULL DEFAULT 0 CHECK (qty >= 0),
  unit varchar(50),
  price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS mrm_record_idx ON medical_record_medications(record_id);
CREATE INDEX IF NOT EXISTS mrm_drug_idx ON medical_record_medications(drug_id);

-- Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'expense_categories_set_updated_at') THEN
    CREATE TRIGGER expense_categories_set_updated_at BEFORE UPDATE ON expense_categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Finance Expenses
CREATE TABLE IF NOT EXISTS finance_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  category_id uuid REFERENCES expense_categories(id),
  category_name varchar(100),
  description text NOT NULL,
  vendor varchar(150),
  doctor_id uuid REFERENCES doctors(id),
  doctor_name varchar(150),
  amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS finance_expenses_date_idx ON finance_expenses(date);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'finance_expenses_set_updated_at') THEN
    CREATE TRIGGER finance_expenses_set_updated_at BEFORE UPDATE ON finance_expenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
ALTER TABLE IF EXISTS finance_expenses ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES doctors(id);
ALTER TABLE IF EXISTS finance_expenses ADD COLUMN IF NOT EXISTS doctor_name varchar(150);
ALTER TABLE IF EXISTS finance_expenses ADD COLUMN IF NOT EXISTS status expense_status NOT NULL DEFAULT 'draft';

-- Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES finance_expenses(id) ON DELETE CASCADE,
  drug_id uuid NOT NULL REFERENCES drugs(id),
  qty integer NOT NULL CHECK (qty > 0),
  batch_code varchar(100),
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS purchase_items_expense_idx ON purchase_items(expense_id);
CREATE INDEX IF NOT EXISTS purchase_items_drug_idx ON purchase_items(drug_id);
ALTER TABLE IF EXISTS purchase_items ADD COLUMN IF NOT EXISTS unit_price numeric(12,2);
ALTER TABLE IF EXISTS purchase_items ADD COLUMN IF NOT EXISTS tax numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS purchase_items ADD COLUMN IF NOT EXISTS item_total numeric(12,2) NOT NULL DEFAULT 0;

-- Finance Incomes
CREATE TABLE IF NOT EXISTS finance_incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  description text NOT NULL,
  patient_id uuid REFERENCES patients(id),
  amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS finance_incomes_date_idx ON finance_incomes(date);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'finance_incomes_set_updated_at') THEN
    CREATE TRIGGER finance_incomes_set_updated_at BEFORE UPDATE ON finance_incomes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_record_id uuid UNIQUE REFERENCES medical_records(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id),
  total_cost numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'open',
  issued_at timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS invoices_patient_idx ON invoices(patient_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'invoices_set_updated_at') THEN
    CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Diagnoses
CREATE TABLE IF NOT EXISTS diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50),
  name varchar(200) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'diagnoses_set_updated_at') THEN
    CREATE TRIGGER diagnoses_set_updated_at BEFORE UPDATE ON diagnoses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnoses_code_unique'
  ) THEN
    ALTER TABLE diagnoses ADD CONSTRAINT diagnoses_code_unique UNIQUE (code);
  END IF;
END $$;

-- Procedures
CREATE TABLE IF NOT EXISTS procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(150) NOT NULL,
  default_cost numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'procedures_set_updated_at') THEN
    CREATE TRIGGER procedures_set_updated_at BEFORE UPDATE ON procedures FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Align procedures with app needs: add code & active columns
ALTER TABLE IF EXISTS procedures ADD COLUMN IF NOT EXISTS code varchar(50);
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'procedures_code_unique'
  ) THEN
    ALTER TABLE procedures ADD CONSTRAINT procedures_code_unique UNIQUE (code);
  END IF;
END $$;
ALTER TABLE IF EXISTS procedures ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE IF EXISTS procedures ADD COLUMN IF NOT EXISTS category varchar(30) NOT NULL DEFAULT 'tindakan';
UPDATE procedures SET category = 'tindakan' WHERE category IS NULL;
CREATE INDEX IF NOT EXISTS procedures_category_idx ON procedures(category);

INSERT INTO procedures (code, name, default_cost, active, category)
VALUES
('TD-000001','Konsultasi Dokter Umum',50000,true,'tindakan'),
('TD-000002','Tindakan Rawat Luka',75000,true,'tindakan'),
('TD-000003','Injeksi Intramuskular',30000,true,'tindakan'),
('TD-000004','Injeksi Intravenous',40000,true,'tindakan'),
('TD-000005','Nebulizer',50000,true,'tindakan'),
('TD-000006','Pemasangan Infus',60000,true,'tindakan')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    default_cost = EXCLUDED.default_cost,
    active = EXCLUDED.active,
    category = EXCLUDED.category;

INSERT INTO procedures (code, name, default_cost, active, category)
VALUES
('PN-000001','Laboratorium Hematologi Lengkap',100000,true,'penunjang'),
('PN-000002','Gula Darah Sewaktu',30000,true,'penunjang'),
('PN-000003','Kolesterol Total',35000,true,'penunjang'),
('PN-000004','Urinalisis',45000,true,'penunjang'),
('PN-000005','Rontgen Thorax',150000,true,'penunjang'),
('PN-000006','USG Abdomen',200000,true,'penunjang'),
('PN-000007','Tes Antigen',50000,true,'penunjang'),
('PN-000008','Tes PCR',250000,true,'penunjang')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    default_cost = EXCLUDED.default_cost,
    active = EXCLUDED.active,
    category = EXCLUDED.category;

-- Administrations
CREATE TABLE IF NOT EXISTS administrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(150) NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz,
  created_by uuid REFERENCES users(id)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'administrations_set_updated_at') THEN
    CREATE TRIGGER administrations_set_updated_at BEFORE UPDATE ON administrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- Align administrations with app needs: add code column and unique constraint
ALTER TABLE IF EXISTS administrations ADD COLUMN IF NOT EXISTS code varchar(50);
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'administrations_code_unique'
  ) THEN
    ALTER TABLE administrations ADD CONSTRAINT administrations_code_unique UNIQUE (code);
  END IF;
END $$;

-- Backfill codes for existing administrations (assign sequential ADM-000001+ where code is NULL)
WITH existing_max AS (
  SELECT COALESCE(MAX((regexp_replace(code, '^ADM-', ''))::int), 0) AS max_num
  FROM administrations
  WHERE code ~ '^ADM-\\d+$'
),
to_fill AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, name, id) AS rn
  FROM administrations
  WHERE code IS NULL
)
UPDATE administrations a
SET code = 'ADM-' || LPAD((e.max_num + t.rn)::text, 6, '0')
FROM existing_max e, to_fill t
WHERE a.id = t.id;

INSERT INTO administrations (code, name, amount)
VALUES
('ADM-000001','Administrasi Pasien',10000),
('ADM-000002','Registrasi',15000),
('ADM-000003','Kartu Berobat',5000),
('ADM-000004','Materai',10000),
('ADM-000005','Biaya Penanganan',20000)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    amount = EXCLUDED.amount;

-- Seed Default Expense Categories
INSERT INTO expense_categories (name)
VALUES ('Pembelian Obat'), ('Bayar Dokter'), ('Lainnya')
ON CONFLICT (name) DO NOTHING;

INSERT INTO diagnoses (code, name)
VALUES
('J00','Nasofaringitis akut (common cold)'),
('R50','Demam tidak spesifik'),
('K29','Gastritis'),
('J02','Faringitis akut'),
('J20','Bronkitis akut'),
('A09','Gastroenteritis tanpa spesifikasi')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name;

-- =========================
-- Inventory automation (Triggers)
-- =========================

-- Purchase -> create/update batch and movement IN
CREATE OR REPLACE FUNCTION fn_purchase_items_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_id uuid;
  v_code text;
  v_status expense_status;
BEGIN
  IF NEW.batch_code IS NULL THEN
    v_code := 'B-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(NEW.drug_id::text, 1, 8) || '-' || LPAD((floor(random() * 9000) + 1000)::text, 4, '0');
    UPDATE purchase_items SET batch_code = v_code WHERE id = NEW.id;
  ELSE
    v_code := NEW.batch_code;
  END IF;

  SELECT status INTO v_status FROM finance_expenses WHERE id = NEW.expense_id;
  IF v_status IS DISTINCT FROM 'selesai' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_batch_id
  FROM drug_batches
  WHERE drug_id = NEW.drug_id AND batch_code = v_code AND deleted_at IS NULL
  LIMIT 1;

  IF v_batch_id IS NULL THEN
    INSERT INTO drug_batches (drug_id, batch_code, qty, expires_at, created_by)
    VALUES (NEW.drug_id, v_code, NEW.qty, NEW.expires_at, NEW.created_by)
    RETURNING id INTO v_batch_id;
  ELSE
    UPDATE drug_batches
    SET qty = qty + NEW.qty,
        expires_at = COALESCE(expires_at, NEW.expires_at)
    WHERE id = v_batch_id;
  END IF;

  INSERT INTO inventory_movements (drug_id, batch_id, movement, source, source_id, quantity, created_by)
  VALUES (NEW.drug_id, v_batch_id, 'IN', 'purchase', NEW.expense_id, NEW.qty, NEW.created_by);

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'purchase_items_after_insert') THEN
    CREATE TRIGGER purchase_items_after_insert
    AFTER INSERT ON purchase_items
    FOR EACH ROW
    EXECUTE FUNCTION fn_purchase_items_after_insert();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION fn_finance_expenses_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pi RECORD;
  v_batch_id uuid;
  v_code text;
BEGIN
  IF NEW.status = 'selesai' AND (OLD.status IS DISTINCT FROM 'selesai') THEN
    FOR pi IN
      SELECT id, drug_id, qty, batch_code, expires_at, created_by
      FROM purchase_items
      WHERE expense_id = NEW.id AND deleted_at IS NULL
    LOOP
      IF pi.batch_code IS NULL THEN
        v_code := 'B-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(pi.drug_id::text, 1, 8) || '-' || LPAD((floor(random() * 9000) + 1000)::text, 4, '0');
        UPDATE purchase_items SET batch_code = v_code WHERE id = pi.id;
      ELSE
        v_code := pi.batch_code;
      END IF;
      SELECT id INTO v_batch_id
      FROM drug_batches
      WHERE drug_id = pi.drug_id AND batch_code = v_code AND deleted_at IS NULL
      LIMIT 1;
      IF v_batch_id IS NULL THEN
        INSERT INTO drug_batches (drug_id, batch_code, qty, expires_at, created_by)
        VALUES (pi.drug_id, v_code, pi.qty, pi.expires_at, pi.created_by)
        RETURNING id INTO v_batch_id;
      ELSE
        UPDATE drug_batches
        SET qty = qty + pi.qty,
            expires_at = COALESCE(expires_at, pi.expires_at)
        WHERE id = v_batch_id;
      END IF;
      INSERT INTO inventory_movements (drug_id, batch_id, movement, source, source_id, quantity, created_by)
      VALUES (pi.drug_id, v_batch_id, 'IN', 'purchase', NEW.id, pi.qty, pi.created_by);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'finance_expenses_after_update') THEN
    CREATE TRIGGER finance_expenses_after_update
    AFTER UPDATE ON finance_expenses
    FOR EACH ROW
    EXECUTE FUNCTION fn_finance_expenses_after_update();
  END IF;
END $$;

-- Prescription -> FEFO consume batches and movement OUT
CREATE OR REPLACE FUNCTION fn_medications_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining integer := COALESCE(NEW.qty, 0);
  v_take integer;
  v_batch RECORD;
BEGIN
  IF NEW.drug_id IS NULL OR v_remaining <= 0 THEN
    RETURN NEW;
  END IF;

  FOR v_batch IN
    SELECT id, qty
    FROM drug_batches
    WHERE drug_id = NEW.drug_id AND deleted_at IS NULL
    ORDER BY expires_at NULLS LAST
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_batch.qty, v_remaining);
    IF v_take > 0 THEN
      UPDATE drug_batches SET qty = qty - v_take WHERE id = v_batch.id;
      INSERT INTO inventory_movements (drug_id, batch_id, movement, source, source_id, quantity, created_by)
      VALUES (NEW.drug_id, v_batch.id, 'OUT', 'prescription', NEW.record_id, v_take, NEW.created_by);
      v_remaining := v_remaining - v_take;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'medical_record_medications_after_insert') THEN
    CREATE TRIGGER medical_record_medications_after_insert
    AFTER INSERT ON medical_record_medications
    FOR EACH ROW
    EXECUTE FUNCTION fn_medications_after_insert();
  END IF;
END $$;

-- Prescription adjustments on UPDATE: adjust movements and batches by delta
CREATE OR REPLACE FUNCTION fn_medications_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old integer := COALESCE(OLD.qty, 0);
  v_new integer := COALESCE(NEW.qty, 0);
  v_delta integer := v_new - v_old;
  v_remaining integer;
  v_take integer;
  v_batch RECORD;
  v_batch_id uuid;
  v_code text;
BEGIN
  IF NEW.drug_id IS NULL OR v_delta = 0 THEN
    RETURN NEW;
  END IF;

  IF v_delta > 0 THEN
    v_remaining := v_delta;
    FOR v_batch IN
      SELECT id, qty
      FROM drug_batches
      WHERE drug_id = NEW.drug_id AND deleted_at IS NULL
      ORDER BY expires_at NULLS LAST
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_batch.qty, v_remaining);
      IF v_take > 0 THEN
        UPDATE drug_batches SET qty = qty - v_take WHERE id = v_batch.id;
        INSERT INTO inventory_movements (drug_id, batch_id, movement, source, source_id, quantity, created_by)
        VALUES (NEW.drug_id, v_batch.id, 'OUT', 'prescription_adjust', NEW.record_id, v_take, NEW.created_by);
        v_remaining := v_remaining - v_take;
      END IF;
    END LOOP;
  ELSE
    -- Return stock for negative delta
    v_remaining := -v_delta;
    SELECT id INTO v_batch_id
    FROM drug_batches
    WHERE drug_id = NEW.drug_id AND deleted_at IS NULL
    ORDER BY expires_at NULLS LAST
    LIMIT 1;
    IF v_batch_id IS NULL THEN
      v_code := 'RET-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(NEW.drug_id::text, 1, 8);
      INSERT INTO drug_batches (drug_id, batch_code, qty, created_by)
      VALUES (NEW.drug_id, v_code, 0, NEW.created_by)
      RETURNING id INTO v_batch_id;
    END IF;
    UPDATE drug_batches SET qty = qty + v_remaining WHERE id = v_batch_id;
    INSERT INTO inventory_movements (drug_id, batch_id, movement, source, source_id, quantity, created_by)
    VALUES (NEW.drug_id, v_batch_id, 'IN', 'prescription_adjust', NEW.record_id, v_remaining, NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'medical_record_medications_after_update') THEN
    CREATE TRIGGER medical_record_medications_after_update
    AFTER UPDATE ON medical_record_medications
    FOR EACH ROW
    EXECUTE FUNCTION fn_medications_after_update();
  END IF;
END $$;

-- Prescription delete: return stock
CREATE OR REPLACE FUNCTION fn_medications_after_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_qty integer := COALESCE(OLD.qty, 0);
  v_batch_id uuid;
  v_code text;
BEGIN
  IF OLD.drug_id IS NULL OR v_qty <= 0 THEN
    RETURN OLD;
  END IF;
  SELECT id INTO v_batch_id
  FROM drug_batches
  WHERE drug_id = OLD.drug_id AND deleted_at IS NULL
  ORDER BY expires_at NULLS LAST
  LIMIT 1;
  IF v_batch_id IS NULL THEN
    v_code := 'RET-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(OLD.drug_id::text, 1, 8);
    INSERT INTO drug_batches (drug_id, batch_code, qty, created_by)
    VALUES (OLD.drug_id, v_code, 0, OLD.created_by)
    RETURNING id INTO v_batch_id;
  END IF;
  UPDATE drug_batches SET qty = qty + v_qty WHERE id = v_batch_id;
  INSERT INTO inventory_movements (drug_id, batch_id, movement, source, source_id, quantity, created_by)
  VALUES (OLD.drug_id, v_batch_id, 'IN', 'prescription', OLD.record_id, v_qty, OLD.created_by);
  RETURN OLD;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'medical_record_medications_after_delete') THEN
    CREATE TRIGGER medical_record_medications_after_delete
    AFTER DELETE ON medical_record_medications
    FOR EACH ROW
    EXECUTE FUNCTION fn_medications_after_delete();
  END IF;
END $$;

-- =========================
-- Supabase RLS: enable and allow anon read (non-deleted), service role full
-- =========================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','polies','doctors','suppliers','drugs','drug_batches','inventory_movements',
    'patients','registrations','medical_records','medical_record_medications',
    'expense_categories','finance_expenses','purchase_items','finance_incomes',
    'invoices','diagnoses','procedures','administrations'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'anon_select_non_deleted'
    ) THEN
      EXECUTE format(
        'CREATE POLICY anon_select_non_deleted ON %I FOR SELECT TO anon USING (deleted_at IS NULL);',
        t
      );
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'service_all'
    ) THEN
      EXECUTE format(
        'CREATE POLICY service_all ON %I FOR ALL TO service_role USING (true) WITH CHECK (true);',
        t
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'finance_expenses','purchase_items',
    'patients','polies','doctors','drugs',
    'medical_records','medical_record_medications','procedures',
    'diagnoses','administrations','suppliers'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'anon_delete'
    ) THEN
      EXECUTE format('CREATE POLICY anon_delete ON %I FOR DELETE TO anon USING (deleted_at IS NULL);', t);
    END IF;
  END LOOP;
END $$;

-- Additional RLS policies to allow anonymous inserts for incomes/expenses and related tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_incomes' AND policyname = 'anon_insert_finance_incomes') THEN
    CREATE POLICY anon_insert_finance_incomes ON finance_incomes FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'finance_expenses' AND policyname = 'anon_insert_finance_expenses') THEN
    CREATE POLICY anon_insert_finance_expenses ON finance_expenses FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'purchase_items' AND policyname = 'anon_insert_purchase_items') THEN
    CREATE POLICY anon_insert_purchase_items ON purchase_items FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'drugs' AND policyname = 'anon_insert_drugs') THEN
    CREATE POLICY anon_insert_drugs ON drugs FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'anon_insert_invoices') THEN
    CREATE POLICY anon_insert_invoices ON invoices FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'anon_update_invoices') THEN
    CREATE POLICY anon_update_invoices ON invoices FOR UPDATE TO anon USING (deleted_at IS NULL) WITH CHECK (deleted_at IS NULL);
  END IF;
END $$;

-- =========================
-- Security-invoker views for frontend read-only
-- =========================
CREATE OR REPLACE VIEW v_drug_stock WITH (security_invoker = true) AS
SELECT
  d.id AS drug_id,
  d.name,
  d.unit,
  s.name AS supplier_name,
  d.min_stock,
  COALESCE(SUM(b.qty), 0) AS total_qty,
  MIN(b.expires_at) FILTER (WHERE b.qty > 0 AND b.expires_at IS NOT NULL) AS nearest_exp
FROM drugs d
LEFT JOIN suppliers s ON s.id = d.supplier_id
LEFT JOIN drug_batches b ON b.drug_id = d.id AND b.deleted_at IS NULL
WHERE d.deleted_at IS NULL
GROUP BY d.id, d.name, d.unit, s.name, d.min_stock;

-- =========================
-- RLS: allow anon insert on selected tables (no auth)
-- =========================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'finance_expenses','purchase_items',
    'patients','polies','doctors','drugs',
    'medical_records','medical_record_medications','procedures',
    'diagnoses','administrations','suppliers'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'anon_insert'
    ) THEN
      EXECUTE format('CREATE POLICY anon_insert ON %I FOR INSERT TO anon WITH CHECK (true);', t);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'anon_update'
    ) THEN
      EXECUTE format('CREATE POLICY anon_update ON %I FOR UPDATE TO anon USING (deleted_at IS NULL) WITH CHECK (deleted_at IS NULL);', t);
    END IF;
  END LOOP;
END $$;
`;

async function main() {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    console.log('Connected to database. Running migration...');
    await client.query(sql);
    // One-off reconciliation for known mismatch: ensure Alpara stock = purchases - prescriptions
    try {
      await client.query(`
        DO $$
        DECLARE
          v_drug_id uuid;
          v_in integer;
          v_out integer;
          v_target integer;
          v_batch_id uuid;
        BEGIN
          SELECT id INTO v_drug_id FROM public.drugs WHERE name='Alpara' LIMIT 1;
          IF v_drug_id IS NULL THEN
            RETURN;
          END IF;
          SELECT COALESCE(SUM(qty),0) INTO v_in FROM public.purchase_items WHERE drug_id=v_drug_id AND deleted_at IS NULL;
          SELECT COALESCE(SUM(qty),0) INTO v_out FROM public.medical_record_medications WHERE drug_id=v_drug_id AND deleted_at IS NULL;
          v_target := GREATEST(0, v_in - v_out);
          SELECT id INTO v_batch_id FROM public.drug_batches WHERE drug_id=v_drug_id AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
          IF v_batch_id IS NOT NULL THEN
            UPDATE public.drug_batches SET qty = v_target WHERE id = v_batch_id;
          END IF;
        END $$;
      `);
      console.log('Reconciled Alpara batch qty to purchases - prescriptions.');
    } catch (e) {
      console.warn('Reconcile step skipped:', e.message);
    }
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch {}
  }
}

main();
