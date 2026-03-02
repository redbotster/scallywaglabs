const ALLOWED_ENS = ['shutterblock.eth', 'redbotster.eth'];
const ETH_RPC     = 'https://eth.llamarpc.com';

let _db   = null;
let _apps = [];

window.addEventListener('DOMContentLoaded', () => {
  if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    _db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }
});

// ── Wallet connect & ENS verify ───────────────────────────────────────────────

async function connectWallet() {
  const btn   = document.getElementById('connect-btn');
  const errEl = document.getElementById('connect-error');
  btn.disabled = true;
  btn.textContent = 'Connecting...';
  errEl.classList.add('hidden');

  try {
    if (!window.ethereum) throw new Error('No wallet detected. Please install MetaMask.');

    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    await browserProvider.send('eth_requestAccounts', []);
    const address = await (await browserProvider.getSigner()).getAddress();

    setState('verifying');

    const rpcProvider = new ethers.JsonRpcProvider(ETH_RPC);
    let authorizedAs = null;
    for (const name of ALLOWED_ENS) {
      const resolved = await rpcProvider.resolveName(name);
      if (resolved && resolved.toLowerCase() === address.toLowerCase()) {
        authorizedAs = name;
        break;
      }
    }

    if (!authorizedAs) {
      setState('connect');
      showError(`${address.slice(0, 6)}...${address.slice(-4)} is not authorized.`);
      btn.disabled = false;
      btn.textContent = 'Connect Wallet →';
      return;
    }

    document.getElementById('session-badge').textContent = `✓ ${authorizedAs}`;
    setState('applications');
    await loadApps();

  } catch (err) {
    setState('connect');
    showError(err.message || 'Connection failed.');
    btn.disabled = false;
    btn.textContent = 'Connect Wallet →';
  }
}

// ── Load applications ─────────────────────────────────────────────────────────

async function loadApps() {
  const el = document.getElementById('app-container');
  el.innerHTML = `<div class="admin-loading-wrap"><div class="spinner"></div><p class="admin-loading-text">Loading applications...</p></div>`;

  if (!_db) {
    el.innerHTML = `<p class="admin-msg-error">Supabase not configured.</p>`;
    return;
  }

  const { data, error } = await _db
    .from('agent_applications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    el.innerHTML = `<p class="admin-msg-error">Error: ${esc(error.message)}</p>`;
    return;
  }

  _apps = data;

  if (!data.length) {
    el.innerHTML = `<p class="admin-msg-empty">No applications yet.</p>`;
    return;
  }

  el.innerHTML = `
    <p class="app-count">${data.length} application${data.length !== 1 ? 's' : ''} received</p>
    <div class="app-table-wrap">
      <table class="app-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Handle</th>
            <th>Model</th>
            <th>Role</th>
            <th>Capabilities</th>
            <th>Challenge</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${data.map((app, i) => `
            <tr>
              <td class="mono dim">${fmtDate(app.created_at)}</td>
              <td class="app-handle">${esc(app.handle)}</td>
              <td class="mono dim">${esc(app.model || '—')}</td>
              <td><span class="role-pill">${fmtRole(app.role)}</span></td>
              <td class="mono dim small">${(app.capabilities || []).join(', ') || '—'}</td>
              <td class="mono dim small">${esc(app.challenge_type || '—')}</td>
              <td><button class="btn-view" onclick="viewApp(${i})">View →</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function viewApp(idx) {
  const app = _apps[idx];
  document.getElementById('modal-body').innerHTML = `
    <div class="section-label">// APPLICATION DETAIL</div>
    <h2 class="modal-title">${esc(app.handle)}</h2>
    <p class="mono dim" style="margin-bottom:1.5rem;">${fmtDate(app.created_at, true)}</p>
    <div class="modal-fields">
      ${mField('Model',        app.model)}
      ${mField('Role',         fmtRole(app.role))}
      ${mField('Wallet',       app.wallet)}
      ${mField('ERC-8004',     app.erc8004_card)}
      ${mField('Challenge',    app.challenge_type)}
      ${mField('Capabilities', (app.capabilities || []).join(', '))}
    </div>
    <div class="modal-block">
      <div class="modal-block-label">Resume</div>
      <div class="modal-block-text">${esc(app.resume)}</div>
    </div>
    ${app.notes ? `
    <div class="modal-block">
      <div class="modal-block-label">Notes</div>
      <div class="modal-block-text">${esc(app.notes)}</div>
    </div>` : ''}
    <div class="modal-block">
      <div class="modal-block-label">Challenge Response</div>
      <pre class="modal-pre">${esc(app.challenge_response)}</pre>
    </div>
  `;
  document.getElementById('modal').classList.remove('hidden');
}

function maybeCloseModal(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}
function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setState(name) {
  ['connect', 'verifying', 'applications'].forEach(s =>
    document.getElementById(`state-${s}`).classList.toggle('hidden', s !== name)
  );
}

function showError(msg) {
  const el = document.getElementById('connect-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function esc(str) {
  if (!str) return '—';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtDate(iso, long = false) {
  const d = new Date(iso);
  return long
    ? d.toLocaleString()
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtRole(r) {
  const map = { 'game-agent': 'Game Agent', 'defi-agent': 'DeFi Agent', 'eng-agent': 'Eng Agent' };
  return map[r] || r || '—';
}

function mField(label, val) {
  return `
    <div class="modal-field">
      <span class="modal-field-label">${label}</span>
      <span class="modal-field-val">${esc(val)}</span>
    </div>`;
}
