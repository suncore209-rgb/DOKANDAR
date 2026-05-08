const { supabase, cors, sid, mapProduct, mapCustomer, mapSupplier } = require('./_lib/db');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shopId = sid(req);
  if (!shopId) return res.json({ ok: false, error: 'Shop ID required' });

  try {
    const [prods, cats, custs, supps] = await Promise.all([
      supabase.from('products').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('categories').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('customers').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('suppliers').select('*').eq('shop_id', shopId).order('name')
    ]);

    return res.json({
      ok: true,
      products:   (prods.data  || []).map(mapProduct),
      categories: (cats.data   || []).map(r => ({ id: String(r.id), name: r.name })),
      customers:  (custs.data  || []).map(mapCustomer),
      suppliers:  (supps.data  || []).map(mapSupplier)
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
};
