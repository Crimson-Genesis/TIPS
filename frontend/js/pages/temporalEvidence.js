// ═══════════════════════════════════════════════════════════════
// TIPS Unified Frontend — pages/temporalEvidence.js
// Page 2: Timeline, speaking segments, Q&A timing, score overlay
// ═══════════════════════════════════════════════════════════════
import { sessionData, fmtTime, scoreColor } from '../dataLoader.js';

let chartInstances = {};
let playheadSec = 0;

export function renderTemporal(el) {
    if (!sessionData.loaded) {
        el.innerHTML = `<div class="empty-state"><div class="es-icon">⏱</div>
            <div class="es-title">No session loaded</div>
            <div class="es-sub">Load a session to view temporal evidence.</div></div>`;
        return;
    }
    el.innerHTML = buildTemporal();
    setupTimeline();
    setupEvidencePanels();
    setupTranscriptPanel();
}

function buildTemporal() {
    const dur = sessionData.timeline?.duration_seconds ?? sessionData.timeline?.duration ?? 0;
    const segs = sessionData.speaking_segments || [];
    const qaPairs = sessionData.qa_pairs?.qa_pairs || [];
    const checkpoints = sessionData.checkpoints || [];

    return `
    <div class="section-header" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
            <div class="section-title">Temporal Evidence</div>
            <div class="section-sub">Interview timeline, speaking segments, and score trajectory</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
            <label style="font-size:12px;color:var(--text-muted)">Filter:</label>
            <select id="speakerFilter" style="background:var(--bg-elevated);border:1px solid var(--border);
                color:var(--text-primary);border-radius:6px;padding:5px 10px;font-size:12px;font-family:inherit">
                <option value="all">All Speakers</option>
                <option value="candidate">Candidate</option>
                <option value="interviewer">Interviewer</option>
            </select>
        </div>
    </div>

    <!-- Timeline ruler + tracks -->
    <div class="stat-card" style="padding:20px;margin-bottom:20px;overflow:hidden">
        <div class="stat-card-title" style="margin-bottom:14px">
            Timeline
            <span style="font-size:11px;color:var(--text-muted);font-weight:400;margin-left:8px">
                Duration: ${fmtTime(dur)}
            </span>
        </div>

        <!-- Ruler -->
        <div id="timelineRuler" style="position:relative;height:22px;margin-bottom:6px;border-bottom:1px solid var(--border-subtle)"></div>

        <!-- Speaking track -->
        <div style="margin-bottom:6px">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.06em">Speaking Segments</div>
            <div id="trackSpeaking" style="position:relative;height:24px;background:var(--bg-primary);border-radius:4px;overflow:hidden"></div>
        </div>

        <!-- Questions track -->
        <div style="margin-bottom:6px">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.06em">Q&A Blocks</div>
            <div id="trackQA" style="position:relative;height:24px;background:var(--bg-primary);border-radius:4px;overflow:hidden"></div>
        </div>

        <!-- Score track -->
        <div style="margin-bottom:6px">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.06em">Relevance Score</div>
            <div id="trackScore" style="position:relative;height:24px;background:var(--bg-primary);border-radius:4px;overflow:hidden"></div>
        </div>

        <!-- Legend -->
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:var(--text-muted)">
            ${legendDot('#388bfd', 'Candidate speech')}
            ${legendDot('#8b949e', 'Interviewer speech')}
            ${legendDot('#bc8cff', 'Q&A block')}
        </div>
    </div>

    <!-- Charts row -->
    <div class="grid-2" style="margin-bottom:20px">
        <div class="stat-card" style="padding:20px">
            <div class="stat-card-title" style="margin-bottom:14px">Score Trajectory</div>
            <div style="height:200px;position:relative"><canvas id="scoreTrajectoryChart"></canvas></div>
        </div>
        <div class="stat-card" style="padding:20px">
            <div class="stat-card-title" style="margin-bottom:14px">Behavioral Signals</div>
            <div style="height:200px;position:relative"><canvas id="behaviorSignalChart"></canvas></div>
        </div>
    </div>

    <!-- Transcript panel -->
    <div class="stat-card" style="padding:0;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border-subtle)">
            <div class="stat-card-title">Transcript</div>
            <div style="display:flex;gap:6px">
                <button class="btn-export" id="showAllTranscript" style="font-size:11px">Show All</button>
            </div>
        </div>
        <div id="transcriptPanel" style="max-height:320px;overflow-y:auto;padding:12px 20px;display:flex;flex-direction:column;gap:8px"></div>
    </div>`;
}

function legendDot(color, label) {
    return `<span style="display:flex;align-items:center;gap:5px">
        <span style="width:10px;height:10px;border-radius:2px;background:${color};flex-shrink:0"></span>${label}
    </span>`;
}

function setupTimeline() {
    const dur = sessionData.timeline?.duration_seconds ?? sessionData.timeline?.duration ?? 1;
    const segs = sessionData.speaking_segments || [];
    const qaPairs = sessionData.qa_pairs?.qa_pairs || [];
    const checkpoints = sessionData.checkpoints || [];

    const pct = sec => `${((sec / dur) * 100).toFixed(2)}%`;

    // Ruler
    const ruler = document.getElementById('timelineRuler');
    if (ruler) {
        const steps = Math.min(10, Math.floor(dur / 30));
        const interval = dur / (steps || 1);
        for (let i = 0; i <= steps; i++) {
            const t = i * interval;
            const tick = document.createElement('span');
            tick.style.cssText = `position:absolute;left:${pct(t)};font-size:10px;color:var(--text-muted);
                transform:translateX(-50%);font-family:var(--font-mono)`;
            tick.textContent = fmtTime(t);
            ruler.appendChild(tick);
        }
    }

    // Speaking track
    const trackSpk = document.getElementById('trackSpeaking');
    if (trackSpk) {
        segs.forEach(seg => {
            const start = seg.start_time ?? seg.start ?? 0;
            const end = seg.end_time ?? seg.end ?? 0;
            const speaker = (seg.speaker || 'candidate').toLowerCase();
            const color = speaker === 'interviewer' ? '#8b949e' : '#388bfd';
            const bar = document.createElement('div');
            bar.style.cssText = `position:absolute;left:${pct(start)};width:${pct(end - start)};
                height:100%;background:${color};opacity:0.75;border-radius:2px;cursor:pointer`;
            bar.title = `${speaker} [${fmtTime(start)} → ${fmtTime(end)}]`;
            bar.dataset.speaker = speaker;
            trackSpk.appendChild(bar);
        });
    }

    // Q&A track
    const trackQA = document.getElementById('trackQA');
    if (trackQA) {
        qaPairs.forEach((pair, i) => {
            const start = pair.question_start_time ?? 0;
            const end = (pair.answer?.end_time ?? pair.question_end_time ?? start + 5);
            const bar = document.createElement('div');
            bar.style.cssText = `position:absolute;left:${pct(start)};width:${pct(end - start)};
                height:100%;background:#bc8cff;opacity:0.7;border-radius:2px;cursor:pointer;
                display:flex;align-items:center;justify-content:center;
                font-size:9px;color:#0d1117;font-weight:700;overflow:hidden`;
            bar.textContent = `Q${i + 1}`;
            bar.title = pair.question_text;
            bar.addEventListener('click', () => jumpToQA(pair.question_id));
            trackQA.appendChild(bar);
        });
    }

    // Score track (colored blocks per checkpoint)
    const trackScore = document.getElementById('trackScore');
    if (trackScore && checkpoints.length && qaPairs.length) {
        checkpoints.forEach(cp => {
            const pair = qaPairs.find(p => p.question_id === cp.checkpoint);
            if (!pair) return;
            const start = pair.question_start_time ?? 0;
            const end = pair.answer?.end_time ?? (start + 10);
            const score = cp.relevance_score ?? 0;
            const bar = document.createElement('div');
            bar.style.cssText = `position:absolute;left:${pct(start)};width:${pct(end - start)};
                height:100%;background:${scoreColor(score)};opacity:0.8;border-radius:2px`;
            bar.title = `Score: ${score.toFixed(2)} — ${cp.checkpoint}`;
            trackScore.appendChild(bar);
        });
    }

    // Speaker filter
    document.getElementById('speakerFilter')?.addEventListener('change', e => {
        const val = e.target.value;
        const bars = document.querySelectorAll('#trackSpeaking [data-speaker]');
        bars.forEach(bar => {
            bar.style.opacity = (val === 'all' || bar.dataset.speaker === val) ? '0.75' : '0.15';
        });
    });
}

function setupEvidencePanels() {
    // Score trajectory
    const scoreCtx = document.getElementById('scoreTrajectoryChart');
    if (scoreCtx) {
        const cps = sessionData.checkpoints || [];
        const labels = cps.map((c, i) => `Q${i + 1}`);
        const vals = cps.map(c => (c.relevance_score ?? 0) * 100);
        if (chartInstances.scoreTraj) chartInstances.scoreTraj.destroy();
        chartInstances.scoreTraj = new Chart(scoreCtx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Relevance %',
                    data: vals,
                    borderColor: '#388bfd',
                    backgroundColor: 'rgba(56,139,253,0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: vals.map(v => v >= 70 ? '#3fb950' : v >= 40 ? '#d29922' : '#f85149'),
                    pointRadius: 5,
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
                        ticks: { color: '#ffffff', font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // Behavioral signals (from behavior_metrics)
    const behCtx = document.getElementById('behaviorSignalChart');
    if (behCtx) {
        const bm = sessionData.behavior_metrics || {};
        const all = bm.segments || [];
        
        // Sample every Nth segment to avoid overcrowding (max 30 points)
        const step = Math.max(1, Math.floor(all.length / 30));
        const samples = all.filter((_, i) => i % step === 0).slice(0, 30);
        
        const labels = samples.map(s => fmtTime(s.start_time ?? 0));
        
        // Derive behavioral metrics from raw audio/video data
        // Energy (normalized to 0-100) - represents vocal confidence
        const energy = samples.map(s => {
            const e = s.audio_metrics?.energy_mean ?? 0;
            return Math.min(100, e * 1000); // Scale energy to visible range
        });
        
        // Speech rate (normalized) - represents fluency
        const speechRate = samples.map(s => {
            const rate = s.audio_metrics?.speech_rate ?? 0;
            return Math.min(100, rate * 5); // Typical rate 5-15 words/sec
        });
        
        // Gaze stability (normalized to 0-100) - represents engagement
        const gaze = samples.map(s => {
            const g = s.video_metrics?.gaze_stability ?? 0;
            return Math.min(100, g * 10000); // Scale small values
        });
        
        if (chartInstances.behSignal) chartInstances.behSignal.destroy();
        chartInstances.behSignal = new Chart(behCtx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { 
                        label: 'Vocal Energy', 
                        data: energy, 
                        borderColor: 'rgba(56,139,253,0.8)',
                        backgroundColor: 'rgba(56,139,253,0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    { 
                        label: 'Speech Rate', 
                        data: speechRate, 
                        borderColor: 'rgba(57,197,207,0.8)',
                        backgroundColor: 'rgba(57,197,207,0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    { 
                        label: 'Gaze Stability', 
                        data: gaze, 
                        borderColor: 'rgba(187,140,255,0.8)',
                        backgroundColor: 'rgba(187,140,255,0.1)',
                        fill: true,
                        tension: 0.3
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
                        ticks: { 
                            color: '#ffffff', 
                            font: { size: 9 },
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                },
                plugins: { 
                    legend: { 
                        position: 'top',
                        labels: { 
                            color: '#ffffff',
                            font: { size: 11 },
                            boxWidth: 12
                        }
                    }
                }
            }
        });
    }
}

function setupTranscriptPanel() {
    const panel = document.getElementById('transcriptPanel');
    if (!panel) return;

    const pairs = sessionData.qa_pairs?.qa_pairs || [];
    const interviewer = sessionData.interviewer?.transcription_segments ||
        sessionData.interviewer?.segments || [];

    if (!pairs.length && !interviewer.length) {
        panel.innerHTML = `<div style="color:var(--text-muted);font-size:12px">No transcript data available.</div>`;
        return;
    }

    const combined = [];
    pairs.forEach(p => {
        combined.push({ time: p.question_start_time ?? 0, speaker: 'Interviewer', text: p.question_text });
        if (p.answer?.text) combined.push({ time: p.answer.start_time ?? 0, speaker: 'Candidate', text: p.answer.text });
    });
    combined.sort((a, b) => a.time - b.time);

    panel.innerHTML = combined.slice(0, 40).map(item => {
        const isCandidate = item.speaker === 'Candidate';
        return `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-subtle)">
            <span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);
                white-space:nowrap;padding-top:2px;min-width:38px">${fmtTime(item.time)}</span>
            <div>
                <span style="font-size:10px;font-weight:700;color:${isCandidate ? 'var(--accent-blue)' : 'var(--accent-green)'};
                    text-transform:uppercase;letter-spacing:.04em">${item.speaker}</span>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:3px;line-height:1.5">${item.text}</div>
            </div>
        </div>`;
    }).join('');

    document.getElementById('showAllTranscript')?.addEventListener('click', () => {
        panel.style.maxHeight = panel.style.maxHeight === 'none' ? '320px' : 'none';
    });
}

function jumpToQA(questionId) {
    // Navigate to Q&A page and activate that accordion
    import('../router.js').then(({ navigateTo }) => {
        navigateTo('qa');
        setTimeout(() => {
            const items = document.querySelectorAll('.accordion-item');
            items.forEach(item => {
                const qid = item.querySelector('.acc-qid');
                if (qid && qid.textContent === questionId) {
                    item.classList.add('open');
                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }, 300);
    });
}
