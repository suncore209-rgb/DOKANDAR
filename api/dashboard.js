const { supabase, cors, num, iso, sid } = require('./_lib/db');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const shopId = sid(req);
  if (!shopId) return res.json({ ok: false, error: 'Shop ID required' });

  const today = req.query.date || iso(new Date());
  const month = today.slice(0, 7);
  const monthStart = month + '-01';
  const monthEnd   = today;

  try {
    const [todaySales, todayExp, monthSales, monthExp, custDue, suppDue, lowStock, recentSales] = await Promise.all([
      supabase.from('sales').select('total,discount,due_amount,payment_type').eq('shop_id', shopId).eq('date', today),
      supabase.from('expenses').select('amount').eq('shop_id', shopId).eq('date', today),
      supabase.from('sales').select('total,discount,due_amount').eq('shop_id', shopId).gte('date', monthStart).lte('date', monthEnd),
      supabase.from('expenses').select('amount').eq('shop_id', shopId).gte('date', monthStart).lte('date', monthEnd),
      supabase.from('customers').select('total_due').eq('shop_id', shopId).gt('total_due', 0),
      supabase.from('suppliers').select('total_due').eq('shop_id', shopId).gt('total_due', 0),
      supabase.from('products').select('id,name,unit,stock_qty,low_stock_alert').eq('shop_id', shopId).gt('low_stock_alert', 0),
      supabase.from('sales').select('id,customer_name,total,payment_type,date,created_at').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(8)
    ]);

    // Today totals
    const tSales   = (todaySales.data||[]).reduce((s,r) => s + num(r.total), 0);
    const tCash    = (todaySales.data||[]).filter(r=>r.payment_type==='cash').reduce((s,r)=>s+num(r.total),0);
    const tCredit  = (todaySales.data||[]).reduce((s,r) => s + num(r.due_amount), 0);
    const tDisc    = (todaySales.data||[]).reduce((s,r) => s + num(r.discount), 0);
    const tExp     = (todayExp.data||[]).reduce((s,r) => s + num(r.amount), 0);

    // Month totals
    const mSales   = (monthSales.data||[]).reduce((s,r) => s + num(r.total), 0);
    const mExp     = (monthExp.data||[]).reduce((s,r) => s + num(r.amount), 0);

    // Dues
    const totalCustDue = (custDue.data||[]).reduce((s,r) => s + num(r.total_due), 0);
    const totalSuppDue = (suppDue.data||[]).reduce((s,r) => s + num(r.total_due), 0);

    // Low stock
    const lowItems = (lowStock.data||[]).filter(p => num(p.stock_qty) <= num(p.low_stock_alert));

    // Purchase cost approximation for today (sale items cost)
    const { data: todaySaleItems } = await supabase
      .from('sale_items').select('sale_id,qty,unit_price')
      .eq('shop_id', shopId);

    const saleIds = (todaySales.data||[]).map(s => s.id).filter(Boolean);
    const { data: tItems } = saleIds.length
      ? await supabase.from('sale_items').select('qty,unit_price').eq('shop_id', shopId).in('sale_id', saleIds)
      : { data: [] };

    const tCost   = (tItems||[]).reduce((s,r) => s + num(r.qty)*num(r.unit_price), 0);
    const tProfit = tSales - tCost - tExp;

    return res.json({
      ok: true,
      today: {
        date:       today,
        sales:      tSales,
        cash:       tCash,
        credit:     tCredit,
        discount:   tDisc,
        expenses:   tExp,
        profit:     tProfit,
        txCount:    (todaySales.data||[]).length
      },
      month: {
        sales:    mSales,
        expenses: mExp,
        profit:   mSales - mExp
      },
      dues: {
        customers: totalCustDue,
        suppliers: totalSuppDue
      },
      lowStock: lowItems.map(p => ({ id: p.id, name: p.name, unit: p.unit, qty: num(p.stock_qty), alert: num(p.low_stock_alert) })),
      recentSales: (recentSales.data||[]).map(r => ({
        id:           String(r.id),
        customerName: r.customer_name || 'সাধারণ ক্রেতা',
        total:        num(r.total),
        paymentType:  r.payment_type,
        date:         iso(r.date)
      }))
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
};
