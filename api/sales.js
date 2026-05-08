const { supabase, cors, num, now_, iso, sid, mapSale, mapSaleItem } = require('./_lib/db');
const { randomUUID } = require('crypto');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shopId = sid(req);
  if (!shopId) return res.json({ ok: false, error: 'Shop ID required' });

  try {
    if (req.method === 'GET') {
      const { from, to, customerId, limit: lim } = req.query;
      let q = supabase.from('sales').select('*').eq('shop_id', shopId).order('created_at', { ascending: false });
      if (from)       q = q.gte('date', from);
      if (to)         q = q.lte('date', to);
      if (customerId) q = q.eq('customer_id', customerId);
      q = q.limit(parseInt(lim) || 50);
      const { data, error } = await q;
      if (error) throw error;

      // Fetch items if single sale requested
      if (req.query.id) {
        const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', req.query.id);
        const sale = (data||[]).find(r => String(r.id) === req.query.id);
        return res.json({ ok: true, sale: sale ? mapSale(sale) : null, items: (items||[]).map(mapSaleItem) });
      }
      return res.json({ ok: true, sales: (data||[]).map(mapSale) });
    }

    if (req.method === 'POST') {
      const d = req.body || {};
      if (!d.items || !d.items.length) return res.json({ ok: false, error: 'অন্তত একটি পণ্য যোগ করুন' });

      const subtotal   = d.items.reduce((s, i) => s + num(i.total), 0);
      const discount   = num(d.discount);
      const total      = Math.max(0, subtotal - discount);
      const payType    = d.paymentType || 'cash';
      const paidAmt    = payType === 'cash' ? total : payType === 'credit' ? 0 : Math.min(num(d.paidAmount), total);
      const dueAmt     = total - paidAmt;
      const today      = d.date || iso(new Date());
      const saleId     = randomUUID();

      // Insert sale header
      const { data: sale, error: saleErr } = await supabase.from('sales').insert({
        id:            saleId,
        shop_id:       shopId,
        customer_id:   d.customerId   || '',
        customer_name: d.customerName || '',
        date:          today,
        subtotal,
        discount,
        total,
        paid_amount:   paidAmt,
        due_amount:    dueAmt,
        payment_type:  payType,
        note:          d.note || '',
        created_at:    now_()
      }).select().single();
      if (saleErr) throw saleErr;

      // Insert line items
      await supabase.from('sale_items').insert(d.items.map(i => ({
        id:           randomUUID(),
        sale_id:      saleId,
        shop_id:      shopId,
        product_id:   i.productId,
        product_name: i.productName || '',
        unit:         i.unit        || '',
        qty:          num(i.qty),
        unit_price:   num(i.unitPrice),
        total:        num(i.total)
      })));

      // Deduct stock for each product
      for (const item of d.items) {
        if (!item.productId) continue;
        const { data: prod } = await supabase.from('products')
          .select('stock_qty').eq('id', item.productId).eq('shop_id', shopId).maybeSingle();
        if (prod) {
          await supabase.from('products').update({
            stock_qty: Math.max(0, num(prod.stock_qty) - num(item.qty))
          }).eq('id', item.productId);
        }
      }

      // Update customer due and log in ledger
      if (dueAmt > 0 && d.customerId) {
        const { data: cust } = await supabase.from('customers')
          .select('total_due').eq('id', d.customerId).maybeSingle();
        if (cust) {
          await supabase.from('customers').update({
            total_due: num(cust.total_due) + dueAmt
          }).eq('id', d.customerId);
          await supabase.from('customer_ledger').insert({
            id: randomUUID(), shop_id: shopId, customer_id: d.customerId,
            date: today, type: 'credit_sale', amount: dueAmt,
            ref_id: saleId, note: 'বিক্রয় বাকি', created_at: now_()
          });
        }
      }

      return res.json({ ok: true, sale: mapSale(sale) });
    }

    res.status(405).end();
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
};
