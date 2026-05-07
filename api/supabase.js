const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

async function supabase(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=representation' : 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Supabase error: ' + err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { action, data, filter } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (action === 'upsert') {
      const result = await supabase('POST', '/scores?on_conflict=spotify_id', data);
      return res.status(200).json({ data: result });
    }

    if (action === 'leaderboard') {
      let path = '/scores?select=*&order=score.desc&limit=100';
      if (filter?.country) path += `&country=eq.${filter.country}`;
      else if (filter?.region) path += `&region=eq.${filter.region}`;
      const result = await supabase('GET', path);
      return res.status(200).json({ data: result });
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
