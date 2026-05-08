# দোকান হিসাব — General Shopkeeper App

A complete mobile-first shop management app for Bangladeshi shopkeepers.
Built with **Vercel** (serverless) + **Supabase** (PostgreSQL). Deploy in 5 minutes.

---

## Features

| Module | What it does |
|--------|-------------|
| 🛒 POS বিক্রয় | Fast sale entry, cart, cash/credit/partial payment |
| 📒 খাতা | Customer credit book with full ledger history |
| 📦 পণ্য | Product inventory with live stock tracking |
| 📥 ক্রয় | Stock purchase from suppliers, auto-updates stock |
| 🏭 সাপ্লায়ার | Supplier management with due tracking |
| 💸 খরচ | Daily expense tracking by category |
| 📊 রিপোর্ট | Date-range profit/loss, top products, expense breakdown |
| ⚙️ সেটিংস | Shop name, owner PIN, cashier PIN management |

---

## Deploy Steps

### 1. Supabase
1. Go to [supabase.com](https://supabase.com) → New Project
2. Open **SQL Editor** → paste entire `schema.sql` → Run
3. Copy your **Project URL** and **Service Role Key** (Settings → API)

### 2. GitHub
1. Create a new repository
2. Upload all files (keep folder structure intact)

### 3. Vercel
1. Go to [vercel.com](https://vercel.com) → New Project → Import GitHub repo
2. Add environment variables:
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_SERVICE_KEY` = your service role key
3. Deploy

---

## Login System

| Role | Set by | Access |
|------|--------|--------|
| মালিক (Owner) | Registration | Full access |
| ক্যাশিয়ার (Cashier) | Owner in Settings | POS + view only |

**Login:** Phone number + PIN  
**Multi-tenant:** Each shop is fully isolated — one deployment serves unlimited shops

---

## API Endpoints (10 total)

| Endpoint | Purpose |
|----------|---------|
| POST `/api/auth` | Register / Login / Update settings |
| GET `/api/load-all` | Load all products, customers, suppliers, categories |
| GET `/api/dashboard` | Today's summary stats |
| GET/POST/PUT/DELETE `/api/products` | Product management |
| GET/POST/PUT/DELETE `/api/customers` | Customer + khata + payments |
| GET/POST/PUT/DELETE `/api/suppliers` | Supplier + payments |
| GET/POST `/api/sales` | POS sale creation |
| GET/POST `/api/purchases` | Stock purchase |
| GET/POST/DELETE `/api/expenses` | Expense management |
| GET `/api/report` | Date-range business report |

---

## File Structure

```
dokan-hisab/
├── api/
│   ├── _lib/db.js        ← Supabase client + all data mappers
│   ├── auth.js
│   ├── load-all.js
│   ├── dashboard.js
│   ├── products.js
│   ├── customers.js
│   ├── suppliers.js
│   ├── sales.js
│   ├── purchases.js
│   ├── expenses.js
│   └── report.js
├── public/
│   └── index.html        ← Complete single-file SPA
├── schema.sql
├── vercel.json
└── package.json
```
