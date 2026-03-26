import { getAllProblemStates, getStats, computeCategoryStats, formatTime } from './state.js';

// --- State ---

const filters = {
  category: '',
  difficulties: new Set(['easy', 'medium', 'hard']),
  status: '',
  search: '',
  featuredOnly: false,
};

let manifest = [];

// --- Init ---

async function init() {
  try {
    const res = await fetch('problems/index.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    manifest = await res.json();
  } catch (err) {
    document.getElementById('problem-list').innerHTML =
      `<tr><td colspan="6" style="text-align:center;color:var(--red,#f87171)">Failed to load problems: ${err.message}</td></tr>`;
    return;
  }

  updateTagline();
  renderStatsBar();
  populateCategoryFilter();
  renderTable();
  setupListeners();
}

// --- Tagline ---

function updateTagline() {
  const el = document.querySelector('.tagline');
  if (el) el.textContent = `${manifest.length} problems. Pure numpy. No excuses.`;
}

// --- Stats bar ---

function renderStatsBar() {
  const stats = getStats();
  const allStates = getAllProblemStates();

  const total = manifest.length;
  const solved = Object.values(allStates).filter(s => s.status === 'solved').length;

  const categoryStats = computeCategoryStats(manifest);

  // Top 5 categories by problem count
  const topCategories = Object.entries(categoryStats)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);

  const circumference = 2 * Math.PI * 18; // ~113.1

  const ringsHtml = topCategories.map(([cat, data]) => {
    const pct = data.total > 0 ? (data.solved / data.total) * 100 : 0;
    const offset = circumference - (pct / 100) * circumference;
    const shortName = cat.length > 10 ? cat.slice(0, 9) + '…' : cat;
    return `
      <div class="stat-ring" title="${cat}: ${data.solved}/${data.total}">
        <svg width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" fill="none" stroke="var(--ring-bg,#2d2d3a)" stroke-width="4"/>
          <circle cx="22" cy="22" r="18" fill="none"
            stroke="var(--ring-fg,#6366f1)" stroke-width="4"
            stroke-linecap="round"
            stroke-dasharray="${circumference.toFixed(2)}"
            stroke-dashoffset="${offset.toFixed(2)}"
            transform="rotate(-90 22 22)"/>
        </svg>
        <span class="ring-label">${shortName}</span>
      </div>`;
  }).join('');

  const bar = document.getElementById('stats-bar');
  bar.innerHTML = `
    <div class="stat-item">
      <span class="stat-value">${solved}/${total}</span>
      <span class="stat-label">Solved</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${stats.streak}</span>
      <span class="stat-label">Day Streak</span>
    </div>
    <div class="stat-rings">
      ${ringsHtml}
    </div>`;
}

// --- Category filter ---

function populateCategoryFilter() {
  const sel = document.getElementById('filter-category');
  const categories = [...new Set(manifest.map(p => p.category))].sort();
  for (const cat of categories) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  }
}

// --- Render table ---

function renderTable() {
  const allStates = getAllProblemStates();
  const tbody = document.getElementById('problem-list');
  const searchLower = filters.search.toLowerCase();

  const rows = manifest
    .filter(p => {
      // Category
      if (filters.category && p.category !== filters.category) return false;

      // Difficulty (buttons lowercase, manifest Title Case)
      if (!filters.difficulties.has(p.difficulty.toLowerCase())) return false;

      // Status
      const state = allStates[p.id];
      const status = state ? state.status : 'unsolved';
      if (filters.status && status !== filters.status) return false;

      // Featured
      if (filters.featuredOnly && !p.featured) return false;

      // Search
      if (searchLower) {
        const haystack = [
          String(p.id),
          p.title,
          ...(p.tags || []),
        ].join(' ').toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }

      return true;
    })
    .map(p => {
      const state = allStates[p.id];
      const status = state ? state.status : 'unsolved';
      const bestTimeMs = state ? state.bestTimeMs : null;

      let statusSymbol = '';
      if (status === 'solved') statusSymbol = '&#10003;';
      else if (status === 'attempted') statusSymbol = '&mdash;';

      const diffClass = `diff-${p.difficulty.toLowerCase()}`;

      const bestTime = bestTimeMs !== null ? formatTime(bestTimeMs) : '';

      const featuredClass = p.featured ? ' featured-row' : '';
      const featuredStar = p.featured ? '<span class="featured-star" title="Samsung Interview Prep">&#9733;</span> ' : '';

      return `<tr class="problem-row${featuredClass}" data-id="${p.id}" tabindex="0" role="button" aria-label="${p.title}">
        <td class="col-num">${p.id}</td>
        <td class="col-title">${featuredStar}${escapeHtml(p.title)}</td>
        <td class="col-difficulty"><span class="${diffClass}">${escapeHtml(p.difficulty)}</span></td>
        <td class="col-category">${escapeHtml(p.category)}</td>
        <td class="col-status">${statusSymbol}</td>
        <td class="col-time">${bestTime}</td>
      </tr>`;
    });

  tbody.innerHTML = rows.join('');

  // Attach click (and keyboard) listeners to rows
  for (const row of tbody.querySelectorAll('.problem-row')) {
    row.addEventListener('click', () => {
      window.location.href = `problem.html?id=${row.dataset.id}`;
    });
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.location.href = `problem.html?id=${row.dataset.id}`;
      }
    });
  }
}

// --- Listeners ---

function setupListeners() {
  document.getElementById('filter-category').addEventListener('change', e => {
    filters.category = e.target.value;
    renderTable();
  });

  document.getElementById('filter-status').addEventListener('change', e => {
    filters.status = e.target.value;
    renderTable();
  });

  document.getElementById('filter-search').addEventListener('input', e => {
    filters.search = e.target.value;
    renderTable();
  });

  const featuredBtn = document.getElementById('filter-featured');
  if (featuredBtn) {
    featuredBtn.addEventListener('click', () => {
      filters.featuredOnly = !filters.featuredOnly;
      featuredBtn.classList.toggle('active', filters.featuredOnly);
      featuredBtn.setAttribute('aria-pressed', String(filters.featuredOnly));
      renderTable();
    });
  }

  for (const btn of document.querySelectorAll('.difficulty-filters [data-difficulty]')) {
    btn.addEventListener('click', () => {
      const diff = btn.dataset.difficulty; // lowercase
      if (filters.difficulties.has(diff)) {
        filters.difficulties.delete(diff);
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      } else {
        filters.difficulties.add(diff);
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      }
      renderTable();
    });
  }
}

// --- Utilities ---

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Boot ---

init();
