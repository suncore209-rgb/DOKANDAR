const { supabase, cors, num, now_, iso, sid, mapPurchase } = require('./_lib/db');
const { randomUUID } = require('crypto');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shopId = sid(req);
  if (!shopId) return res.json({ ok: false, error: 'Shop ID required' });

  try {
    if (req.method === 'GET') {
      const { from, to } = req.query;
      let q = supabase.from('purchases').select('*').eq('shop_id', shopId).order('created_at', { ascending: false });
      if (from) q = q.gte('date', from);
      if (to)   q = q.lte('date', to);
      q = q.limit(50);
      const { data, error } = await q;
      if (error) throw error;
      return res.json({ ok: true, purchases: (data||[]).map(mapPurchase) });
    }

    if (req.method === 'POST') {
      const d = req.body || {};
      if (!d.items || !d.items.length) return res.json({ ok: false, error: 'অন্তত একটি পণ্য যোগ করুন' });

      const total    = d.items.reduce((s, i) => s + num(i.total), 0);
      const payType  = d.paymentType || 'cash';
      const paidAmt  = payType === 'cash' ? total : payType === 'credit' ? 0 : Math.min(num(d.paidAmount), total);
      const dueAmt   = total - paidAmt;
      const today    = d.date || iso(new Date());
      const purId    = randomUUID();

      const { data: pur, error: purErr } = await supabase.from('purchases').insert({
        id:            purId,
        shop_id:       shopId,
        supplier_id:   d.supplierId   || '',
        supplier_name: d.supplierName || '',
        date:          today,
        total,
        paid_amount:   paidAmt,
        due_amount:    dueAmt,
        payment_type:  payType,
        note:          d.note || '',
        created_at:    now_()
      }).select().single();
      if (purErr) throw purErr;

      // Insert line items
      await supabase.from('purchase_items').insert(d.items.map(i => ({
        id:           randomUUID(),
        purchase_id:  purId,
        shop_id:      shopId,
        product_id:   i.productId,
        product_name: i.productName || '',
        unit:         i.unit        || '',
        qty:          num(i.qty),
        unit_price:   num(i.unitPrice),
        total:        num(i.total)
      })));

      // Add stock for each product + update purchase price
      for (const item of d.items) {
        if (!item.productId) continue;
        const { data: prod } = await supabase.from('products')
          .select('stock_qty').eq('id', item.productId).eq('shop_id', shopId).maybeSingle();
        if (prod) {
          const updates = { stock_qty: num(prod.stock_qty) + num(item.qty) };
          if (num(item.unitPrice) > 0) updates.purchase_price = num(item.unitPrice);
          await supabase.from('products').update(updates).eq('id', item.productId);
        }
      }

      // Update supplier due
      if (dueAmt > 0 && d.supplierId) {
        const { data: supp } = await supabase.from('suppliers')
          .select('total_due').eq('id', d.supplierId).maybeSingle();
        if (supp) {
          await supabase.from('suppliers').update({
            total_due: num(supp.total_due) + dueAmt
          }).eq('id', d.supplierId);
        }
      }

      return res.json({ ok: true, purchase: mapPurchase(pur) });
    }

    res.status(405).end();
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
};
