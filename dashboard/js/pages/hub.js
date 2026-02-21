// ═══════════════════════════════════════════════════════════════
// TIPS Dashboard — pages/hub.js
// Session Hub — verdict, stats, radar, quick nav
// ═══════════════════════════════════════════════════════════════
import { sessionData, fmtTime, scoreColor, avgCompetency, totalSpeakingTime } from '../dataLoader.js';
import { COMPETENCY_KEYS } from '../config.js';

let radarChart = null;
let gaugeChart = null;

export function renderHub(el) {
    if (!sessionData.loaded) {
        el.innerHTML = buildEmptyState();
        return;
    }
    el.innerHTML = buildHub();
    setupGauge();
    setupRadar();
    setupReveal();
    setupQuickNav();
}

function buildEmptyState() {
    return `
  <div class="empty-state">
    <div class="es-icon">◈</div>
    <div class="es-title">No session loaded</div>
    <div class="es-sub">Click <strong>Load Session</strong> in the top-right to load pipeline output files.</div>
  </div>`;
}

function buildHub() {
    const v = sessionData.final_verdict;
    const tl = sessionData.timeline;
    const qa = sessionData.qa_pairs;
    const cp = sessionData.checkpoints || [];
    const sp = sessionData.speaking_segments || [];

    const verdict = v?.verdict || 'UNKNOWN';
    const conf = v?.confidence || '--';
    const score = v?.overall_score ?? 0;
    const reason = v?.reason || '';

    const cssClass = verdict.toLowerCase().replace(/_/g, '-')
        .replace('strong-hire', 'strong-hire')
        .replace('weak-hire', 'weak-hire')
        .replace('no-hire', 'no-hire');

    const dur = tl?.video?.duration_sec || 0;
    const qCount = qa?.total_pairs || cp.length;
    const spkTime = totalSpeakingTime(sp);
    const avgRel = cp.length
        ? (cp.reduce((a, c) => a + (c.relevance_score || 0), 0) / cp.length).toFixed(2)
        : '—';

    return `
  <!-- Verdict Banner -->
  <div class="verdict-banner ${cssClass} reveal">
    <div class="verdict-gauge-wrap">
      <canvas id="gaugeCanvas" width="100" height="100"></canvas>
      <div class="verdict-gauge-label">
        <span class="verdict-gauge-score">${(score * 100).toFixed(0)}%</span>
        <span class="verdict-gauge-sub">Score</span>
      </div>
    </div>
    <div class="verdict-info">
      <div class="verdict-label">${verdict.replace(/_/g, ' ')}</div>
      <div class="verdict-confidence">Confidence: ${conf}</div>
      <div class="verdict-reason">${reason}</div>
    </div>
  </div>

  <!-- Stats Row -->
  <div class="grid-4 reveal" style="margin-bottom:28px">
    <div class="stat-card">
      <div class="stat-label">Total Duration</div>
      <div class="stat-value">${fmtTime(dur)}</div>
      <div class="stat-sub">${dur.toFixed(0)}s interview length</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Questions</div>
      <div class="stat-value">${qCount}</div>
      <div class="stat-sub">Q&amp;A pairs evaluated</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Speaking Time</div>
      <div class="stat-value">${fmtTime(spkTime)}</div>
      <div class="stat-sub">${dur > 0 ? ((spkTime / dur) * 100).toFixed(0) : 0}% of total</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg Relevance</div>
      <div class="stat-value">${avgRel}</div>
      <div class="stat-sub">across all questions</div>
    </div>
  </div>

  <!-- Radar + Session Info -->
  <div class="grid-2 reveal" style="margin-bottom:28px">
    <div class="card">
      <div class="card-title">Competency Overview</div>
      <div class="chart-wrap" style="min-height:260px">
        <canvas id="radarCanvas"></canvas>
      </div>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:16px">
      <div class="card-title">Session Metadata</div>
      ${tl ? `
      <div><span class="stat-label" style="display:inline;margin-right:8px">Dataset ID</span>
        <code style="color:var(--accent-teal);font-size:13px">${tl.dataset_id}</code></div>
      <div><span class="stat-label" style="display:inline;margin-right:8px">Timebase</span>
        <span style="font-size:13px;color:var(--text-secondary)">${tl.timebase}</span></div>
      <div><span class="stat-label" style="display:inline;margin-right:8px">Video FPS</span>
        <span style="font-size:13px;font-family:var(--font-mono);color:var(--text-primary)">${tl.video?.fps}</span></div>
      <div><span class="stat-label" style="display:inline;margin-right:8px">Frame Count</span>
        <span style="font-size:13px;font-family:var(--font-mono);color:var(--text-primary)">${tl.video?.frame_count?.toLocaleString()}</span></div>
      <div><span class="stat-label" style="display:inline;margin-right:8px">Sample Rate</span>
        <span style="font-size:13px;font-family:var(--font-mono);color:var(--text-primary)">${tl.audio?.candidate?.sample_rate?.toLocaleString()} Hz</span></div>
      ` : `<div class="warn-card">⚠ timeline.json not loaded</div>`}

      ${sessionData.errors && Object.keys(sessionData.errors).length > 0 ? `
      <div class="warn-card">⚠ ${Object.keys(sessionData.errors).length} file(s) failed to load</div>
      ` : ''}
    </div>
  </div>

  <!-- Quick Nav -->
  <div class="section-header reveal">
    <div class="section-title">Explore Analysis</div>
  </div>
  <div class="quick-nav-grid reveal">
    <div class="quick-nav-card" data-nav="temporal">
      <div class="qnc-icon">⏱</div>
      <div class="qnc-title">Temporal Evidence</div>
      <div class="qnc-desc">Unified timeline of audio, video, and transcript signals</div>
    </div>
    <div class="quick-nav-card" data-nav="analytics">
      <div class="qnc-icon">📊</div>
      <div class="qnc-title">Analytics</div>
      <div class="qnc-desc">Score charts, keyword heatmap, behavioral distributions</div>
    </div>
    <div class="quick-nav-card" data-nav="pipeline">
      <div class="qnc-icon">⚙️</div>
      <div class="qnc-title">Pipeline Execution</div>
      <div class="qnc-desc">Stage-by-stage pipeline status and output inventory</div>
    </div>
    <div class="quick-nav-card" data-nav="qa">
      <div class="qnc-icon">💬</div>
      <div class="qnc-title">Q&amp;A Review</div>
      <div class="qnc-desc">Full transcript with scores and LLM reasoning per question</div>
    </div>
  </div>`;
}

function setupGauge() {
    const canvas = document.getElementById('gaugeCanvas');
    if (!canvas) return;
    if (gaugeChart) { gaugeChart.destroy(); gaugeChart = null; }
    const score = sessionData.final_verdict?.overall_score ?? 0;
    const color = score >= 0.7 ? '#3fb950' : score >= 0.4 ? '#d29922' : '#f85149';
    gaugeChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [score, 1 - score],
                backgroundColor: [color, 'rgba(48,54,61,0.6)'],
                borderWidth: 0,
                circumference: 240,
                rotation: 240,
            }]
        },
        options: {
            responsive: false,
            cutout: '75%',
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: { duration: 800 }
        }
    });
}

function setupRadar() {
    const canvas = document.getElementById('radarCanvas');
    if (!canvas) return;
    if (radarChart) { radarChart.destroy(); radarChart = null; }
    const cp = sessionData.checkpoints || [];
    const labels = COMPETENCY_KEYS.map(c => c.label);
    const values = COMPETENCY_KEYS.map(c => +(avgCompetency(cp, c.key) * 100).toFixed(1));
    radarChart = new Chart(canvas, {
        type: 'radar',
        data: {
            labels,
            datasets: [{
                label: 'Competency',
                data: values,
                backgroundColor: 'rgba(56,139,253,0.15)',
                borderColor: '#388bfd',
                borderWidth: 2,
                pointBackgroundColor: '#388bfd',
                pointRadius: 4,
            }]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    min: 0, max: 100,
                    ticks: { stepSize: 25, color: '#484f58', backdropColor: 'transparent' },
                    grid: { color: 'rgba(48,54,61,0.8)' },
                    pointLabels: { color: '#8b949e', font: { size: 11 } },
                }
            },
            plugins: { legend: { display: false } },
            animation: { duration: 700 }
        }
    });
}

function setupQuickNav() {
    document.querySelectorAll('.quick-nav-card').forEach(card => {
        card.addEventListener('click', () => {
            const page = card.dataset.nav;
            import('../router.js').then(m => m.navigateTo(page));
        });
    });
}

function setupReveal() {
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}
