// ═══════════════════════════════════════════════════════════════
// TIPS Dashboard — pages/temporalEvidence.js  (v3)
// ═══════════════════════════════════════════════════════════════
import { sessionData, fmtTime, scoreColor } from '../dataLoader.js';

let audioChart = null;
let videoChart = null;
let behaviorChart = null;

export function renderTemporal(el) {
    console.log('[TIPS] renderTemporal called. timeline:', !!sessionData.timeline,
        'speaking_segments:', sessionData.speaking_segments?.length,
        'behavior_metrics:', !!sessionData.behavior_metrics);

    // Show empty state only if NOTHING is loaded at all
    if (!sessionData.loaded && !sessionData.timeline && !sessionData.speaking_segments) {
        el.innerHTML = noDataMsg();
        return;
    }
    try {
        el.innerHTML = buildTemporal();
        setupTimeline();
        setupEvidencePanels();
        console.log('[TIPS] renderTemporal complete');
    } catch (err) {
        console.error('[TIPS] renderTemporal ERROR:', err);
        el.innerHTML = `<div class="empty-state">
            <div class="es-icon">⚠</div>
            <div class="es-title">Render Error</div>
            <div class="es-sub"><code>${err.message}</code><br>Check console (F12) for details.</div>
        </div>`;
    }
}

function noDataMsg() {
    const errs = Object.keys(sessionData.errors || {});
    const errHtml = errs.length
        ? `<div style="margin-top:12px;font-size:11px;color:var(--score-low)">Failed: ${errs.join(', ')}</div>`
        : '';
    return `<div class="empty-state">
        <div class="es-icon">⏱</div>
        <div class="es-title">No data loaded</div>
        <div class="es-sub">Click <strong>Load Session</strong> → Folder Picker → select <code>output/</code> folder.${errHtml}</div>
    </div>`;
}

function buildTemporal() {
    const sp = sessionData.speaking_segments || [];
    const qa = sessionData.qa_pairs?.qa_pairs || [];
    const dur = sessionData.timeline?.video?.duration_sec || 1;

    const spkTime = sp.reduce((a, s) => a + ((s.end_time ?? s.end ?? 0) - (s.start_time ?? s.start ?? 0)), 0);
    const silTime = Math.max(0, dur - spkTime);
    const avgLatency = computeAvgLatency(qa);
    const longestSil = computeLongestGap(sp, dur);

    return `
  <div class="section-header">
    <div class="section-title">Temporal Evidence View</div>
    <div class="section-sub">All interview signals on a unified time axis</div>
  </div>

  <!-- Data status row -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;font-size:11px">
    ${dataChip('Timeline', !!sessionData.timeline)}
    ${dataChip('Speaking Segs', sp.length > 0, sp.length)}
    ${dataChip('QA Pairs', qa.length > 0, qa.length)}
    ${dataChip('Behavior Metrics', !!sessionData.behavior_metrics)}
    ${dataChip('Checkpoints', (sessionData.checkpoints?.length ?? 0) > 0, sessionData.checkpoints?.length)}
  </div>

  <!-- Master Timeline -->
  <div class="timeline-wrap reveal">
    <div class="timeline-label-row">
      <span>0:00</span>
      <span>${fmtTime(dur / 4)}</span>
      <span>${fmtTime(dur / 2)}</span>
      <span>${fmtTime(dur * 3 / 4)}</span>
      <span>${fmtTime(dur)}</span>
    </div>
    <div class="timeline-rows" id="timelineRows">
      <div class="timeline-row">
        <span class="tl-row-label">Speaking</span>
        <div class="tl-row-track" id="trackSpeaking"></div>
      </div>
      <div class="timeline-row">
        <span class="tl-row-label">Questions</span>
        <div class="tl-row-track" id="trackQuestions"></div>
      </div>
      <div class="timeline-row">
        <span class="tl-row-label">Relevance</span>
        <div class="tl-row-track" id="trackScores"></div>
      </div>
    </div>
    <div style="display:flex;gap:20px;margin-top:10px;font-size:11px;color:var(--text-muted)">
      <span><span style="display:inline-block;width:10px;height:10px;background:var(--accent-green);border-radius:2px;margin-right:4px;opacity:0.7"></span>Speaking</span>
      <span><span style="display:inline-block;width:8px;height:10px;background:var(--accent-orange);margin-right:4px;opacity:0.8"></span>Question</span>
      <span>Relevance: <span style="color:var(--score-high)">■</span> High&nbsp;<span style="color:var(--score-mid)">■</span> Mid&nbsp;<span style="color:var(--score-low)">■</span> Low</span>
    </div>
  </div>

  <!-- Summary Stats -->
  <div class="grid-4 reveal" style="margin-bottom:24px">
    <div class="stat-card">
      <div class="stat-label">Speaking</div>
      <div class="stat-value">${dur > 0 ? ((spkTime / dur) * 100).toFixed(0) : 0}%</div>
      <div class="stat-sub">${fmtTime(spkTime)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Silence</div>
      <div class="stat-value">${dur > 0 ? ((silTime / dur) * 100).toFixed(0) : 0}%</div>
      <div class="stat-sub">${fmtTime(silTime)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Longest Gap</div>
      <div class="stat-value">${longestSil.toFixed(1)}s</div>
      <div class="stat-sub">between segments</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg Response Lag</div>
      <div class="stat-value">${avgLatency.toFixed(1)}s</div>
      <div class="stat-sub">Q-end → A-start</div>
    </div>
  </div>

  <!-- Evidence Panels -->
  <div class="section-header reveal">
    <div class="section-title">Evidence Panels</div>
  </div>
  <div class="evidence-grid reveal">
    <div class="evidence-panel">
      <div class="ev-panel-header">
        <span class="ev-panel-title">🎙 Audio Signal</span>
        <span style="font-size:10px;color:var(--text-muted)">Pitch (Hz) · Energy</span>
      </div>
      <div class="ev-panel-body" style="padding:12px">
        <canvas id="audioSignalChart" style="width:100%;height:100%"></canvas>
      </div>
    </div>
    <div class="evidence-panel">
      <div class="ev-panel-header">
        <span class="ev-panel-title">👁 Video Signal</span>
        <span style="font-size:10px;color:var(--text-muted)">Gaze · Head motion</span>
      </div>
      <div class="ev-panel-body" style="padding:12px">
        <canvas id="videoSignalChart" style="width:100%;height:100%"></canvas>
      </div>
    </div>
    <div class="evidence-panel">
      <div class="ev-panel-header">
        <span class="ev-panel-title">📝 Answer Transcript</span>
        <span style="font-size:10px;color:var(--text-muted)">Q→A pairs</span>
      </div>
      <div class="ev-panel-body transcript-body" id="transcriptPanel">
        ${buildTranscript()}
      </div>
    </div>
    <div class="evidence-panel">
      <div class="ev-panel-header">
        <span class="ev-panel-title">📶 Behavioral Signature</span>
        <span style="font-size:10px;color:var(--text-muted)">Speech Rate · Pause Density</span>
      </div>
      <div class="ev-panel-body" style="padding:12px">
        <canvas id="behavioralChart" style="width:100%;height:100%"></canvas>
      </div>
    </div>
  </div>`;
}

function dataChip(label, ok, count) {
    const color = ok ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.1)';
    const border = ok ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.25)';
    const textColor = ok ? 'var(--score-high)' : 'var(--score-low)';
    const icon = ok ? '✓' : '✗';
    const countStr = count != null ? ` (${count})` : '';
    return `<span style="padding:2px 8px;border-radius:20px;background:${color};border:1px solid ${border};color:${textColor}">${icon} ${label}${countStr}</span>`;
}

function buildTranscript() {
    const qa = sessionData.qa_pairs?.qa_pairs || [];
    if (!qa.length) return '<div style="color:var(--text-muted);font-size:12px;padding:8px">No transcript data loaded.</div>';
    return qa.map(pair => `
    <div class="transcript-seg">
      <span class="ts-time">${fmtTime(pair.answer?.start_time)}</span>
      <span class="ts-text">${pair.answer?.text || '—'}</span>
    </div>
  `).join('');
}

function computeAvgLatency(qa) {
    if (!qa.length) return 0;
    const lats = qa
        .filter(p => p.answer?.start_time != null && p.question_end_time != null)
        .map(p => p.answer.start_time - p.question_end_time)
        .filter(l => l >= 0 && l < 60);
    return lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : 0;
}

function computeLongestGap(sp, totalDur) {
    if (!sp.length) return totalDur;
    const sorted = [...sp].sort((a, b) => (a.start_time ?? a.start ?? 0) - (b.start_time ?? b.start ?? 0));
    let maxGap = sorted[0].start_time ?? sorted[0].start ?? 0;
    for (let i = 1; i < sorted.length; i++) {
        const prevEnd = sorted[i - 1].end_time ?? sorted[i - 1].end ?? 0;
        const curStart = sorted[i].start_time ?? sorted[i].start ?? 0;
        maxGap = Math.max(maxGap, curStart - prevEnd);
    }
    return maxGap;
}

function setupTimeline() {
    const sp = sessionData.speaking_segments || [];
    const qa = sessionData.qa_pairs?.qa_pairs || [];
    const cp = sessionData.checkpoints || [];
    const dur = sessionData.timeline?.video?.duration_sec || 1;

    console.log('[TIPS] setupTimeline: sp=', sp.length, 'qa=', qa.length, 'cp=', cp.length, 'dur=', dur);

    const trackA = document.getElementById('trackSpeaking');
    if (trackA && sp.length) {
        sp.forEach(seg => {
            const start = seg.start_time ?? seg.start ?? 0;
            const end = seg.end_time ?? seg.end ?? 0;
            const w = ((end - start) / dur) * 100;
            if (w < 0.02) return;
            const div = document.createElement('div');
            div.className = 'tl-segment speaking';
            div.style.left = `${((start / dur) * 100).toFixed(3)}%`;
            div.style.width = `${w.toFixed(3)}%`;
            div.title = `${seg.segment_id} [${fmtTime(start)} → ${fmtTime(end)}]`;
            trackA.appendChild(div);
        });
    }

    const trackB = document.getElementById('trackQuestions');
    if (trackB && qa.length) {
        qa.forEach(pair => {
            const t = pair.question_start_time ?? 0;
            const div = document.createElement('div');
            div.className = 'tl-q-marker';
            div.style.left = `${((t / dur) * 100).toFixed(3)}%`;
            div.title = `${pair.question_id}: ${pair.question_text}`;
            trackB.appendChild(div);
        });
    }

    const trackC = document.getElementById('trackScores');
    if (trackC && cp.length) {
        const cpMap = {};
        cp.forEach(c => { cpMap[c.checkpoint] = c; });
        qa.forEach(pair => {
            const cpEntry = cpMap[pair.question_id];
            const score = cpEntry?.relevance_score ?? 0.5;
            const start = pair.answer?.start_time ?? pair.question_start_time ?? 0;
            const end = pair.answer?.end_time ?? pair.question_end_time ?? (start + 5);
            if (end <= start) return;
            const div = document.createElement('div');
            div.className = 'tl-segment score';
            div.style.left = `${((start / dur) * 100).toFixed(3)}%`;
            div.style.width = `${(((end - start) / dur) * 100).toFixed(3)}%`;
            div.style.background = scoreColor(score);
            div.title = `${pair.question_id} relevance: ${score.toFixed(2)}`;
            trackC.appendChild(div);
        });
    }

    const rowsEl = document.getElementById('timelineRows');
    if (!rowsEl || !trackA) return;
    rowsEl.addEventListener('mousemove', (e) => {
        const rect = trackA.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        document.querySelectorAll('.tl-row-track').forEach(r => {
            let ph = r.querySelector('.playhead-cursor');
            if (!ph) { ph = document.createElement('div'); ph.className = 'playhead-cursor'; r.appendChild(ph); }
            ph.style.display = 'block';
            ph.style.left = `${(pct * 100).toFixed(2)}%`;
        });
    });
    rowsEl.addEventListener('mouseleave', () => {
        document.querySelectorAll('.tl-row-track .playhead-cursor').forEach(p => p.style.display = 'none');
    });
}

function safeDestroy(chart) {
    try { if (chart) chart.destroy(); } catch (e) { }
    return null;
}

function setupEvidencePanels() {
    const bm = sessionData.behavior_metrics?.segments || [];
    console.log('[TIPS] setupEvidencePanels: bm segments =', bm.length);

    const labels = bm.map(s => fmtTime(s.start_time ?? s.start ?? 0));

    audioChart = safeDestroy(audioChart);
    const ctxA = document.getElementById('audioSignalChart');
    if (ctxA && bm.length) {
        const pitch = bm.map(s => +(s.audio_metrics?.pitch_mean || 0).toFixed(1));
        const energy = bm.map(s => +((s.audio_metrics?.energy_mean || 0) * 1000).toFixed(3));
        audioChart = new Chart(ctxA, {
            type: 'line',
            data: {
                labels, datasets: [
                    { label: 'Pitch (Hz)', data: pitch, borderColor: '#388bfd', borderWidth: 1.5, pointRadius: 0, tension: 0.4, yAxisID: 'y' },
                    { label: 'Energy ×1000', data: energy, borderColor: '#3fb950', borderWidth: 1.0, pointRadius: 0, tension: 0.4, fill: true, backgroundColor: 'rgba(63,185,80,0.06)', yAxisID: 'y1' },
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
                plugins: { legend: { labels: { boxWidth: 8, font: { size: 10 } } } },
                scales: { x: { display: false }, y: { grid: { color: 'rgba(48,54,61,0.5)' } }, y1: { display: false, position: 'right' } }
            }
        });
    } else if (ctxA) {
        ctxA.parentElement.innerHTML = '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:20px">No behavioral data — load candidate_behavior_metrics.json</div>';
    }

    videoChart = safeDestroy(videoChart);
    const ctxV = document.getElementById('videoSignalChart');
    if (ctxV && bm.length) {
        const gaze = bm.map(s => +((s.video_metrics?.gaze_stability || 0) * 1000).toFixed(4));
        const head = bm.map(s => +((s.video_metrics?.head_motion_mean || 0)).toFixed(3));
        videoChart = new Chart(ctxV, {
            type: 'line',
            data: {
                labels, datasets: [
                    { label: 'Gaze ×1000', data: gaze, borderColor: '#bc8cff', borderWidth: 1.5, pointRadius: 0, tension: 0.4 },
                    { label: 'Head Motion', data: head, borderColor: '#d29922', borderWidth: 1.0, pointRadius: 0, tension: 0.4 },
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
                plugins: { legend: { labels: { boxWidth: 8, font: { size: 10 } } } },
                scales: { x: { display: false }, y: { display: true, grid: { color: 'rgba(48,54,61,0.5)' } } }
            }
        });
    } else if (ctxV) {
        ctxV.parentElement.innerHTML = '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:20px">No video data</div>';
    }

    behaviorChart = safeDestroy(behaviorChart);
    const ctxB = document.getElementById('behavioralChart');
    if (ctxB && bm.length) {
        const sr = bm.map(s => +(s.audio_metrics?.speech_rate || 0).toFixed(2));
        const pd = bm.map(s => +(s.audio_metrics?.pause_density || 0).toFixed(2));
        behaviorChart = new Chart(ctxB, {
            type: 'bar',
            data: {
                labels, datasets: [
                    { label: 'Speech Rate', data: sr, backgroundColor: 'rgba(56,139,253,0.6)', borderWidth: 0 },
                    { label: 'Pause Density', data: pd, backgroundColor: 'rgba(210,153,34,0.5)', borderWidth: 0 },
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
                plugins: { legend: { labels: { boxWidth: 8, font: { size: 10 } } } },
                scales: { x: { display: false }, y: { grid: { color: 'rgba(48,54,61,0.5)' } } }
            }
        });
    } else if (ctxB) {
        ctxB.parentElement.innerHTML = '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:20px">No behavioral data</div>';
    }
}
