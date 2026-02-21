// ═══════════════════════════════════════════════════════════════
// TIPS Dashboard — pages/qaReview.js
// Page 4: Q&A Review — accordion list with filters
// ═══════════════════════════════════════════════════════════════
import { sessionData, fmtTime, scoreClass, verdictClass } from '../dataLoader.js';
import { COMPETENCY_KEYS } from '../config.js';

let activeFilter = 'all';
let searchQuery = '';
let sortMode = 'order';

export function renderQA(el) {
    if (!sessionData.loaded) { el.innerHTML = noData(); return; }
    el.innerHTML = buildQA();
    setupFilters();
    renderCards();
}

function noData() {
    return `<div class="empty-state"><div class="es-icon">💬</div><div class="es-title">No session loaded</div></div>`;
}

function buildQA() {
    return `
  <div class="section-header">
    <div class="section-title">Q&amp;A Review</div>
    <div class="section-sub">Full transcript with scores and LLM reasoning per question</div>
  </div>
  <div class="qa-layout">
    <!-- Filters Sidebar -->
    <div class="qa-sidebar">
      <div class="filter-card">
        <div class="filter-title">Filters</div>

        <div class="filter-group">
          <div class="filter-label">Search</div>
          <input type="text" class="search-input" id="qaSearch" placeholder="Search questions…" />
        </div>

        <div class="filter-group">
          <div class="filter-label">Verdict</div>
          <div class="filter-btn-group">
            <button class="filter-btn active" data-filter="all">All Questions</button>
            <button class="filter-btn" data-filter="strong">Strong Progress</button>
            <button class="filter-btn" data-filter="weak">Needs Improvement</button>
          </div>
        </div>

        <div class="filter-group">
          <div class="filter-label">Sort By</div>
          <div class="filter-btn-group">
            <button class="filter-btn active" data-sort="order">Question Order</button>
            <button class="filter-btn" data-sort="score_desc">Highest Score</button>
            <button class="filter-btn" data-sort="score_asc">Lowest Score</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Cards -->
    <div>
      <div class="qa-count" id="qaCount"></div>
      <div id="qaCards"></div>
    </div>
  </div>`;
}

function getQAPairs() {
    const qa = sessionData.qa_pairs?.qa_pairs || [];
    const cp = sessionData.checkpoints || [];
    return qa.map(pair => {
        const cpEntry = cp.find(c => c.checkpoint === pair.question_id) || {};
        return { ...pair, cpEntry };
    });
}

function verdictCls(v = '') {
    const l = v.toLowerCase();
    if (l.includes('strong')) return 'strong';
    if (l.includes('weak') || l.includes('needs')) return 'weak';
    return 'poor';
}

function filterAndSortPairs(pairs) {
    let list = [...pairs];

    // Search filter
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        list = list.filter(p =>
            p.question_text?.toLowerCase().includes(q) ||
            p.answer?.text?.toLowerCase().includes(q) ||
            (p.cpEntry?.matched_keywords || []).some(k => k.toLowerCase().includes(q))
        );
    }

    // Verdict filter
    if (activeFilter !== 'all') {
        list = list.filter(p => {
            const cls = verdictCls(p.cpEntry?.incremental_verdict || '');
            return activeFilter === 'strong' ? cls === 'strong' : cls !== 'strong';
        });
    }

    // Sort
    if (sortMode === 'score_desc') {
        list.sort((a, b) => (b.cpEntry?.relevance_score || 0) - (a.cpEntry?.relevance_score || 0));
    } else if (sortMode === 'score_asc') {
        list.sort((a, b) => (a.cpEntry?.relevance_score || 0) - (b.cpEntry?.relevance_score || 0));
    }

    return list;
}

function renderCards() {
    const pairs = getQAPairs();
    const list = filterAndSortPairs(pairs);
    const container = document.getElementById('qaCards');
    const count = document.getElementById('qaCount');
    if (!container) return;
    if (count) count.textContent = `${list.length} of ${pairs.length} questions`;

    container.innerHTML = list.length
        ? list.map(p => buildCard(p)).join('')
        : '<div class="warn-card">⚠ No questions match the current filter.</div>';

    // Accordion logic
    container.querySelectorAll('.accordion-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.accordion-item');
            const isOpen = item.classList.contains('open');
            // close all
            container.querySelectorAll('.accordion-item.open').forEach(i => i.classList.remove('open'));
            if (!isOpen) item.classList.add('open');
        });
    });
}

function buildCard(pair) {
    const cp = pair.cpEntry || {};
    const score = cp.relevance_score ?? 0;
    const kwArr = cp.matched_keywords || [];
    const ansLen = pair.answer ? `${fmtTime(pair.answer.end_time - pair.answer.start_time)}` : '—';
    const cls = scoreClass(score);
    const vc = verdictCls(cp.incremental_verdict || '');

    return `
  <div class="accordion-item score-${cls}">
    <button class="accordion-trigger">
      <span class="acc-qid">${pair.question_id}</span>
      <span class="acc-question">${pair.question_text}</span>
      <div class="acc-meta">
        <span class="score-badge ${cls}">${score.toFixed(2)}</span>
        <span class="verdict-chip ${vc}" style="font-size:10px">${(cp.incremental_verdict || '').replace(/_/g, ' ')}</span>
        <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">${kwArr.length} kw</span>
        <span class="acc-arrow">▼</span>
      </div>
    </button>
    <div class="accordion-body">
      <div class="accordion-content">
        <!-- Q block -->
        <div class="qa-block">
          <div class="qa-block-label">Interviewer Question <span class="qa-timestamp">[${fmtTime(pair.question_start_time)} → ${fmtTime(pair.question_end_time)}]</span></div>
          <div class="qa-block-text">${pair.question_text}</div>
        </div>
        <!-- A block -->
        <div class="qa-block">
          <div class="qa-block-label">Candidate Answer <span class="qa-timestamp">[${fmtTime(pair.answer?.start_time)} → ${fmtTime(pair.answer?.end_time)}]</span></div>
          <div class="qa-block-text">${pair.answer?.text || '<em style="color:var(--text-muted)">No answer recorded</em>'}</div>
        </div>
        <!-- Keywords -->
        ${kwArr.length > 0 ? `
        <div class="kw-chips-row">${kwArr.map(k => `<span class="kw-chip">${k}</span>`).join('')}</div>
        ` : ''}
        <!-- Competency bars -->
        ${cp.competency_scores ? `
        <div class="competency-bars">
          ${COMPETENCY_KEYS.map(ck => {
        const v = cp.competency_scores?.[ck.key] ?? 0;
        return `<div class="prog-bar-wrap">
              <span class="prog-bar-label">${ck.label}</span>
              <div class="prog-bar-track"><div class="prog-bar-fill" style="width:${(v * 100).toFixed(0)}%;background:${ck.color}"></div></div>
              <span class="prog-bar-val">${(v * 100).toFixed(0)}%</span>
            </div>`;
    }).join('')}
        </div>` : ''}
        <!-- LLM Reasoning -->
        ${cp.reason ? `<div class="reasoning-block">"${cp.reason}"</div>` : ''}
      </div>
    </div>
  </div>`;
}

function setupFilters() {
    // Verdict filter buttons
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            activeFilter = btn.dataset.filter;
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCards();
        });
    });

    // Sort buttons
    document.querySelectorAll('[data-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
            sortMode = btn.dataset.sort;
            document.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCards();
        });
    });

    // Search
    const search = document.getElementById('qaSearch');
    if (search) {
        let timer = null;
        search.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                searchQuery = search.value.trim();
                renderCards();
            }, 250);
        });
    }
}
