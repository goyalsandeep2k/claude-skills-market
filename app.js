// ── CONFIG ──────────────────────────────────────────────────────────────────
// GitHub Device Flow OAuth — works purely on GitHub Pages, no backend needed.
// The client_id is intentionally public (Device Flow never uses the secret).
const CONFIG = {
  GITHUB_CLIENT_ID: 'Ov23li0JzEUXU90fDHS0',
  GITHUB_REPO: 'goyalsandeep2k/claude-skills',
  SKILLS_DATA: './skills.json',
  // CORS proxy for GitHub's OAuth endpoints (they block direct browser calls)
  CORS_PROXY: 'https://corsproxy.io/?',
};

// ── STATE ────────────────────────────────────────────────────────────────────
let allSkills = [];
let filtered  = [];
let activeCat = 'all';
let query     = '';

// ── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  handleAuthCallback();   // must run before restoreSession to avoid flash
  restoreSession();
  await loadSkills();
  await loadContributors();
  setupSearch();
  setupNav();
});

// ── NAV SCROLL ───────────────────────────────────────────────────────────────
function setupNav() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 10));

  document.getElementById('navToggle').addEventListener('click', () => {
    document.querySelector('.nav-center').classList.toggle('open');
  });
}

// ── LOAD SKILLS ──────────────────────────────────────────────────────────────
async function loadSkills() {
  try {
    const data = await fetch(CONFIG.SKILLS_DATA).then(r => r.json());
    allSkills = data.skills;
    filtered  = [...allSkills];

    document.getElementById('st-skills').textContent      = data.stats.totalSkills;
    document.getElementById('st-downloads').textContent   = data.stats.totalDownloads;
    document.getElementById('st-contributors').textContent = data.stats.totalContributors;
    document.getElementById('st-stars').textContent       = data.stats.totalStars;

    renderCategories(data.categories);
    renderSkills();
  } catch (e) {
    document.getElementById('skillsGrid').innerHTML =
      '<p style="color:var(--text-muted);padding:20px">Could not load skills data.</p>';
  }
}

// ── CATEGORIES ───────────────────────────────────────────────────────────────
function renderCategories(cats) {
  document.getElementById('cats').innerHTML = cats.map(c => `
    <button class="cat-chip${c.id === 'all' ? ' active' : ''}"
      data-cat="${c.id}" onclick="filterCat('${c.id}')">${c.label}</button>
  `).join('');
}

function filterCat(cat) {
  activeCat = cat;
  document.querySelectorAll('.cat-chip').forEach(el =>
    el.classList.toggle('active', el.dataset.cat === cat)
  );
  applyFilters();
}

// ── SEARCH ───────────────────────────────────────────────────────────────────
function setupSearch() {
  const input = document.getElementById('searchInput');
  const clear = document.getElementById('searchClear');
  input.addEventListener('input', e => {
    query = e.target.value.toLowerCase().trim();
    clear.style.display = query ? 'flex' : 'none';
    applyFilters();
  });
  input.addEventListener('keydown', e => { if (e.key === 'Escape') clearSearch(); });
}

function clearSearch() {
  query = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  applyFilters();
}

// ── FILTERS ──────────────────────────────────────────────────────────────────
function applyFilters() {
  filtered = allSkills.filter(s => {
    const inCat    = activeCat === 'all' || s.category === activeCat;
    const inSearch = !query
      || s.name.toLowerCase().includes(query)
      || s.fullName.toLowerCase().includes(query)
      || s.description.toLowerCase().includes(query)
      || s.tags.some(t => t.includes(query));
    return inCat && inSearch;
  });
  renderSkills();
}

// ── RENDER SKILLS ─────────────────────────────────────────────────────────────
function renderSkills() {
  const grid     = document.getElementById('skillsGrid');
  const heading  = document.getElementById('skillsH');
  const count    = document.getElementById('skillsCount');
  const noRes    = document.getElementById('noResults');

  if (!filtered.length) {
    grid.innerHTML = '';
    noRes.style.display = 'flex';
    count.textContent = '';
    return;
  }

  noRes.style.display = 'none';
  heading.textContent = activeCat === 'all' ? 'All Skills' : filtered[0]?.category || 'Skills';
  count.textContent   = `${filtered.length} skill${filtered.length !== 1 ? 's' : ''}`;

  grid.innerHTML = filtered.map(s => `
    <div class="skill-card" style="--card-color:${s.color}" onclick="openModal('${s.id}')">
      <div class="skill-card-top">
        <div class="skill-emoji-wrap">${s.emoji}</div>
        <div class="skill-info">
          <div class="skill-name">${s.name}</div>
          <div class="skill-fullname">${s.fullName}</div>
          <div class="skill-author">
            <img src="https://github.com/${s.author}.png?size=20" class="skill-author-img" alt="" onerror="this.style.display='none'">
            @${s.author}
          </div>
        </div>
        ${s.featured ? '<span class="skill-featured">Featured</span>' : ''}
      </div>
      <div class="skill-desc">${s.description}</div>
      <div class="skill-tags">${s.tags.slice(0,3).map(t => `<span class="skill-tag">${t}</span>`).join('')}</div>
      <div class="skill-card-foot">
        <div class="skill-foot-stats">
          <span class="skill-foot-stat">⬇ ${s.downloads}</span>
          <span class="skill-foot-stat">⭐ ${s.stars}</span>
        </div>
        <button class="btn-install" onclick="event.stopPropagation(); quickInstall('${s.id}', this)">
          Install
        </button>
      </div>
    </div>
  `).join('');
}

// ── QUICK INSTALL (card button) ───────────────────────────────────────────────
async function quickInstall(id, btn) {
  const skill = allSkills.find(s => s.id === id);
  if (!skill) return;
  const orig = btn.textContent;
  btn.textContent = '⏳'; btn.disabled = true;
  try {
    const text = await fetch(skill.rawUrl).then(r => { if (!r.ok) throw 0; return r.text(); });
    downloadBlob(text, 'SKILL.md');
    btn.textContent = '✓ Done!';
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2200);
  } catch {
    window.open(skill.rawUrl, '_blank');
    btn.textContent = orig; btn.disabled = false;
  }
}

function downloadBlob(text, filename) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })),
    download: filename,
  });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(a.href);
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function openModal(id) {
  const s = allSkills.find(x => x.id === id);
  if (!s) return;

  document.getElementById('modalBody').innerHTML = `
    <div class="modal-hd">
      <div class="modal-emoji-wrap">${s.emoji}</div>
      <div>
        <div class="modal-title">${s.fullName}</div>
        <div class="modal-author">
          <img src="https://github.com/${s.author}.png?size=24" class="modal-author-img" alt="" onerror="this.style.display='none'">
          by <a href="https://github.com/${s.author}" target="_blank">@${s.author}</a>
          ${s.featured ? '&nbsp;<span class="skill-featured">Featured</span>' : ''}
        </div>
      </div>
    </div>
    <p class="modal-desc">${s.longDescription}</p>
    <div class="modal-tags">${s.tags.map(t => `<span class="skill-tag">${t}</span>`).join('')}</div>
    <div class="modal-stats">
      <div class="modal-stat"><strong>${s.downloads}</strong><span>Downloads</span></div>
      <div class="modal-stat"><strong>${s.stars}</strong><span>Stars</span></div>
      <div class="modal-stat"><strong style="text-transform:capitalize">${s.category}</strong><span>Category</span></div>
    </div>
    <div class="modal-install-section">
      <div class="install-step">
        <div class="install-step-label">Step 1 — Download the skill</div>
        <button class="btn-install-modal" onclick="quickInstall('${s.id}', this)">⬇ Download SKILL.md</button>
      </div>
      <div class="install-step">
        <div class="install-step-label">Step 2 — Move to your Claude skills folder</div>
        <code class="install-cmd">mkdir -p ~/.claude/skills/${s.id} && mv ~/Downloads/SKILL.md ~/.claude/skills/${s.id}/</code>
      </div>
      <div class="install-step">
        <div class="install-step-label">Step 3 — Use it in Claude Code</div>
        <code class="install-cmd">claude  # just describe what you need — the skill auto-triggers</code>
      </div>
    </div>
    <div class="modal-footer-link">
      <a href="${s.repoUrl}" target="_blank">View source on GitHub →</a>
    </div>
  `;

  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeAuthModal(); } });

// ── CONTRIBUTORS ─────────────────────────────────────────────────────────────
async function loadContributors() {
  const grid = document.getElementById('contribGrid');
  try {
    const contribs = await fetch(
      `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/contributors?per_page=10`
    ).then(r => r.json());

    if (!Array.isArray(contribs) || !contribs.length) throw 0;

    grid.innerHTML = contribs.map((c, i) => `
      <a href="${c.html_url}" target="_blank" class="contrib-card">
        <img src="${c.avatar_url}&s=80" alt="${c.login}" class="contrib-avatar">
        <div class="contrib-name">@${c.login}</div>
        <div class="contrib-skills">${c.contributions} commits</div>
        ${i === 0 ? '<div class="contrib-star">★ Top Contributor</div>' : ''}
      </a>
    `).join('');
  } catch {
    // Hardcoded fallback
    grid.innerHTML = `
      <a href="https://github.com/goyalsandeep2k" target="_blank" class="contrib-card">
        <img src="https://github.com/goyalsandeep2k.png?size=80" alt="" class="contrib-avatar">
        <div class="contrib-name">@goyalsandeep2k</div>
        <div class="contrib-skills">6 skills</div>
        <div class="contrib-star">★ Founder</div>
      </a>
      <a href="https://github.com/goyalsandeep2k/claude-skills/issues/new?template=skill-submission.yml" target="_blank" class="contrib-card" style="border-style:dashed;opacity:.7">
        <div class="contrib-avatar" style="width:60px;height:60px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:22px">➕</div>
        <div class="contrib-name">Be Next</div>
        <div class="contrib-skills">Submit a skill</div>
      </a>
    `;
  }
}

// ── GITHUB DEVICE FLOW OAUTH ─────────────────────────────────────────────────
// No backend needed. Client ID is public — Device Flow never uses the secret.
// Flow: request device code → show user code → user visits github.com/login/device
//        → we poll for token → fetch profile → done.

let _devicePollTimer = null;

async function handleLogin() {
  closeAuthModal();

  // Show "connecting" state immediately
  const btn = document.getElementById('loginBtn');
  const origHTML = btn.innerHTML;
  btn.innerHTML = '<span style="opacity:.6">Connecting…</span>';
  btn.disabled = true;

  try {
    const proxyBase = CONFIG.CORS_PROXY;

    // Step 1: Request device + user codes
    const codeRes = await fetch(proxyBase + encodeURIComponent('https://github.com/login/device/code'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: CONFIG.GITHUB_CLIENT_ID, scope: 'read:user' }),
    });
    if (!codeRes.ok) throw new Error('device_code_request_failed');
    const { user_code, device_code, verification_uri, interval = 5, expires_in = 900 } = await codeRes.json();
    if (!user_code) throw new Error('no_user_code');

    btn.innerHTML = origHTML; btn.disabled = false;

    // Step 2: Show the code modal
    showDeviceModal(user_code, verification_uri, expires_in);

    // Step 3: Poll in background
    _devicePollTimer = setInterval(async () => {
      try {
        const tokenRes = await fetch(proxyBase + encodeURIComponent('https://github.com/login/oauth/access_token'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            client_id: CONFIG.GITHUB_CLIENT_ID,
            device_code,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        });
        const data = await tokenRes.json();

        if (data.access_token) {
          clearInterval(_devicePollTimer);
          closeDeviceModal();
          localStorage.setItem('gh_token', data.access_token);
          const user = await fetch('https://api.github.com/user', {
            headers: { Authorization: `token ${data.access_token}` },
          }).then(r => r.json());
          saveUser({ login: user.login, name: user.name || user.login, avatar_url: user.avatar_url });
        } else if (data.error === 'expired_token') {
          clearInterval(_devicePollTimer);
          setDeviceModalError('Code expired — please try again.');
        }
        // 'authorization_pending' and 'slow_down' → just keep polling
      } catch { /* network hiccup — keep polling */ }
    }, (interval + 1) * 1000);

  } catch (err) {
    btn.innerHTML = origHTML; btn.disabled = false;
    // Fallback: username connect
    document.getElementById('authOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('ghUsernameInput').focus(), 100);
  }
}

function showDeviceModal(userCode, verifyUrl, expiresIn) {
  const overlay = document.getElementById('deviceOverlay');
  document.getElementById('deviceCode').textContent = userCode;
  document.getElementById('deviceOpenBtn').href = verifyUrl;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Countdown
  let remaining = expiresIn;
  const tick = () => {
    const el = document.getElementById('deviceCountdown');
    if (el) el.textContent = `Code expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
    remaining--;
    if (remaining >= 0) setTimeout(tick, 1000);
  };
  tick();
}

function setDeviceModalError(msg) {
  const el = document.getElementById('deviceError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function closeDeviceModal() {
  clearInterval(_devicePollTimer);
  document.getElementById('deviceOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// Legacy username-connect fallback (shows if Device Flow errors out)
function closeAuthModal() {
  document.getElementById('authOverlay').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('authError').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ghUsernameInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitGitHubUsername();
  });
});

async function submitGitHubUsername() {
  const input = document.getElementById('ghUsernameInput');
  const btn   = document.getElementById('authSubmitBtn');
  const err   = document.getElementById('authError');
  const uname = input.value.trim();
  if (!uname) return;
  btn.textContent = 'Connecting…'; btn.disabled = true;
  err.style.display = 'none';
  try {
    const res = await fetch(`https://api.github.com/users/${uname}`);
    if (!res.ok) throw 0;
    const u = await res.json();
    saveUser({ login: u.login, name: u.name || u.login, avatar_url: u.avatar_url });
    closeAuthModal();
    input.value = '';
  } catch {
    err.style.display = 'block';
  } finally {
    btn.textContent = 'Connect →'; btn.disabled = false;
  }
}

// No redirect callback needed for Device Flow
function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token');
  if (!token) return;
  history.replaceState({}, '', window.location.pathname);
  fetch('https://api.github.com/user', { headers: { Authorization: `token ${token}` } })
    .then(r => r.json())
    .then(u => {
      localStorage.setItem('gh_token', token);
      saveUser({ login: u.login, name: u.name || u.login, avatar_url: u.avatar_url });
    }).catch(() => {});
}

function restoreSession() {
  const user = JSON.parse(localStorage.getItem('gh_user') || 'null');
  if (user) showUser(user);
}

function saveUser(user) {
  localStorage.setItem('gh_user', JSON.stringify(user));
  showUser(user);
}

function showUser(user) {
  document.getElementById('loginBtn').style.display  = 'none';
  document.getElementById('userChip').style.display  = 'flex';
  document.getElementById('userAvatar').src          = user.avatar_url;
  document.getElementById('userName').textContent    = user.name;
}

function handleLogout() {
  localStorage.removeItem('gh_user');
  localStorage.removeItem('gh_token');
  document.getElementById('loginBtn').style.display  = 'flex';
  document.getElementById('userChip').style.display  = 'none';
}
