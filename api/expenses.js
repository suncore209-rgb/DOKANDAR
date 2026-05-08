const { supabase, cors, num, now_, iso, sid, mapExpense } = require('./_lib/db');
const { randomUUID } = require('crypto');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shopId = sid(req);
  if (!shopId) return res.json({ ok: false, error: 'Shop ID required' });

  try {
    if (req.method === 'GET') {
      const { from, to } = req.query;
      let q = supabase.from('expenses').select('*').eq('shop_id', shopId).order('date', { ascending: false }).order('created_at', { ascending: false });
      if (from) q = q.gte('date', from);
      if (to)   q = q.lte('date', to);
      q = q.limit(100);
      const { data, error } = await q;
      if (error) throw error;
      return res.json({ ok: true, expenses: (data||[]).map(mapExpense) });
    }

    if (req.method === 'POST') {
      const d = req.body || {};
      if (!d.amount) return res.json({ ok: false, error: 'পরিমাণ দিন' });
      const { data, error } = await supabase.from('expenses').insert({
        id:        randomUUID(),
        shop_id:   shopId,
        category:  d.category || 'সাধারণ',
        date:      d.date     || iso(new Date()),
        amount:    num(d.amount),
        note:      d.note     || '',
        created_at: now_()
      }).select().single();
      if (error) throw error;
      return res.json({ ok: true, expense: mapExpense(data) });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      const { error } = await supabase.from('expenses').delete().eq('id', id).eq('shop_id', shopId);
      if (error) throw error;
      return res.json({ ok: true });
    }

    res.status(405).end();
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
};
