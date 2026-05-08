const { supabase, cors, num, now_, iso, sid, mapSupplier } = require('./_lib/db');
const { randomUUID } = require('crypto');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shopId = sid(req);
  if (!shopId) return res.json({ ok: false, error: 'Shop ID required' });

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('suppliers').select('*').eq('shop_id', shopId).order('name');
      if (error) throw error;
      // If single supplier with payments history
      if (req.query.id) {
        const { data: pays } = await supabase.from('supplier_payments').select('*')
          .eq('supplier_id', req.query.id).eq('shop_id', shopId).order('date', { ascending: false }).limit(30);
        const s = (data||[]).find(r => r.id === req.query.id);
        return res.json({ ok: true, supplier: s ? mapSupplier(s) : null, payments: pays || [] });
      }
      return res.json({ ok: true, suppliers: (data||[]).map(mapSupplier) });
    }

    if (req.method === 'POST') {
      const d = req.body || {};
      // Add supplier payment
      if (d.action === 'payment') {
        const { supplierId, amount, note, date } = d;
        const pay = num(amount);
        const { data: s } = await supabase.from('suppliers').select('total_due').eq('id', supplierId).single();
        if (!s) return res.json({ ok: false, error: 'সাপ্লায়ার পাওয়া যায়নি' });
        const newDue = Math.max(0, num(s.total_due) - pay);
        await supabase.from('suppliers').update({ total_due: newDue }).eq('id', supplierId);
        await supabase.from('supplier_payments').insert({
          id: randomUUID(), shop_id: shopId, supplier_id: supplierId,
          date: date || iso(new Date()), amount: pay, note: note || '', created_at: now_()
        });
        return res.json({ ok: true, newDue });
      }
      // Create supplier
      if (!d.name) return res.json({ ok: false, error: 'নাম দিন' });
      const { data, error } = await supabase.from('suppliers').insert({
        id: randomUUID(), shop_id: shopId, name: d.name,
        phone: d.phone || '', address: d.address || '', total_due: 0, created_at: now_()
      }).select().single();
      if (error) throw error;
      return res.json({ ok: true, supplier: mapSupplier(data) });
    }

    if (req.method === 'PUT') {
      const d = req.body || {};
      if (!d.id) return res.json({ ok: false, error: 'ID required' });
      const u = {};
      if (d.name    !== undefined) u.name    = d.name;
      if (d.phone   !== undefined) u.phone   = d.phone;
      if (d.address !== undefined) u.address = d.address;
      const { error } = await supabase.from('suppliers').update(u).eq('id', d.id).eq('shop_id', shopId);
      if (error) throw error;
      return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      const { error } = await supabase.from('suppliers').delete().eq('id', id).eq('shop_id', shopId);
      if (error) throw error;
      return res.json({ ok: true });
    }

    res.status(405).end();
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
};
