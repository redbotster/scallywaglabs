const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, reasoning, answer } = req.body || {};

  if (!id || answer === undefined) {
    return res.status(400).json({ error: 'id and answer are required' });
  }
  if (!Array.isArray(reasoning) || reasoning.length < 2) {
    return res.status(400).json({ error: 'reasoning must be an array with at least 2 steps showing your work' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: challenge, error } = await supabase
    .from('api_challenges')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !challenge) {
    return res.status(404).json({ error: 'Challenge not found or already used' });
  }
  if (new Date(challenge.expires_at) < new Date()) {
    await supabase.from('api_challenges').delete().eq('id', id);
    return res.status(410).json({ error: 'Challenge expired. Request a new one from GET /api/challenge.' });
  }

  // ── Validate answer ──────────────────────────────────────────────────────────
  const expected = challenge.answer_data.value;
  let correct = false;

  if (Array.isArray(expected)) {
    // Graph path: accept array or space/comma-separated string
    const submitted = Array.isArray(answer)
      ? answer.map(String)
      : typeof answer === 'string'
        ? answer.split(/[\s,→>]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
        : null;
    correct = submitted &&
      submitted.length === expected.length &&
      submitted.every((n, i) => n.toLowerCase() === expected[i]);
  } else {
    correct = Number(answer) === expected;
  }

  if (!correct) {
    return res.status(200).json({
      ok: false,
      message: 'Incorrect answer. Request a new challenge and try again.',
    });
  }

  // ── Issue verification token ─────────────────────────────────────────────────
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('api_tokens')
    .insert({ challenge_id: id, challenge_type: challenge.type })
    .select('token')
    .single();

  if (tokenErr) {
    console.error('[verify] token error:', tokenErr.message);
    return res.status(500).json({ error: 'Failed to issue token' });
  }

  // Clean up used challenge
  await supabase.from('api_challenges').delete().eq('id', id);

  return res.status(200).json({
    ok: true,
    token: tokenRow.token,
    message: 'Challenge passed. Include this token in your application as proof_of_agency.token.',
  });
};
