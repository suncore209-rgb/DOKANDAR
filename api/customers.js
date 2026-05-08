const { supabase, cors, num, now_, iso, sid, mapCustomer, mapLedger } = require('./_lib/db');
const { randomUUID } = require('crypto');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shopId = sid(req);
  if (!shopId) return res.json({ ok: false, error: 'Shop ID required' });

  try {
    if (req.method === 'GET') {
      // Get single customer with ledger
      if (req.query.id) {
        const [cust, ledger] = await Promise.all([
          supabase.from('customers').select('*').eq('id', req.query.id).eq('shop_id', shopId).single(),
          supabase.from('customer_ledger').select('*').eq('customer_id', req.query.id).eq('shop_id', shopId).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(50)
        ]);
        if (cust.error) throw cust.error;
        return res.json({ ok: true, customer: mapCustomer(cust.data), ledger: (ledger.data||[]).map(mapLedger) });
      }
      // List all
      const { data, error } = await supabase.from('customers').select('*').eq('shop_id', shopId).order('name');
      if (error) throw error;
      return res.json({ ok: true, customers: (data||[]).map(mapCustomer) });
    }

    if (req.method === 'POST') {
      const d = req.body || {};
      // Add payment to customer
      if (d.action === 'payment') {
        const { customerId, amount, note, date } = d;
        if (!customerId || !amount) return res.json({ ok: false, error: 'কাস্টমার ও পরিমাণ দিন' });
        const pay = num(amount);
        const { data: cust } = await supabase.from('customers').select('total_due').eq('id', customerId).single();
        if (!cust) return res.json({ ok: false, error: 'কাস্টমার পাওয়া যায়নি' });
        const newDue = Math.max(0, num(cust.total_due) - pay);
        await supabase.from('customers').update({ total_due: newDue }).eq('id', customerId);
        await supabase.from('customer_ledger').insert({
          id: randomUUID(), shop_id: shopId, customer_id: customerId,
          date: date || iso(new Date()), type: 'payment', amount: pay, note: note || 'নগদ পেমেন্ট', created_at: now_()
        });
        return res.json({ ok: true, newDue });
      }
      // Create customer
      if (!d.name) return res.json({ ok: false, error: 'নাম দিন' });
      const { data, error } = await supabase.from('customers').insert({
        id: randomUUID(), shop_id: shopId, name: d.name,
        phone: d.phone || '', address: d.address || '', total_due: 0, created_at: now_()
      }).select().single();
      if (error) throw error;
      return res.json({ ok: true, customer: mapCustomer(data) });
    }

    if (req.method === 'PUT') {
      const d = req.body || {};
      if (!d.id) return res.json({ ok: false, error: 'ID required' });
      const u = {};
      if (d.name    !== undefined) u.name    = d.name;
      if (d.phone   !== undefined) u.phone   = d.phone;
      if (d.address !== undefined) u.address = d.address;
      const { error } = await supabase.from('customers').update(u).eq('id', d.id).eq('shop_id', shopId);
      if (error) throw error;
      return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      const { error } = await supabase.from('customers').delete().eq('id', id).eq('shop_id', shopId);
      if (error) throw error;
      return res.json({ ok: true });
    }

    res.status(405).end();
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
};
