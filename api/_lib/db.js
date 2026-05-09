const { createClient } = require('@supabase/supabase-js');

// Validate environment variables at startup — gives a clear error
// instead of Supabase's cryptic "invalid path" message
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || url === 'your-supabase-url') {
    throw new Error('Vercel-এ SUPABASE_URL environment variable সেট করা হয়নি। Vercel dashboard → Settings → Environment Variables-এ যান।');
  }
  if (!key || key === 'your-service-key') {
    throw new Error('Vercel-এ SUPABASE_SERVICE_KEY environment variable সেট করা হয়নি। Vercel dashboard → Settings → Environment Variables-এ যান।');
  }
  return createClient(url, key);
}

// Create client once per cold start (cached between warm invocations)
let _client = null;
function db() {
  if (!_client) _client = getSupabase();
  return _client;
}

// Export as `supabase` so all existing API files work with zero changes
Object.defineProperty(module.exports, 'supabase', { get: db, enumerable: true });

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-shop-id');
}

function num(v)  { return parseFloat(v) || 0; }
function now_()  { return new Date().toISOString(); }
function iso(d)  { return d ? String(d).slice(0, 10) : ''; }
function sid(req){ return req.headers['x-shop-id'] || req.query.shopId || ''; }

function mapProduct(r) {
  return {
    id:            String(r.id),
    categoryId:    r.category_id   || '',
    categoryName:  r.category_name || '',
    name:          r.name          || '',
    unit:          r.unit          || 'পিস',
    purchasePrice: num(r.purchase_price),
    sellingPrice:  num(r.selling_price),
    stockQty:      num(r.stock_qty),
    lowStockAlert: num(r.low_stock_alert),
    createdAt:     r.created_at    || ''
  };
}

function mapCustomer(r) {
  return {
    id:        String(r.id),
    name:      r.name    || '',
    phone:     r.phone   || '',
    address:   r.address || '',
    totalDue:  num(r.total_due),
    createdAt: r.created_at || ''
  };
}

function mapSupplier(r) {
  return {
    id:        String(r.id),
    name:      r.name    || '',
    phone:     r.phone   || '',
    address:   r.address || '',
    totalDue:  num(r.total_due),
    createdAt: r.created_at || ''
  };
}

function mapSale(r) {
  return {
    id:           String(r.id),
    customerId:   r.customer_id   || '',
    customerName: r.customer_name || '',
    date:         iso(r.date),
    subtotal:     num(r.subtotal),
    discount:     num(r.discount),
    total:        num(r.total),
    paidAmount:   num(r.paid_amount),
    dueAmount:    num(r.due_amount),
    paymentType:  r.payment_type  || 'cash',
    note:         r.note          || '',
    createdAt:    r.created_at    || ''
  };
}

function mapSaleItem(r) {
  return {
    id:          String(r.id),
    productId:   r.product_id   || '',
    productName: r.product_name || '',
    unit:        r.unit         || '',
    qty:         num(r.qty),
    unitPrice:   num(r.unit_price),
    total:       num(r.total)
  };
}

function mapPurchase(r) {
  return {
    id:           String(r.id),
    supplierId:   r.supplier_id   || '',
    supplierName: r.supplier_name || '',
    date:         iso(r.date),
    total:        num(r.total),
    paidAmount:   num(r.paid_amount),
    dueAmount:    num(r.due_amount),
    paymentType:  r.payment_type  || 'cash',
    note:         r.note          || '',
    createdAt:    r.created_at    || ''
  };
}

function mapExpense(r) {
  return {
    id:        String(r.id),
    category:  r.category || 'সাধারণ',
    date:      iso(r.date),
    amount:    num(r.amount),
    note:      r.note || '',
    createdAt: r.created_at || ''
  };
}

function mapLedger(r) {
  return {
    id:         String(r.id),
    customerId: String(r.customer_id),
    date:       iso(r.date),
    type:       r.type   || '',
    amount:     num(r.amount),
    refId:      r.ref_id || '',
    note:       r.note   || '',
    createdAt:  r.created_at || ''
  };
}

module.exports = Object.assign(module.exports, {
  cors, num, now_, iso, sid,
  mapProduct, mapCustomer, mapSupplier,
  mapSale, mapSaleItem, mapPurchase, mapExpense, mapLedger
});
