// ═══════════════════════════════════════════════════════════════
// TIPS Dashboard — pages/analytics.js
// Page 2: Analytics View
// ═══════════════════════════════════════════════════════════════
import { sessionData, scoreColor, avgCompetency } from '../dataLoader.js';
import { COMPETENCY_KEYS } from '../config.js';

const charts = {};

export function renderAnalytics(el) {
    console.log('[TIPS] renderAnalytics called. checkpoints:', sessionData.checkpoints?.length,
        'behavior_metrics:', !!sessionData.behavior_metrics,
        'loaded:', sessionData.loaded);

    if (!sessionData.loaded) {
        el.innerHTML = noData();
        return;
    }
    el.innerHTML = buildAnalytics();
    setTimeout(() => {
        try {
            drawScoreTimeline();
            drawCompetencyBars();
            drawKeywordHeatmap();
            drawBehavioralDists();
            drawTrajectory();
            setupTabs();
            console.log('[TIPS] renderAnalytics complete');
        } catch (err) {
            console.error('[TIPS] renderAnalytics chart ERROR:', err);
        }
    }, 50);
}

function noData() {
    const errs = Object.keys(sessionData.errors || {});
    const errHtml = errs.length
        ? `<div style="margin-top:12px;font-size:11px;color:var(--score-low)">Failed files: ${errs.join(', ')}</div>`
        : '';
    return `<div class="empty-state"><div class="es-icon">📊</div><div class="es-title">No data loaded yet</div><div class="es-sub">Click <strong>Load Session</strong> → <em>Folder Picker</em> and select your <code>output/</code> folder.${errHtml}</div></div>`;
}

function buildAnalytics() {
    return `
  <div class="section-header">
    <div class="section-title">Analytics View</div>
    <div class="section-sub">Quantitative scoring analysis</div>
  </div>

  <!-- Score Timeline -->
  <div class="chart-card reveal" style="margin-bottom:24px">
    <div class="chart-card-title">Score Timeline — Per Question</div>
    <div class="chart-wrap chart-wrap-lg">
      <canvas id="scoreTimelineCanvas"></canvas>
    </div>
    <div id="verdictChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px"></div>
  </div>

  <!-- Tabs for deeper charts -->
  <div class="tab-bar reveal">
    <button class="tab-btn active" data-tab="competency">Competency Breakdown</button>
    <button class="tab-btn" data-tab="keywords">Keyword Coverage</button>
    <button class="tab-btn" data-tab="behavioral">Behavioral Distributions</button>
    <button class="tab-btn" data-tab="trajectory">Performance Trajectory</button>
  </div>

  <div class="tab-pane active reveal" id="tab-competency">
    <div class="grid-3" id="competencyGrid"></div>
  </div>

  <div class="tab-pane reveal" id="tab-keywords">
    <div class="card heatmap-wrap">
      <div class="card-title">Keyword Match Heatmap (Questions × Keywords)</div>
      <div id="heatmapContainer"></div>
    </div>
  </div>

  <div class="tab-pane reveal" id="tab-behavioral">
    <div class="grid-2" id="behavioralDistGrid"></div>
  </div>

  <div class="tab-pane reveal" id="tab-trajectory">
    <div class="chart-card">
      <div class="chart-card-title">Cumulative Score Trajectory</div>
      <div class="chart-wrap chart-wrap-lg">
        <canvas id="trajectoryCanvas"></canvas>
      </div>
    </div>
  </div>`;
}

function drawScoreTimeline() {
    const cp = sessionData.checkpoints || [];
    if (!cp.length) return;
    const labels = cp.map(c => c.checkpoint);
    const relScore = cp.map(c => +(c.relevance_score || 0).toFixed(2));
    const datasets = [
        { label: 'Relevance', data: relScore, borderColor: '#e6edf3', borderWidth: 2.5, pointRadius: 4, tension: 0.35 },
        ...COMPETENCY_KEYS.map(ck => ({
            label: ck.label,
            data: cp.map(c => +((c.competency_scores?.[ck.key] || 0)).toFixed(2)),
            borderColor: ck.color,
            borderWidth: 1.5,
            pointRadius: 3,
            tension: 0.35,
            borderDash: undefined,
        }))
    ];

    if (charts.scoreTimeline) charts.scoreTimeline.destroy();
    charts.scoreTimeline = new Chart(document.getElementById('scoreTimelineCanvas'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            animation: { duration: 700 },
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { labels: { boxWidth: 10 } } },
            scales: {
                x: { grid: { color: 'rgba(48,54,61,0.6)' } },
                y: { min: 0, max: 1, grid: { color: 'rgba(48,54,61,0.6)' }, ticks: { callback: v => (v * 100).toFixed(0) + '%' } }
            }
        }
    });

    // Verdict chips
    const container = document.getElementById('verdictChips');
    if (!container) return;
    cp.forEach(c => {
        const chip = document.createElement('span');
        chip.className = `verdict-chip ${verdictCls(c.incremental_verdict)}`;
        chip.textContent = `${c.checkpoint}: ${(c.incremental_verdict || '').replace(/_/g, ' ')}`;
        container.appendChild(chip);
    });
}

function verdictCls(v = '') {
    const l = v.toLowerCase();
    if (l.includes('strong')) return 'strong';
    if (l.includes('weak') || l.includes('needs')) return 'weak';
    return 'poor';
}

function drawCompetencyBars() {
    const cp = sessionData.checkpoints || [];
    const grid = document.getElementById('competencyGrid');
    if (!grid || !cp.length) return;

    COMPETENCY_KEYS.forEach(ck => {
        const vals = cp.map(c => +((c.competency_scores?.[ck.key] || 0)).toFixed(2));
        const avg = avgCompetency(cp, ck.key);
        const card = document.createElement('div');
        card.className = 'chart-card';
        card.innerHTML = `<div class="chart-card-title">${ck.label}</div><div class="chart-wrap chart-wrap-sm"><canvas id="bar_${ck.key}"></canvas></div>`;
        grid.appendChild(card);
        new Chart(card.querySelector('canvas'), {
            type: 'bar',
            data: {
                labels: cp.map(c => c.checkpoint),
                datasets: [{
                    data: vals,
                    backgroundColor: vals.map(v => scoreColor(v) + '99'),
                    borderColor: vals.map(v => scoreColor(v)),
                    borderWidth: 1,
                }]
            },
            options: {
                responsive: true,
                animation: { duration: 600 },
                plugins: {
                    legend: { display: false },
                    annotation: {},
                },
                scales: {
                    x: { grid: { color: 'rgba(48,54,61,0.4)' }, ticks: { font: { size: 9 } } },
                    y: { min: 0, max: 1, grid: { color: 'rgba(48,54,61,0.4)' }, ticks: { callback: v => v.toFixed(1) } }
                }
            }
        });
    });
}

function drawKeywordHeatmap() {
    const cp = sessionData.checkpoints || [];
    const box = document.getElementById('heatmapContainer');
    if (!box || !cp.length) return;

    // Collect unique keywords (top 15)
    const kwFreq = {};
    cp.forEach(c => (c.matched_keywords || []).forEach(k => { kwFreq[k] = (kwFreq[k] || 0) + 1; }));
    const topKw = Object.entries(kwFreq).sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => e[0]);

    const table = document.createElement('table');
    table.className = 'heatmap-table';

    // Header
    const thead = document.createElement('thead');
    const hrow = document.createElement('tr');
    hrow.innerHTML = `<th style="text-align:left;padding:4px 8px">Q</th>` +
        topKw.map(k => `<th title="${k}">${k.length > 10 ? k.slice(0, 9) + '…' : k}</th>`).join('');
    thead.appendChild(hrow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    cp.forEach(c => {
        const row = document.createElement('tr');
        row.innerHTML = `<td class="row-lbl">${c.checkpoint}</td>` +
            topKw.map(k => {
                const matched = (c.matched_keywords || []).includes(k);
                return `<td><div class="hm-cell ${matched ? 'hit' : ''}" title="${matched ? '✓ matched' : ''}"></div></td>`;
            }).join('');
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    box.appendChild(table);
}

function drawBehavioralDists() {
    const bm = sessionData.behavior_metrics?.segments || [];
    const grid = document.getElementById('behavioralDistGrid');
    if (!grid || !bm.length) return;

    const dists = [
        { key: 'speech_rate', src: 'audio_metrics', label: 'Speech Rate (w/s)', color: '#388bfd' },
        { key: 'pause_density', src: 'audio_metrics', label: 'Pause Density', color: '#d29922' },
        { key: 'gaze_stability', src: 'video_metrics', label: 'Gaze Stability', color: '#bc8cff' },
        { key: 'head_motion_mean', src: 'video_metrics', label: 'Head Motion', color: '#3fb950' },
    ];

    dists.forEach(({ key, src, label, color }) => {
        const vals = bm.map(s => +(s[src]?.[key] || 0).toFixed(3)).filter(v => v > 0);
        if (!vals.length) return;
        const numBins = 12;
        const min = Math.min(...vals), max = Math.max(...vals);
        const step = (max - min) / numBins || 0.1;
        const bins = Array.from({ length: numBins }, (_, i) => {
            const lo = min + i * step, hi = lo + step;
            return { label: lo.toFixed(2), count: vals.filter(v => v >= lo && v < hi).length };
        });
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;

        const card = document.createElement('div');
        card.className = 'chart-card';
        card.innerHTML = `<div class="chart-card-title">${label} (n=${vals.length})</div><div class="chart-wrap chart-wrap-sm"><canvas id="dist_${key}"></canvas></div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Mean: <b style="color:var(--text-secondary)">${mean.toFixed(3)}</b></div>`;
        grid.appendChild(card);
        new Chart(card.querySelector('canvas'), {
            type: 'bar',
            data: {
                labels: bins.map(b => b.label),
                datasets: [{ data: bins.map(b => b.count), backgroundColor: color + '88', borderColor: color, borderWidth: 1 }]
            },
            options: {
                responsive: true,
                animation: { duration: 500 },
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(48,54,61,0.4)' }, ticks: { font: { size: 9 }, maxRotation: 45 } },
                    y: { grid: { color: 'rgba(48,54,61,0.4)' }, ticks: { font: { size: 9 } } }
                }
            }
        });
    });
}

function drawTrajectory() {
    const cp = sessionData.checkpoints || [];
    if (!cp.length) return;
    const labels = cp.map(c => c.checkpoint);

    // Rolling average relevance score
    const rolling = cp.map((c, i) => {
        const slice = cp.slice(0, i + 1);
        return +(slice.reduce((a, s) => a + (s.relevance_score || 0), 0) / slice.length).toFixed(3);
    });

    // Per-question
    const perQ = cp.map(c => +(c.relevance_score || 0).toFixed(2));

    if (charts.trajectory) charts.trajectory.destroy();
    const ctx = document.getElementById('trajectoryCanvas');
    if (!ctx) return;
    charts.trajectory = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Cumulative Avg', data: rolling, borderColor: '#3fb950', borderWidth: 2.5, pointRadius: 4, tension: 0.35, fill: true, backgroundColor: 'rgba(63,185,80,0.06)' },
                { label: 'Per-Q Score', data: perQ, borderColor: '#388bfd', borderWidth: 1, pointRadius: 3, tension: 0.3, borderDash: [5, 3] },
            ]
        },
        options: {
            responsive: true,
            animation: { duration: 700 },
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { labels: { boxWidth: 10 } } },
            scales: {
                x: { grid: { color: 'rgba(48,54,61,0.5)' } },
                y: { min: 0, max: 1, grid: { color: 'rgba(48,54,61,0.5)' }, ticks: { callback: v => (v * 100).toFixed(0) + '%' } }
            }
        }
    });
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
        });
    });
}
