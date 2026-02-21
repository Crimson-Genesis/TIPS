// ═══════════════════════════════════════════════════════════════
// TIPS Unified Frontend — pages/hub.js
// Page 1: Session Hub — verdict, KPIs, radar chart
// ═══════════════════════════════════════════════════════════════
import { sessionData, fmtTime, scoreClass, verdictClass, totalSpeakingTime, avgCompetency, exportSessionJSON } from '../dataLoader.js';
import { COMPETENCY_KEYS } from '../config.js';

let radarChart = null;

export function renderHub(el) {
    if (!sessionData.loaded) {
        el.innerHTML = buildEmpty();
        return;
    }
    el.innerHTML = buildHub();
    drawRadar();
    wireExport();
}

function buildEmpty() {
    return `<div class="empty-state">
        <div class="es-icon">📋</div>
        <div class="es-title">No session loaded</div>
        <div class="es-sub">Click <strong>Load Session</strong> in the sidebar to load your pipeline output files.</div>
    </div>`;
}

function buildHub() {
    const fv = sessionData.final_verdict || {};
    const overallScore = fv.overall_score ?? averageScore();
    const checkpoints = sessionData.checkpoints || [];
    const qaPairs = sessionData.qa_pairs?.qa_pairs || [];
    const segs = sessionData.speaking_segments || [];
    const speakSec = totalSpeakingTime(segs.filter(s => s.speaker === 'candidate' || !s.speaker));
    const dataset = sessionData.timeline?.dataset_id || sessionData.timeline?.session_id || '—';
    const verdict = fv.verdict || fv.overall_verdict || '—';
    const vcls = verdictClass(verdict);
    const nQ = qaPairs.length || checkpoints.length;
    const dur = sessionData.timeline?.duration_seconds ?? sessionData.timeline?.duration ?? 0;
    const summary = fv.summary || fv.recommendation || '';

    return `
    <div class="section-header" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:baseline;gap:12px">
            <div class="section-title">Session Hub</div>
            <div class="section-sub" style="font-family:var(--font-mono)">${dataset}</div>
        </div>
        <button class="btn-export" id="hubExportBtn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export JSON
        </button>
    </div>

    <!-- Verdict Banner -->
    <div class="verdict-banner verdict-${vcls}" style="margin-bottom:24px">
        <div class="verdict-icon">${vcls === 'strong' ? '✓' : vcls === 'weak' ? '△' : '✗'}</div>
        <div class="verdict-body">
            <div class="verdict-label">Final Verdict</div>
            <div class="verdict-text">${verdict}</div>
            ${summary ? `<div class="verdict-summary">${summary}</div>` : ''}
        </div>
        <div class="verdict-score ${scoreClass(overallScore)}">
            <div class="vs-value">${(overallScore * 100).toFixed(0)}</div>
            <div class="vs-label">/ 100</div>
        </div>
    </div>

    <!-- KPI Grid -->
    <div class="grid-4" style="margin-bottom:24px">
        ${kpiCard('Questions', nQ, 'answered', '💬')}
        ${kpiCard('Duration', fmtTime(dur), 'interview length', '⏱')}
        ${kpiCard('Speaking', fmtTime(speakSec), 'candidate talk time', '🎙')}
        ${kpiCard('Avg Score', (overallScore * 100).toFixed(0) + '%', 'overall relevance', '📊')}
    </div>

    <!-- Radar + Competency breakdown -->
    <div class="grid-2" style="margin-bottom:24px">
        <div class="stat-card" style="padding:20px">
            <div class="stat-card-title" style="margin-bottom:16px">Competency Radar</div>
            <div style="position:relative;height:260px">
                <canvas id="radarChart"></canvas>
            </div>
        </div>
        <div class="stat-card" style="padding:20px">
            <div class="stat-card-title" style="margin-bottom:16px">Competency Summary</div>
            ${COMPETENCY_KEYS.map(ck => {
        const val = avgCompetency(sessionData.checkpoints || [], ck.key);
        const pct = (val * 100).toFixed(0);
        return `<div class="prog-bar-wrap" style="margin-bottom:12px">
                    <span class="prog-bar-label">${ck.label}</span>
                    <div class="prog-bar-track">
                        <div class="prog-bar-fill" style="width:${pct}%;background:${ck.color}"></div>
                    </div>
                    <span class="prog-bar-val">${pct}%</span>
                </div>`;
    }).join('')}
        </div>
    </div>

    <!-- Quick nav -->
    <div class="grid-3">
        ${quickNavCard('⏱', 'Temporal Evidence', 'Visualize speaking segments, Q&A timing, and score trajectory', 'temporal')}
        ${quickNavCard('📊', 'Analytics', 'Deep-dive into behavioral signals, keyword matching, and charts', 'analytics')}
        ${quickNavCard('💬', 'Q&A Review', 'Accordion transcript with per-question scores and reasoning', 'qa')}
    </div>`;
}

function kpiCard(label, value, sub, icon) {
    return `<div class="stat-card">
        <div class="stat-card-icon" style="font-size:20px;margin-bottom:8px">${icon}</div>
        <div class="stat-card-value">${value}</div>
        <div class="stat-card-label">${label}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${sub}</div>
    </div>`;
}

function quickNavCard(icon, title, desc, page) {
    return `<button class="sidebar-nav-item" data-page="${page}"
        style="flex-direction:column;align-items:flex-start;gap:6px;padding:16px;
               background:var(--bg-secondary);border:1px solid var(--border);
               border-radius:var(--radius-lg);height:auto;text-align:left">
        <div style="font-size:22px;line-height:1">${icon}</div>
        <div style="font-weight:700;font-size:13px;color:var(--text-primary)">${title}</div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;white-space:normal">${desc}</div>
    </button>`;
}

function averageScore() {
    const cps = sessionData.checkpoints || [];
    if (!cps.length) return 0;
    const sum = cps.reduce((a, c) => a + (c.relevance_score || 0), 0);
    return sum / cps.length;
}

function drawRadar() {
    const canvas = document.getElementById('radarChart');
    if (!canvas) return;
    if (radarChart) { radarChart.destroy(); radarChart = null; }

    const labels = COMPETENCY_KEYS.map(c => c.label);
    const vals = COMPETENCY_KEYS.map(c => avgCompetency(sessionData.checkpoints || [], c.key) * 100);

    radarChart = new Chart(canvas, {
        type: 'radar',
        data: {
            labels,
            datasets: [{
                label: 'Candidate Score',
                data: vals,
                backgroundColor: 'rgba(56,139,253,0.15)',
                borderColor: '#388bfd',
                borderWidth: 2,
                pointBackgroundColor: '#388bfd',
                pointRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    min: 0, max: 100,
                    ticks: { stepSize: 25, color: '#484f58', font: { size: 10 } },
                    grid: { color: 'rgba(48,54,61,0.8)' },
                    angleLines: { color: 'rgba(48,54,61,0.6)' },
                    pointLabels: { color: '#8b949e', font: { size: 11 } },
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function wireExport() {
    document.getElementById('hubExportBtn')?.addEventListener('click', () => {
        exportSessionJSON({
            dataset_id: sessionData.timeline?.dataset_id,
            final_verdict: sessionData.final_verdict,
            checkpoints: sessionData.checkpoints,
            relevance_scores: sessionData.relevance_scores,
        });
    });
}
