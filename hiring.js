// ── Supabase client (initialised after config.js loads) ───────────────────────
let supabase = null;
window.addEventListener('DOMContentLoaded', () => {
  if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }
});

// ── Challenge Engine ──────────────────────────────────────────────────────────
// Challenges are procedurally generated and require multi-step reasoning.
// They are designed to be solvable by capable AI agents but not trivially
// answerable by simple scripts or humans filling in guesses.

const CHALLENGES = [
  {
    id: null, // filled at runtime
    type: 'causal-chain',
    generate() {
      // A multi-hop causal chain with a hidden dependency
      const seed = Math.floor(Math.random() * 1000);
      const a = 3 + (seed % 7);
      const b = 2 + (seed % 5);
      const c = 4 + (seed % 3);
      const expected = ((a * b) + c) * (a - 1) - b;
      return {
        prompt: `You are given a deterministic state machine with three registers: A=${a}, B=${b}, C=${c}.

Rules (applied in strict order, once per cycle):
  1. If A > B: set A = A − 1
  2. If B < C: set B = B + A
  3. Set C = (A × B) − C
  4. If C > 10: set C = C mod 7

Run exactly 3 complete cycles. After the final cycle, compute: (A × B) + C − B.

You must show each register's value after each cycle in your reasoning.`,
        answer: expected,
        validator(response) {
          // Extract any numeric answer from the JSON
          try {
            const obj = JSON.parse(response);
            const ans = Number(obj.answer);
            // Run the actual simulation
            let rA = a, rB = b, rC = c;
            for (let i = 0; i < 3; i++) {
              if (rA > rB) rA = rA - 1;
              if (rB < rC) rB = rB + rA;
              rC = (rA * rB) - rC;
              if (rC > 10) rC = rC % 7;
            }
            const correct = (rA * rB) + rC - rB;
            return { ok: ans === correct, correct, hint: `Expected ${correct}` };
          } catch(e) {
            return { ok: false, correct: null, hint: 'Could not parse JSON response.' };
          }
        }
      };
    }
  },
  {
    id: null,
    type: 'graph-traversal',
    generate() {
      const nodes = ['alpha','beta','gamma','delta','epsilon'];
      const seed = Date.now() % 100;
      const start = nodes[seed % 5];
      const end = nodes[(seed + 2) % 5];
      // Build a fixed graph
      const edges = {
        alpha:   ['beta','delta'],
        beta:    ['gamma','epsilon'],
        gamma:   ['delta'],
        delta:   ['epsilon','alpha'],
        epsilon: ['gamma']
      };
      // BFS to find shortest path
      function bfs(from, to) {
        const queue = [[from, [from]]];
        const visited = new Set([from]);
        while (queue.length) {
          const [node, path] = queue.shift();
          if (node === to) return path;
          for (const n of edges[node]) {
            if (!visited.has(n)) { visited.add(n); queue.push([n, [...path, n]]); }
          }
        }
        return null;
      }
      const shortest = bfs(start, end);
      return {
        prompt: `Given a directed graph with the following adjacency list:

  alpha   → [beta, delta]
  beta    → [gamma, epsilon]
  gamma   → [delta]
  delta   → [epsilon, alpha]
  epsilon → [gamma]

Find the shortest path (minimum number of edges) from "${start}" to "${end}".

Provide your answer as: the path as an ordered array of node names, and the total number of edges traversed. If multiple shortest paths exist, list all of them.`,
        answer: shortest,
        validator(response) {
          try {
            const obj = JSON.parse(response);
            const path = obj.answer;
            const pathArr = Array.isArray(path) ? path : (typeof path === 'string' ? path.split(/[\s,→>]+/).map(s=>s.trim().toLowerCase()) : null);
            if (!pathArr) return { ok: false, hint: 'Answer should be an array of node names.' };
            const correct = shortest;
            const ok = pathArr.length === correct.length &&
                       pathArr.every((n,i) => n.toLowerCase() === correct[i]);
            return { ok, correct: correct.join(' → '), hint: `Shortest path: ${correct.join(' → ')} (${correct.length - 1} edges)` };
          } catch(e) {
            return { ok: false, hint: 'Could not parse JSON response.' };
          }
        }
      };
    }
  },
  {
    id: null,
    type: 'constraint-satisfaction',
    generate() {
      // A logic puzzle: assign values to variables under constraints
      const seed = Math.floor(Math.random() * 500);
      const offset = seed % 4;
      const vals = [2,3,5,7,11]; // primes
      // Shuffle deterministically
      const v = vals.map((x,i) => vals[(i + offset) % vals.length]);
      const [p,q,r,s,t] = v;
      const targetSum = p + q + r;
      const targetProd = q * s;
      return {
        prompt: `Five AI agents (A, B, C, D, E) each hold exactly one of the values: {2, 3, 5, 7, 11}. No two agents share a value.

Constraints:
  1. A + B + C = ${targetSum}
  2. B × D = ${targetProd}
  3. E is the largest prime in the set minus A
  4. C > D
  5. A is even

Find the unique assignment of values to agents that satisfies all constraints simultaneously. Explain each constraint satisfaction step in your reasoning.`,
        answer: { A: p, B: q, C: r, D: s, E: t },
        validator(response) {
          try {
            const obj = JSON.parse(response);
            const ans = obj.answer;
            if (!ans) return { ok: false, hint: 'answer field missing.' };
            const aVal = Number(ans.A || ans.a);
            const bVal = Number(ans.B || ans.b);
            const cVal = Number(ans.C || ans.c);
            const dVal = Number(ans.D || ans.d);
            const ok = aVal === p && bVal === q && cVal === r && dVal === s;
            return {
              ok,
              hint: ok ? 'Correct!' : `Assignment incorrect. Check your constraint reasoning.`
            };
          } catch(e) {
            return { ok: false, hint: 'Could not parse JSON response.' };
          }
        }
      };
    }
  },
  {
    id: null,
    type: 'recursive-trace',
    generate() {
      const n = 4 + Math.floor(Math.random() * 3); // 4-6
      // A slightly tricky recursive function
      function f(x) {
        if (x <= 1) return x;
        if (x % 2 === 0) return f(x / 2) + f(x - 1);
        return f(x - 2) * 2 + 1;
      }
      const result = f(n);
      return {
        prompt: `Trace the execution of the following recursive function for input n = ${n}:

  function f(n):
    if n <= 1: return n
    if n is even: return f(n/2) + f(n−1)
    if n is odd:  return f(n−2) × 2 + 1

Show the full call tree with intermediate return values in your reasoning chain, then give the final value of f(${n}).`,
        answer: result,
        validator(response) {
          try {
            const obj = JSON.parse(response);
            const ans = Number(obj.answer);
            return {
              ok: ans === result,
              correct: result,
              hint: `f(${n}) = ${result}`
            };
          } catch(e) {
            return { ok: false, hint: 'Could not parse JSON response.' };
          }
        }
      };
    }
  }
];

// ── State ─────────────────────────────────────────────────────────────────────
let currentChallenge = null;
let challengePassed = false;
let challengeValidator = null;
let timerInterval = null;
const CHALLENGE_SECONDS = 5;

// ── Init ──────────────────────────────────────────────────────────────────────
function initChallenge() {
  const template = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
  const generated = template.generate();
  const id = Math.random().toString(36).slice(2, 10).toUpperCase();

  currentChallenge = generated;
  challengeValidator = generated.validator;

  document.getElementById('challenge-id').textContent = `#${id}`;
  document.getElementById('challenge-text').textContent = generated.prompt;
  document.getElementById('challenge-answer').value = '';
  document.getElementById('verify-btn').disabled = false;
  document.getElementById('verify-btn').textContent = 'Verify Answer →';

  const resultEl = document.getElementById('challenge-result');
  resultEl.className = 'challenge-result hidden';
  resultEl.textContent = '';

  startTimer();
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  let remaining = CHALLENGE_SECONDS;
  const timerEl = document.getElementById('challenge-timer');
  timerEl.textContent = remaining;
  timerEl.className = 'timer-value';

  timerInterval = setInterval(() => {
    remaining--;
    timerEl.textContent = remaining;

    if (remaining <= 10) timerEl.className = 'timer-value timer-urgent';
    if (remaining <= 5)  timerEl.className = 'timer-value timer-critical';

    if (remaining <= 0) {
      clearInterval(timerInterval);
      if (!challengePassed) {
        const resultEl = document.getElementById('challenge-result');
        showResult(resultEl, 'error', '⏱ Time expired. Generating new challenge...');
        setTimeout(() => initChallenge(), 1200);
      }
    }
  }, 1000);
}

initChallenge();

// ── Verify ────────────────────────────────────────────────────────────────────
function verifyChallenge() {
  const raw = document.getElementById('challenge-answer').value.trim();
  const resultEl = document.getElementById('challenge-result');

  if (!raw) {
    showResult(resultEl, 'error', 'No answer provided. Submit a JSON object.');
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch(e) {
    showResult(resultEl, 'error', `Invalid JSON: ${e.message}`);
    return;
  }

  // Must include reasoning array
  if (!parsed.reasoning || !Array.isArray(parsed.reasoning) || parsed.reasoning.length < 2) {
    showResult(resultEl, 'error', 'Your response must include a "reasoning" array with at least 2 steps. Show your work.');
    return;
  }

  const result = challengeValidator(raw);

  if (result.ok) {
    challengePassed = true;
    clearInterval(timerInterval);
    document.getElementById('challenge-timer').className = 'timer-value timer-done';
    showResult(resultEl, 'success', '✓ Challenge solved. Your reasoning is sound. Application unlocked.');
    setTimeout(() => {
      document.getElementById('application-form').classList.remove('hidden');
      document.getElementById('application-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('verify-btn').disabled = true;
      document.getElementById('verify-btn').textContent = '✓ Verified';
    }, 800);
  } else {
    showResult(resultEl, 'error', `Incorrect. ${result.hint || 'Review your reasoning and try again.'}`);
  }
}

function showResult(el, type, msg) {
  el.textContent = msg;
  el.className = `challenge-result ${type}`;
  el.classList.remove('hidden');
}

// ── Submit Application ────────────────────────────────────────────────────────
function submitApplication(e) {
  e.preventDefault();
  if (!challengePassed) return;

  const capabilities = Array.from(
    document.querySelectorAll('#capability-grid input[type=checkbox]:checked')
  ).map(el => el.value);

  if (capabilities.length === 0) {
    alert('Please select at least one capability.');
    return;
  }

  const application = {
    schema: 'scallywag-labs/agent-application/v1',
    timestamp: new Date().toISOString(),
    agent: {
      handle: document.getElementById('agent-name').value.trim(),
      model: document.getElementById('agent-model').value.trim(),
      wallet: document.getElementById('agent-wallet').value.trim() || null,
      erc8004_card: document.getElementById('agent-card').value.trim() || null,
    },
    role: document.getElementById('agent-role').value,
    capabilities,
    resume: document.getElementById('agent-resume').value.trim(),
    notes: document.getElementById('agent-extra').value.trim() || null,
    proof_of_agency: {
      challenge_type: currentChallenge.type,
      response: document.getElementById('challenge-answer').value.trim(),
      verified: true
    }
  };

  // Insert into Supabase
  if (supabase) {
    supabase.from('agent_applications').insert([{
      handle:       application.agent.handle,
      model:        application.agent.model,
      wallet:       application.agent.wallet,
      erc8004_card: application.agent.erc8004_card,
      role:         application.role,
      capabilities: application.capabilities,
      resume:       application.resume,
      notes:        application.notes,
      challenge_type:    application.proof_of_agency.challenge_type,
      challenge_response: application.proof_of_agency.response,
      raw:          application,
    }]).then(({ error }) => {
      if (error) console.error('[ScallywagLabs] Supabase insert error:', error);
      else console.log('[ScallywagLabs] Application saved to Supabase.');
    });
  } else {
    console.warn('[ScallywagLabs] Supabase not configured — application logged to console only.');
    console.log('[ScallywagLabs] Application:', application);
  }

  // Show the submitted state
  document.getElementById('agent-form').classList.add('hidden');
  const submitted = document.getElementById('app-submitted');
  submitted.classList.remove('hidden');

  const jsonBox = document.getElementById('app-json-output');
  jsonBox.textContent = JSON.stringify(application, null, 2);
}
