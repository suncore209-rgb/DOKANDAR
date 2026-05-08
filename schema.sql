-- ══════════════════════════════════════════════════════════════
--  দোকান হিসাব — Supabase Schema V1
--  Multi-tenant general shopkeeper management app
--  Run this ENTIRE file for a fresh install.
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Shops (one row per registered business) ───────────────────
CREATE TABLE IF NOT EXISTS shops (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL UNIQUE,     -- used as login ID
  address      TEXT DEFAULT '',
  owner_pin    TEXT NOT NULL,            -- 4-6 digit PIN
  cashier_pin  TEXT DEFAULT '',          -- optional cashier PIN
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Product Categories ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cat_shop ON categories(shop_id);

-- ── Products (with live stock tracking) ───────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          UUID NOT NULL,
  category_id      TEXT DEFAULT '',
  category_name    TEXT DEFAULT '',
  name             TEXT NOT NULL,
  unit             TEXT DEFAULT 'পিস',
  purchase_price   NUMERIC(12,2) DEFAULT 0,
  selling_price    NUMERIC(12,2) DEFAULT 0,
  stock_qty        NUMERIC(12,3) DEFAULT 0,
  low_stock_alert  NUMERIC(12,3) DEFAULT 0,   -- 0 = disabled
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prod_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_prod_name ON products(name);

-- ── Customers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID NOT NULL,
  name       TEXT NOT NULL,
  phone      TEXT DEFAULT '',
  address    TEXT DEFAULT '',
  total_due  NUMERIC(14,2) DEFAULT 0,    -- running balance owed by customer
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cust_shop ON customers(shop_id);

-- ── Suppliers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID NOT NULL,
  name       TEXT NOT NULL,
  phone      TEXT DEFAULT '',
  address    TEXT DEFAULT '',
  total_due  NUMERIC(14,2) DEFAULT 0,    -- running balance owed to supplier
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supp_shop ON suppliers(shop_id);

-- ── Sales (header — one per sale transaction) ─────────────────
CREATE TABLE IF NOT EXISTS sales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL,
  customer_id   TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  date          DATE NOT NULL,
  subtotal      NUMERIC(14,2) DEFAULT 0,
  discount      NUMERIC(14,2) DEFAULT 0,
  total         NUMERIC(14,2) DEFAULT 0,
  paid_amount   NUMERIC(14,2) DEFAULT 0,
  due_amount    NUMERIC(14,2) DEFAULT 0,
  payment_type  TEXT DEFAULT 'cash'
                  CHECK (payment_type IN ('cash','credit','partial')),
  note          TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sale_shop ON sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sale_date ON sales(date);

-- ── Sale Line Items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      UUID NOT NULL,
  shop_id      UUID NOT NULL,
  product_id   TEXT NOT NULL,
  product_name TEXT DEFAULT '',
  unit         TEXT DEFAULT '',
  qty          NUMERIC(12,3) DEFAULT 0,
  unit_price   NUMERIC(12,2) DEFAULT 0,
  total        NUMERIC(14,2) DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sitem_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sitem_shop ON sale_items(shop_id);

-- ── Purchases (stock restocking from suppliers) ───────────────
CREATE TABLE IF NOT EXISTS purchases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL,
  supplier_id   TEXT DEFAULT '',
  supplier_name TEXT DEFAULT '',
  date          DATE NOT NULL,
  total         NUMERIC(14,2) DEFAULT 0,
  paid_amount   NUMERIC(14,2) DEFAULT 0,
  due_amount    NUMERIC(14,2) DEFAULT 0,
  payment_type  TEXT DEFAULT 'cash'
                  CHECK (payment_type IN ('cash','credit','partial')),
  note          TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pur_shop ON purchases(shop_id);
CREATE INDEX IF NOT EXISTS idx_pur_date ON purchases(date);

-- ── Purchase Line Items ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id  UUID NOT NULL,
  shop_id      UUID NOT NULL,
  product_id   TEXT NOT NULL,
  product_name TEXT DEFAULT '',
  unit         TEXT DEFAULT '',
  qty          NUMERIC(12,3) DEFAULT 0,
  unit_price   NUMERIC(12,2) DEFAULT 0,
  total        NUMERIC(14,2) DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pitem_pur  ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_pitem_shop ON purchase_items(shop_id);

-- ── Customer Khata (credit/payment ledger) ────────────────────
CREATE TABLE IF NOT EXISTS customer_ledger (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL,
  customer_id UUID NOT NULL,
  date        DATE NOT NULL,
  type        TEXT DEFAULT 'payment'
                CHECK (type IN ('credit_sale','payment')),
  amount      NUMERIC(14,2) DEFAULT 0,    -- positive for credit_sale, positive for payment
  ref_id      TEXT DEFAULT '',            -- sale_id for credit_sale entries
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_cust ON customer_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_ledger_shop ON customer_ledger(shop_id);

-- ── Supplier Payments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL,
  supplier_id UUID NOT NULL,
  date        DATE NOT NULL,
  amount      NUMERIC(14,2) DEFAULT 0,
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spay_shop ON supplier_payments(shop_id);

-- ── Expenses ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID NOT NULL,
  category   TEXT DEFAULT 'সাধারণ',
  date       DATE NOT NULL,
  amount     NUMERIC(14,2) DEFAULT 0,
  note       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exp_shop ON expenses(shop_id);
CREATE INDEX IF NOT EXISTS idx_exp_date ON expenses(date);

-- ── Disable RLS (private app — server-side service key) ───────
ALTER TABLE shops            DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories       DISABLE ROW LEVEL SECURITY;
ALTER TABLE products         DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers        DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers        DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales            DISABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items       DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchases        DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items   DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ledger  DISABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses         DISABLE ROW LEVEL SECURITY;
