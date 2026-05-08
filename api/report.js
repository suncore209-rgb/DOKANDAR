const { supabase, cors, num, iso, sid } = require('./_lib/db');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shopId = sid(req);
  if (!shopId) return res.json({ ok: false, error: 'Shop ID required' });

  const today = iso(new Date());
  const from  = req.query.from || today;
  const to    = req.query.to   || today;

  try {
    const [salesRes, itemsRes, purchasesRes, expensesRes] = await Promise.all([
      supabase.from('sales').select('*').eq('shop_id', shopId).gte('date', from).lte('date', to),
      supabase.from('sale_items').select('qty,unit_price,product_id,product_name,total').eq('shop_id', shopId),
      supabase.from('purchases').select('total,paid_amount,due_amount').eq('shop_id', shopId).gte('date', from).lte('date', to),
      supabase.from('expenses').select('amount,category').eq('shop_id', shopId).gte('date', from).lte('date', to)
    ]);

    const sales     = salesRes.data    || [];
    const expenses  = expensesRes.data || [];
    const purchases = purchasesRes.data || [];

    const saleIds    = sales.map(s => s.id);
    const { data: rangeItems } = saleIds.length
      ? await supabase.from('sale_items').select('qty,unit_price,product_name,unit,total').eq('shop_id', shopId).in('sale_id', saleIds)
      : { data: [] };

    // Sales summary
    const totalSales    = sales.reduce((s, r) => s + num(r.total), 0);
    const totalDiscount = sales.reduce((s, r) => s + num(r.discount), 0);
    const totalCash     = sales.filter(r => r.payment_type === 'cash').reduce((s, r) => s + num(r.total), 0);
    const totalCredit   = sales.reduce((s, r) => s + num(r.due_amount), 0);
    const txCount       = sales.length;

    // Cost of goods sold (purchase price * qty sold)
    // We use sale_items unit_price if purchase price not separately stored; approximate with item totals vs selling
    // Use sale_items to build a cost from products
    const { data: allProds } = await supabase.from('products').select('id,purchase_price').eq('shop_id', shopId);
    const priceMap = {};
    (allProds || []).forEach(p => { priceMap[p.id] = num(p.purchase_price); });
    const cogs = (rangeItems||[]).reduce((s, i) => s + (priceMap[i.product_id] || 0) * num(i.qty), 0);
    const grossProfit = totalSales - cogs;

    // Expenses
    const totalExp = expenses.reduce((s, r) => s + num(r.amount), 0);
    const netProfit = grossProfit - totalExp;

    // Expense by category
    const expByCat = {};
    expenses.forEach(r => { expByCat[r.category] = (expByCat[r.category] || 0) + num(r.amount); });

    // Top selling products
    const prodSales = {};
    (rangeItems||[]).forEach(i => {
      const k = i.product_name || i.product_id;
      if (!prodSales[k]) prodSales[k] = { name: k, qty: 0, revenue: 0 };
      prodSales[k].qty     += num(i.qty);
      prodSales[k].revenue += num(i.total);
    });
    const topProducts = Object.values(prodSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Purchases
    const totalPurchase = purchases.reduce((s, r) => s + num(r.total), 0);

    return res.json({
      ok: true,
      period: { from, to },
      sales: {
        total:    totalSales,
        cash:     totalCash,
        credit:   totalCredit,
        discount: totalDiscount,
        count:    txCount
      },
      cogs,
      grossProfit,
      expenses: {
        total:      totalExp,
        byCategory: expByCat
      },
      netProfit,
      purchases: { total: totalPurchase },
      topProducts
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
};
