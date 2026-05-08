const { supabase, cors, num, now_, sid, mapProduct } = require('./_lib/db');
const { randomUUID } = require('crypto');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shopId = sid(req);
  if (!shopId) return res.json({ ok: false, error: 'Shop ID required' });

  try {
    if (req.method === 'GET') {
      const { category } = req.query;
      let q = supabase.from('products').select('*').eq('shop_id', shopId).order('name');
      if (category) q = q.eq('category_id', category);
      const { data, error } = await q;
      if (error) throw error;
      return res.json({ ok: true, products: (data||[]).map(mapProduct) });
    }

    if (req.method === 'POST') {
      const d = req.body || {};
      if (!d.name) return res.json({ ok: false, error: 'পণ্যের নাম দিন' });
      const { data, error } = await supabase.from('products').insert({
        id:             randomUUID(),
        shop_id:        shopId,
        category_id:    d.categoryId   || '',
        category_name:  d.categoryName || '',
        name:           d.name,
        unit:           d.unit         || 'পিস',
        purchase_price: num(d.purchasePrice),
        selling_price:  num(d.sellingPrice),
        stock_qty:      num(d.stockQty),
        low_stock_alert:num(d.lowStockAlert),
        created_at:     now_()
      }).select().single();
      if (error) throw error;
      return res.json({ ok: true, product: mapProduct(data) });
    }

    if (req.method === 'PUT') {
      const d = req.body || {};
      if (!d.id) return res.json({ ok: false, error: 'ID required' });
      const u = {};
      if (d.name           !== undefined) u.name            = d.name;
      if (d.categoryId     !== undefined) u.category_id     = d.categoryId;
      if (d.categoryName   !== undefined) u.category_name   = d.categoryName;
      if (d.unit           !== undefined) u.unit            = d.unit;
      if (d.purchasePrice  !== undefined) u.purchase_price  = num(d.purchasePrice);
      if (d.sellingPrice   !== undefined) u.selling_price   = num(d.sellingPrice);
      if (d.stockQty       !== undefined) u.stock_qty       = num(d.stockQty);
      if (d.lowStockAlert  !== undefined) u.low_stock_alert = num(d.lowStockAlert);
      const { error } = await supabase.from('products').update(u).eq('id', d.id).eq('shop_id', shopId);
      if (error) throw error;
      return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.json({ ok: false, error: 'ID required' });
      const { error } = await supabase.from('products').delete().eq('id', id).eq('shop_id', shopId);
      if (error) throw error;
      return res.json({ ok: true });
    }

    res.status(405).end();
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
};
