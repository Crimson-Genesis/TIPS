// ═══════════════════════════════════════════════════════════════
// TIPS Unified Frontend — pages/analytics.js
// Page 3: KPI cards, score charts, distribution, trajectory
// ═══════════════════════════════════════════════════════════════
import { sessionData, scoreClass, scoreColor, avgCompetency, exportSessionJSON } from '../dataLoader.js';
import { COMPETENCY_KEYS } from '../config.js';

let charts = {};

export function renderAnalytics(el) {
    if (!sessionData.loaded) {
        el.innerHTML = `<div class="empty-state"><div class="es-icon">📊</div>
            <div class="es-title">No session loaded</div>
            <div class="es-sub">Load a session to view analytics.</div></div>`;
        return;
    }
    el.innerHTML = buildAnalytics();
    drawScoreTimeline();
    drawCompetencyBars();
    drawKeywordHeatmap();
    drawBehavioralDists();
    drawTrajectory();
    wireExport();
    setupTabs();
}

function buildAnalytics() {
    const cps = sessionData.checkpoints || [];
    const rel = sessionData.relevance_scores || [];
    const bm = sessionData.behavior_metrics || {};
    const fv = sessionData.final_verdict || {};

    const avgScore = cps.length ? cps.reduce((a, c) => a + (c.relevance_score ?? 0), 0) / cps.length : 0;
    const topScore = cps.length ? Math.max(...cps.map(c => c.relevance_score ?? 0)) : 0;
    const topKwAll = cps.flatMap(c => c.matched_keywords || []);
    const kwCount = {};
    topKwAll.forEach(k => kwCount[k] = (kwCount[k] || 0) + 1);
    const topKw = Object.entries(kwCount).sort((a, b) => b[1] - a[1]).slice(0, 1)[0]?.[0] || '—';

    return `
    <div class="section-header" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
            <div class="section-title">Analytics</div>
            <div class="section-sub">Behavioral signals, competency breakdown, and performance trajectory</div>
        </div>
        <button class="btn-export" id="analyticsExportBtn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export JSON
        </button>
    </div>

    <!-- KPI cards -->
    <div class="grid-4" style="margin-bottom:24px">
        ${kpiCard('Avg Relevance', (avgScore * 100).toFixed(0) + '%', scoreClass(avgScore))}
        ${kpiCard('Peak Score', (topScore * 100).toFixed(0) + '%', scoreClass(topScore))}
        ${kpiCard('Questions Scored', cps.length, 'default')}
        ${kpiCard('Top Keyword', topKw, 'default')}
    </div>

    <!-- Analytics tabs -->
    <div style="display:flex;gap:4px;margin-bottom:16px;background:var(--bg-surface);
        padding:4px;border-radius:8px;width:fit-content">
        ${['Score Timeline', 'Competency', 'Keywords', 'Behavior', 'Trajectory'].map((t, i) =>
        `<button class="analytics-tab ${i === 0 ? 'active' : ''}" data-tab="${t.toLowerCase().replace(' ', '-')}"
                style="padding:6px 16px;background:${i === 0 ? 'var(--bg-elevated)' : 'none'};border:none;
                    border-radius:6px;color:${i === 0 ? 'var(--text-primary)' : 'var(--text-muted)'};
                    font-size:13px;font-weight:500;font-family:inherit;cursor:pointer;
                    transition:all .15s ease;white-space:nowrap">${t}</button>`
    ).join('')}
    </div>

    <!-- Tab panels -->
    <div class="stat-card" style="padding:20px">
        <div id="tab-score-timeline" class="analytics-panel">
            <div class="stat-card-title" style="margin-bottom:16px">Question-wise Relevance Score</div>
            <div style="height:240px;position:relative"><canvas id="scoreTimelineChart"></canvas></div>
        </div>
        <div id="tab-competency" class="analytics-panel" style="display:none">
            <div class="stat-card-title" style="margin-bottom:16px">Competency Breakdown</div>
            <div style="height:240px;position:relative"><canvas id="competencyBarsChart"></canvas></div>
        </div>
        <div id="tab-keywords" class="analytics-panel" style="display:none">
            <div class="stat-card-title" style="margin-bottom:16px">Keyword Match Heatmap</div>
            <div id="keywordHeatmap" style="display:flex;flex-wrap:wrap;gap:8px;min-height:160px;align-content:flex-start"></div>
        </div>
        <div id="tab-behavior" class="analytics-panel" style="display:none">
            <div class="stat-card-title" style="margin-bottom:16px">Behavioral Distributions</div>
            <div class="grid-2">
                <div style="height:200px;position:relative"><canvas id="behaviorDistChart"></canvas></div>
                <div style="height:200px;position:relative"><canvas id="audio_dist_chart"></canvas></div>
            </div>
        </div>
        <div id="tab-trajectory" class="analytics-panel" style="display:none">
            <div class="stat-card-title" style="margin-bottom:16px">Performance Trajectory</div>
            <div style="height:240px;position:relative"><canvas id="trajectoryChart"></canvas></div>
        </div>
    </div>

    <!-- Q-by-Q breakdown table -->
    <div class="stat-card" style="margin-top:20px;overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border-subtle)">
            <div class="stat-card-title">Question-wise Breakdown</div>
        </div>
        <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:12px">
                <thead>
                    <tr style="border-bottom:1px solid var(--border)">
                        <th style="padding:10px 16px;text-align:left;color:var(--text-muted);font-weight:600;width:60px">#</th>
                        <th style="padding:10px 16px;text-align:left;color:var(--text-muted);font-weight:600">Question</th>
                        <th style="padding:10px 16px;text-align:center;color:var(--text-muted);font-weight:600;width:90px">Score</th>
                        <th style="padding:10px 16px;text-align:center;color:var(--text-muted);font-weight:600;width:110px">Verdict</th>
                        <th style="padding:10px 16px;text-align:left;color:var(--text-muted);font-weight:600">Keywords</th>
                    </tr>
                </thead>
                <tbody>
                    ${buildQBreakdown()}
                </tbody>
            </table>
        </div>
    </div>`;
}

function kpiCard(label, value, cls) {
    const colors = { high: 'var(--accent-green)', mid: 'var(--accent-orange)', low: 'var(--accent-red)', default: 'var(--accent-blue)' };
    const c = colors[cls] || colors.default;
    return `<div class="stat-card" style="text-align:center;padding:20px">
        <div style="font-size:28px;font-weight:800;color:${c};letter-spacing:-0.02em">${value}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${label}</div>
    </div>`;
}

function buildQBreakdown() {
    const cps = sessionData.checkpoints || [];
    const qa = sessionData.qa_pairs?.qa_pairs || [];
    return cps.map((cp, i) => {
        const pair = qa.find(p => p.question_id === cp.checkpoint) || {};
        const score = cp.relevance_score ?? 0;
        const scls = scoreClass(score);
        const verdict = (cp.incremental_verdict || '—').replace(/_/g, ' ');
        const kws = (cp.matched_keywords || []).slice(0, 4).map(k =>
            `<span style="font-size:10px;padding:2px 6px;background:rgba(56,139,253,0.1);
                color:var(--accent-blue);border-radius:4px">${k}</span>`
        ).join('');
        const vcls = verdict.toLowerCase().includes('strong') ? 'var(--accent-green)' :
            verdict.toLowerCase().includes('weak') ? 'var(--accent-orange)' : 'var(--accent-red)';
        return `<tr style="border-bottom:1px solid var(--border-subtle);transition:background .15s"
            onmouseover="this.style.background='var(--bg-surface)'"
            onmouseout="this.style.background='none'">
            <td style="padding:10px 16px;color:var(--text-muted);font-family:var(--font-mono)">${cp.checkpoint || `Q${i + 1}`}</td>
            <td style="padding:10px 16px;color:var(--text-secondary);max-width:320px;overflow:hidden;
                text-overflow:ellipsis;white-space:nowrap" title="${pair.question_text || ''}">${pair.question_text || '—'}</td>
            <td style="padding:10px 16px;text-align:center">
                <span class="score-badge ${scls}">${(score * 100).toFixed(0)}%</span>
            </td>
            <td style="padding:10px 16px;text-align:center;font-size:11px;color:${vcls};font-weight:600">${verdict}</td>
            <td style="padding:10px 16px;display:flex;gap:4px;flex-wrap:wrap">${kws || '<span style="color:var(--text-muted)">—</span>'}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text-muted)">No data</td></tr>`;
}

function setupTabs() {
    document.querySelectorAll('.analytics-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.analytics-tab').forEach(t => {
                t.style.background = 'none'; t.style.color = 'var(--text-muted)';
                t.classList.remove('active');
            });
            document.querySelectorAll('.analytics-panel').forEach(p => p.style.display = 'none');
            tab.style.background = 'var(--bg-elevated)'; tab.style.color = 'var(--text-primary)';
            tab.classList.add('active');
            const panel = document.getElementById(`tab-${tab.dataset.tab}`);
            if (panel) panel.style.display = 'block';
        });
    });
}

function drawScoreTimeline() {
    const ctx = document.getElementById('scoreTimelineChart');
    if (!ctx) return;
    const cps = sessionData.checkpoints || [];
    if (charts.st) charts.st.destroy();
    charts.st = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: cps.map((c, i) => c.checkpoint || `Q${i + 1}`),
            datasets: [{
                label: 'Relevance Score %',
                data: cps.map(c => (c.relevance_score ?? 0) * 100),
                backgroundColor: cps.map(c => {
                    const v = c.relevance_score ?? 0;
                    return v >= 0.7 ? 'rgba(63,185,80,0.7)' : v >= 0.4 ? 'rgba(210,153,34,0.7)' : 'rgba(248,81,73,0.7)';
                }),
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { 
                y: { 
                    min: 0, 
                    max: 100, 
                    ticks: { 
                        callback: v => `${v}%`,
                        color: '#ffffff',
                        font: { size: 10 }
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    ticks: { color: '#ffffff', font: { size: 9 } },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function drawCompetencyBars() {
    const ctx = document.getElementById('competencyBarsChart');
    if (!ctx) return;
    if (charts.comp) charts.comp.destroy();
    charts.comp = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: COMPETENCY_KEYS.map(c => c.label),
            datasets: [{
                label: 'Score %',
                data: COMPETENCY_KEYS.map(c => avgCompetency(sessionData.checkpoints || [], c.key) * 100),
                backgroundColor: COMPETENCY_KEYS.map(c => c.color + 'bb'),
                borderColor: COMPETENCY_KEYS.map(c => c.color),
                borderWidth: 1,
                borderRadius: 4,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            scales: { 
                x: { 
                    min: 0, 
                    max: 100, 
                    ticks: { 
                        callback: v => `${v}%`,
                        color: '#ffffff',
                        font: { size: 10 }
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                y: {
                    ticks: { color: '#ffffff', font: { size: 9 } },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function drawKeywordHeatmap() {
    const el = document.getElementById('keywordHeatmap');
    if (!el) return;
    const cps = sessionData.checkpoints || [];
    const allKws = cps.flatMap(c => c.matched_keywords || []);
    const kwMap = {};
    allKws.forEach(k => kwMap[k] = (kwMap[k] || 0) + 1);
    const sorted = Object.entries(kwMap).sort((a, b) => b[1] - a[1]);
    const max = sorted[0]?.[1] || 1;
    el.innerHTML = sorted.map(([kw, count]) => {
        const pct = count / max;
        const alpha = 0.2 + pct * 0.6;
        return `<span style="padding:6px 12px;border-radius:6px;font-size:12px;cursor:default;
            background:rgba(56,139,253,${alpha.toFixed(2)});color:var(--text-primary);
            border:1px solid rgba(56,139,253,${(alpha + 0.2).toFixed(2)})"
            title="${count} match${count > 1 ? 'es' : ''}">${kw} <sup style="font-size:9px;opacity:0.7">${count}</sup></span>`;
    }).join('') || `<span style="color:var(--text-muted);font-size:12px">No keyword data.</span>`;
}

function drawBehavioralDists() {
    const bm = sessionData.behavior_metrics || {};
    const segs = bm.segments || [];

    // Behavioral metrics derived from real data
    const confCtx = document.getElementById('behaviorDistChart');
    if (confCtx && segs.length) {
        // Sample segments to avoid overcrowding
        const step = Math.max(1, Math.floor(segs.length / 30));
        const samples = segs.filter((_, i) => i % step === 0).slice(0, 30);
        
        // Vocal energy (represents confidence)
        const energy = samples.map(s => {
            const e = s.audio_metrics?.energy_mean ?? 0;
            return Math.min(100, e * 1000);
        });
        
        // Speech rate (represents fluency)
        const speechRate = samples.map(s => {
            const rate = s.audio_metrics?.speech_rate ?? 0;
            return Math.min(100, rate * 5);
        });
        
        // Pitch variance (represents expressiveness)
        const pitchVar = samples.map(s => {
            const pv = s.audio_metrics?.pitch_variance ?? 0;
            return Math.min(100, Math.sqrt(pv) / 100);
        });
        
        if (charts.behDist) charts.behDist.destroy();
        charts.behDist = new Chart(confCtx, {
            type: 'line',
            data: {
                labels: samples.map((_, i) => `${i + 1}`),
                datasets: [
                    { 
                        label: 'Vocal Energy', 
                        data: energy, 
                        borderColor: '#388bfd', 
                        backgroundColor: 'rgba(56,139,253,0.1)',
                        fill: true, 
                        tension: 0.4 
                    },
                    { 
                        label: 'Speech Rate', 
                        data: speechRate, 
                        borderColor: '#39c5cf',
                        backgroundColor: 'rgba(57,197,207,0.1)',
                        fill: true, 
                        tension: 0.4 
                    },
                    { 
                        label: 'Expressiveness', 
                        data: pitchVar, 
                        borderColor: '#bb8cff',
                        backgroundColor: 'rgba(187,140,255,0.1)',
                        fill: true, 
                        tension: 0.4 
                    },
                ]
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                scales: { 
                    y: { 
                        min: 0, 
                        max: 100,
                        ticks: { color: '#ffffff', font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    x: {
                        ticks: { color: '#ffffff', font: { size: 9 } },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                },
                plugins: { 
                    legend: { 
                        position: 'top',
                        labels: { color: '#ffffff', font: { size: 11 } }
                    }
                }
            }
        });
    }

    // Audio/Video metrics distribution
    const audCtx = document.getElementById('audio_dist_chart');
    if (audCtx && segs.length) {
        // Calculate average metrics
        const avgEnergy = segs.reduce((a, s) => a + (s.audio_metrics?.energy_mean ?? 0), 0) / segs.length;
        const avgPitch = segs.reduce((a, s) => a + (s.audio_metrics?.pitch_mean ?? 0), 0) / segs.length;
        const avgGaze = segs.reduce((a, s) => a + (s.video_metrics?.gaze_stability ?? 0), 0) / segs.length;
        const avgFacePresence = segs.reduce((a, s) => a + (s.video_metrics?.face_presence_ratio ?? 0), 0) / segs.length;
        
        if (charts.audDist) charts.audDist.destroy();
        charts.audDist = new Chart(audCtx, {
            type: 'doughnut',
            data: {
                labels: ['Vocal Energy', 'Pitch Variation', 'Gaze Stability', 'Face Presence'],
                datasets: [{
                    data: [
                        Math.min(100, avgEnergy * 1000),
                        Math.min(100, avgPitch / 20),
                        Math.min(100, avgGaze * 10000),
                        avgFacePresence * 100
                    ],
                    backgroundColor: [
                        'rgba(56,139,253,0.7)', 
                        'rgba(57,197,207,0.7)',
                        'rgba(187,140,255,0.7)',
                        'rgba(63,185,80,0.7)'
                    ],
                    borderWidth: 0,
                }]
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        position: 'bottom',
                        labels: { color: '#ffffff', font: { size: 11 } }
                    }
                }
            }
        });
    }
}

function drawTrajectory() {
    const ctx = document.getElementById('trajectoryChart');
    if (!ctx) return;
    const cps = sessionData.checkpoints || [];
    if (!cps.length) return;

    const labels = cps.map((c, i) => c.checkpoint || `Q${i + 1}`);
    const cumAvg = [];
    let sum = 0;
    cps.forEach((c, i) => {
        sum += c.relevance_score ?? 0;
        cumAvg.push((sum / (i + 1)) * 100);
    });

    if (charts.traj) charts.traj.destroy();
    charts.traj = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Per Question',
                    data: cps.map(c => (c.relevance_score ?? 0) * 100),
                    borderColor: 'rgba(56,139,253,0.5)',
                    backgroundColor: 'rgba(56,139,253,0.05)',
                    fill: true, tension: 0.4, borderDash: [4, 3], pointRadius: 3,
                },
                {
                    label: 'Cumulative Average',
                    data: cumAvg,
                    borderColor: '#3fb950',
                    backgroundColor: 'transparent',
                    tension: 0.4, borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#3fb950',
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { 
                y: { 
                    min: 0, 
                    max: 100, 
                    ticks: { 
                        callback: v => `${v}%`,
                        color: '#ffffff',
                        font: { size: 10 }
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    ticks: { color: '#ffffff', font: { size: 9 } },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            },
            plugins: { 
                legend: { 
                    position: 'top',
                    labels: { color: '#ffffff', font: { size: 11 } }
                } 
            }
        }
    });
}

function wireExport() {
    document.getElementById('analyticsExportBtn')?.addEventListener('click', () => {
        exportSessionJSON({
            checkpoints: sessionData.checkpoints,
            final_verdict: sessionData.final_verdict,
            relevance_scores: sessionData.relevance_scores,
            behavior_metrics: sessionData.behavior_metrics,
        });
    });
}
