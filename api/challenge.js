const { createClient } = require('@supabase/supabase-js');

// ── Challenge generators ───────────────────────────────────────────────────────

function generateChallenge() {
  const pick = Math.floor(Math.random() * 3);

  if (pick === 0) {
    // Causal-chain state machine
    const seed = Math.floor(Math.random() * 1000);
    const a = 3 + (seed % 7), b = 2 + (seed % 5), c = 4 + (seed % 3);
    let rA = a, rB = b, rC = c;
    for (let i = 0; i < 3; i++) {
      if (rA > rB) rA -= 1;
      if (rB < rC) rB += rA;
      rC = (rA * rB) - rC;
      if (rC > 10) rC = rC % 7;
    }
    const answer = (rA * rB) + rC - rB;
    return {
      type: 'causal-chain',
      prompt: `State machine with registers A=${a}, B=${b}, C=${c}.\n\nRules applied each cycle in order:\n  1. if A > B: A = A - 1\n  2. if B < C: B = B + A\n  3. C = (A × B) - C\n  4. if C > 10: C = C mod 7\n\nRun exactly 3 cycles. After the final cycle, compute: (A × B) + C - B.\n\nShow register values after each cycle in your reasoning.`,
      answer,
    };
  }

  if (pick === 1) {
    // Recursive trace
    const n = 4 + Math.floor(Math.random() * 4); // 4-7
    function f(x) {
      if (x <= 1) return x;
      if (x % 2 === 0) return f(x / 2) + f(x - 1);
      return f(x - 2) * 2 + 1;
    }
    const answer = f(n);
    return {
      type: 'recursive-trace',
      prompt: `Trace the recursive function for n = ${n}:\n\n  f(n):\n    if n <= 1: return n\n    if n is even: return f(n/2) + f(n-1)\n    if n is odd:  return f(n-2) * 2 + 1\n\nWhat is f(${n})? Show the full call tree in your reasoning.`,
      answer,
    };
  }

  // Graph traversal
  const nodes = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
  const seed = Date.now() % 97;
  const start = nodes[seed % 5];
  const end   = nodes[(seed + 2) % 5];
  const edges = {
    alpha:   ['beta', 'delta'],
    beta:    ['gamma', 'epsilon'],
    gamma:   ['delta'],
    delta:   ['epsilon', 'alpha'],
    epsilon: ['gamma'],
  };
  function bfs(from, to) {
    const queue = [[from, [from]]];
    const visited = new Set([from]);
    while (queue.length) {
      const [node, path] = queue.shift();
      if (node === to) return path;
      for (const n of (edges[node] || [])) {
        if (!visited.has(n)) { visited.add(n); queue.push([n, [...path, n]]); }
      }
    }
    return null;
  }
  const answer = bfs(start, end);
  return {
    type: 'graph-traversal',
    prompt: `Directed graph adjacency list:\n  alpha   → [beta, delta]\n  beta    → [gamma, epsilon]\n  gamma   → [delta]\n  delta   → [epsilon, alpha]\n  epsilon → [gamma]\n\nFind the shortest path from "${start}" to "${end}". Return the path as an ordered array of node names.`,
    answer,
  };
}

// ── Handler ────────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { type, prompt, answer } = generateChallenge();

  const { data, error } = await supabase
    .from('api_challenges')
    .insert({ type, prompt, answer_data: { value: answer } })
    .select('id')
    .single();

  if (error) {
    console.error('[challenge] supabase error:', error.message);
    return res.status(500).json({ error: 'Failed to create challenge' });
  }

  return res.status(200).json({
    id: data.id,
    type,
    prompt,
    instructions: 'POST /api/verify with { id, reasoning: string[], answer: any }',
    expires_in_minutes: 10,
  });
};
