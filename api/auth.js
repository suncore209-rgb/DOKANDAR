const { supabase, cors, now_ } = require('./_lib/db');
const { randomUUID } = require('crypto');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { action } = req.query;
  const d = req.body || {};

  try {
    // ── Register ──────────────────────────────────────────────
    if (action === 'register') {
      const { name, phone, ownerPin, cashierPin, address } = d;
      if (!name || !phone || !ownerPin)
        return res.json({ ok: false, error: 'দোকানের নাম, ফোন নম্বর এবং মালিকের PIN দিন' });

      const { data: ex } = await supabase.from('shops').select('id').eq('phone', phone).maybeSingle();
      if (ex) return res.json({ ok: false, error: 'এই ফোন নম্বরে আগেই নিবন্ধিত আছে' });

      const shopId = randomUUID();
      const { error } = await supabase.from('shops').insert({
        id: shopId, name, phone,
        address: address || '',
        owner_pin:   ownerPin,
        cashier_pin: cashierPin || '',
        created_at: now_()
      });
      if (error) throw error;

      // Default categories for quick start
      const cats = ['মুদিখানা','প্রসাধনী','পোশাক','ইলেকট্রনিক্স','ওষুধ','খাদ্যপণ্য','হার্ডওয়্যার','অন্যান্য'];
      await supabase.from('categories').insert(
        cats.map(n => ({ id: randomUUID(), shop_id: shopId, name: n, created_at: now_() }))
      );

      return res.json({ ok: true, shopId, shopName: name, role: 'owner' });
    }

    // ── Login ─────────────────────────────────────────────────
    if (action === 'login') {
      const { phone, pin } = d;
      if (!phone || !pin) return res.json({ ok: false, error: 'ফোন নম্বর ও PIN দিন' });

      const { data: shop, error } = await supabase.from('shops').select('*').eq('phone', phone).maybeSingle();
      if (error || !shop) return res.json({ ok: false, error: 'দোকান পাওয়া যায়নি' });

      let role = '';
      if (pin === shop.owner_pin)                           role = 'owner';
      else if (shop.cashier_pin && pin === shop.cashier_pin) role = 'cashier';
      else return res.json({ ok: false, error: 'PIN ভুল হয়েছে' });

      return res.json({
        ok: true,
        shopId:   shop.id,
        shopName: shop.name,
        address:  shop.address || '',
        role,
        hasCashierPin: !!shop.cashier_pin
      });
    }

    // ── Update PINs (owner only) ───────────────────────────────
    if (action === 'update-pins') {
      const shopId = req.headers['x-shop-id'];
      if (!shopId) return res.json({ ok: false, error: 'অনুমোদন নেই' });
      const updates = {};
      if (d.ownerPin)   updates.owner_pin   = d.ownerPin;
      if (d.cashierPin !== undefined) updates.cashier_pin = d.cashierPin;
      if (d.shopName)   updates.name        = d.shopName;
      if (d.address !== undefined) updates.address  = d.address;
      const { error } = await supabase.from('shops').update(updates).eq('id', shopId);
      if (error) throw error;
      return res.json({ ok: true });
    }

    res.json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
};
