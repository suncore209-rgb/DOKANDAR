module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  res.json({
    supabaseUrl: !url
      ? '❌ NOT SET — add SUPABASE_URL in Vercel env vars'
      : !url.startsWith('https://')
        ? '❌ WRONG FORMAT — must start with https://'
        : url.includes(' ')
          ? '❌ HAS SPACES — copy again carefully'
          : '✅ Looks correct: ' + url,
    serviceKey: !key
      ? '❌ NOT SET — add SUPABASE_SERVICE_KEY in Vercel env vars'
      : key.length < 100
        ? '❌ TOO SHORT (' + key.length + ' chars) — use service_role key, not anon key'
        : '✅ Set correctly (' + key.length + ' chars)',
    verdict: (!url || !key || !url.startsWith('https://') || key.length < 100)
      ? '🔴 ENV VARS PROBLEM — fix above issues then redeploy'
      : '🟢 Env vars OK — if signup still fails, check Supabase schema'
  });
};
