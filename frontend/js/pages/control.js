// ═══════════════════════════════════════════════════════════════
// TIPS Unified Frontend — pages/control.js
// Page 6: WebRTC Interview Control Panel
// Real-time room status, recording control, session list
// ═══════════════════════════════════════════════════════════════

let ws = null;
let roomState = 'IDLE';
let timerInterval = null;
let timerSec = 0;

export function renderControl(el) {
    el.innerHTML = buildControl();
    initWebSocket();
    loadRecordingsList();
    wireButtons();
}

function buildControl() {
    return `
    <div class="section-header" style="margin-bottom:20px">
        <div class="section-title">Interview Control</div>
        <div class="section-sub">Manage live interview sessions — WebRTC recording and session control</div>
    </div>

    <!-- Server connection status -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <span class="ws-status">
            <span class="ws-dot" id="wsDot"></span>
            <span id="wsLabel">Connecting…</span>
        </span>
        <span style="color:var(--text-muted);font-size:11px">|</span>
        <code id="wsUrl" style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">${location.origin}/ws</code>
    </div>

    <!-- Room status banner -->
    <div class="room-status-banner" id="roomStatusBanner">
        <div class="room-status-dot idle" id="roomStatusDot"></div>
        <div class="room-status-text">
            <div class="room-status-label" id="roomStatusLabel">IDLE</div>
            <div class="room-status-detail" id="roomStatusDetail">No active session. Open the Interviewer interface to start.</div>
        </div>
        <div id="recordingIndicator" style="display:none">
            <div class="recording-indicator">
                <span class="rec-dot"></span>
                <span>REC</span>
                <span class="recording-timer" id="recTimer">00:00</span>
            </div>
        </div>
    </div>

    <!-- Control cards -->
    <div class="control-grid">
        <!-- Interviewer card -->
        <div class="control-card">
            <div class="control-card-icon">🎙</div>
            <div class="control-card-title">Interviewer Interface</div>
            <div class="control-card-desc">
                Open the interviewer console to join the room, start/stop recording, and manage the session.
                The interviewer has full recording control.
            </div>
            <div class="control-card-actions">
                <a class="btn-control primary" href="/interviewer" target="_blank" id="btnInterviewer">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Open Interviewer
                </a>
                <button class="btn-control secondary" id="btnCopyInterviewerLink">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy Link
                </button>
            </div>
        </div>

        <!-- Candidate card -->
        <div class="control-card">
            <div class="control-card-icon">👤</div>
            <div class="control-card-title">Candidate Interface</div>
            <div class="control-card-desc">
                Share this link with the candidate. They join the room and are recorded automatically
                once the interviewer starts the session.
            </div>
            <div class="control-card-actions">
                <a class="btn-control primary" href="/candidate" target="_blank" id="btnCandidate">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Open Candidate
                </a>
                <button class="btn-control secondary" id="btnCopyCandidateLink">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy Link
                </button>
            </div>
        </div>
    </div>

    <!-- Status / candidate URL share panel -->
    <div class="link-banner" style="margin-bottom:20px" id="candidateSharePanel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-teal)" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <span style="color:var(--text-muted)">Candidate URL:</span>
        <code id="candidateUrl">${location.origin}/candidate</code>
        <button class="phi-btn" id="btnCopyUrl">Copy</button>
    </div>

    <!-- Session recordings list -->
    <div class="stat-card" style="overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;
            padding:16px 20px;border-bottom:1px solid var(--border-subtle)">
            <div class="stat-card-title">Session Recordings</div>
            <button class="btn-export" id="btnRefreshRecordings">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Refresh
            </button>
        </div>
        <div id="recordingsList" style="padding:12px 20px">
            <div style="color:var(--text-muted);font-size:12px">Loading…</div>
        </div>
    </div>

    <!-- Pipeline trigger (optional, shown after recording) -->
    <div class="stat-card" style="margin-top:16px;padding:20px;display:none" id="pipelineTriggerCard">
        <div class="stat-card-title" style="margin-bottom:8px">Run Backend Pipeline</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:14px;line-height:1.6">
            After a recording is complete, you can trigger the 6-stage TIPS backend pipeline to process the session.
            Requires <code>backend/</code> to be running.
        </div>
        <div style="display:flex;gap:8px">
            <input type="text" id="pipelineSessionInput" class="path-input" style="flex:1"
                placeholder="Session ID (e.g. 20250221_143000)" />
            <button class="btn-control primary" id="btnRunPipeline">
                ▶ Run Pipeline
            </button>
        </div>
        <div id="pipelineStatus" style="font-size:12px;color:var(--text-muted);margin-top:10px"></div>
    </div>`;
}

// ── WebSocket status display ───────────────────────────────────
function initWebSocket() {
    const dot = document.getElementById('wsDot');
    const label = document.getElementById('wsLabel');

    try {
        const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
        document.getElementById('wsUrl').textContent = wsUrl;

        // Don't actually connect in dashboard-only mode (no role)
        // Just check if the server is reachable by doing a quick status poll
        if (dot) { dot.className = 'ws-dot connecting'; }
        if (label) { label.textContent = 'Checking server…'; }

        fetch('/api/status')
            .then(r => r.json())
            .then(data => {
                if (dot) dot.className = 'ws-dot connected';
                if (label) label.textContent = 'Server reachable';
                updateRoomState(data.state || 'IDLE');
            })
            .catch(() => {
                if (dot) dot.className = 'ws-dot disconnected';
                if (label) label.textContent = 'Server not reachable (open directly via server.py)';
            });
    } catch {
        if (dot) dot.className = 'ws-dot disconnected';
        if (label) label.textContent = 'Could not connect';
    }
}

function updateRoomState(state) {
    roomState = state;
    const dot = document.getElementById('roomStatusDot');
    const lbl = document.getElementById('roomStatusLabel');
    const detail = document.getElementById('roomStatusDetail');
    const recInd = document.getElementById('recordingIndicator');

    if (dot) dot.className = `room-status-dot ${stateClass(state)}`;
    if (lbl) lbl.textContent = state;
    if (detail) detail.textContent = stateDetail(state);

    const isRecording = state === 'RECORDING';
    if (recInd) recInd.style.display = isRecording ? 'block' : 'none';

    // Update recording badge in sidebar nav
    const badge = document.getElementById('controlBadge');
    if (badge) badge.style.display = isRecording ? 'inline' : 'none';

    if (isRecording && !timerInterval) {
        timerSec = 0;
        timerInterval = setInterval(() => {
            timerSec++;
            const t = document.getElementById('recTimer');
            if (t) {
                const m = String(Math.floor(timerSec / 60)).padStart(2, '0');
                const s = String(timerSec % 60).padStart(2, '0');
                t.textContent = `${m}:${s}`;
            }
        }, 1000);
    } else if (!isRecording && timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function stateClass(state) {
    return {
        IDLE: 'idle',
        INTERVIEWER_CONNECTED: 'waiting',
        BOTH_CONNECTED: 'ready',
        RECORDING: 'recording',
    }[state] || 'idle';
}

function stateDetail(state) {
    return {
        IDLE: 'No active session. Open the Interviewer interface to start.',
        INTERVIEWER_CONNECTED: 'Interviewer connected. Waiting for candidate to join…',
        BOTH_CONNECTED: 'Both participants connected. Ready to record.',
        RECORDING: 'Recording in progress…',
    }[state] || '—';
}

// ── Recordings list ───────────────────────────────────────────
async function loadRecordingsList() {
    const container = document.getElementById('recordingsList');
    if (!container) return;

    try {
        const res = await fetch('/api/recordings');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const files = await res.json();

        if (!files.length) {
            container.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:8px 0">
                No recordings found in <code>web_ui/recordings/</code></div>`;
            return;
        }

        container.innerHTML = `<div class="recordings-list">
            ${files.map(f => {
            const isVideo = f.name.endsWith('.mp4');
            const isAudio = f.name.endsWith('.wav');
            const badge = isVideo ? '<span class="recording-type-badge video">video</span>'
                : isAudio ? '<span class="recording-type-badge audio">audio</span>'
                    : '';
            const size = f.size ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : '';
            return `<div class="recording-item">
                    ${badge}
                    <span class="recording-item-name" title="${f.name}">${f.name}</span>
                    <span class="recording-item-meta">${size}</span>
                </div>`;
        }).join('')}
        </div>`;

        // Show pipeline trigger card when recordings exist
        const pCard = document.getElementById('pipelineTriggerCard');
        if (pCard) pCard.style.display = 'block';

        // Pre-fill session ID from newest recording
        const newest = files[files.length - 1];
        if (newest) {
            const parts = newest.name.split('-');
            // date part is typically index 2: "1-interviewer-20250221_143000.wav"
            const sessionId = parts.slice(2).join('-').replace(/\.(wav|mp4)$/, '');
            const input = document.getElementById('pipelineSessionInput');
            if (input && sessionId) input.value = sessionId;
        }
    } catch (e) {
        container.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:8px 0">
            Recordings not available (${e.message}). Start server.py to enable.</div>`;
    }
}

// ── Button wiring ─────────────────────────────────────────────
function wireButtons() {
    // Copy interviewer link
    document.getElementById('btnCopyInterviewerLink')?.addEventListener('click', () => {
        copyToClipboard(`${location.origin}/interviewer`);
    });

    // Copy candidate link
    document.getElementById('btnCopyCandidateLink')?.addEventListener('click', () => {
        copyToClipboard(`${location.origin}/candidate`);
    });

    // Copy URL banner button
    document.getElementById('btnCopyUrl')?.addEventListener('click', () => {
        copyToClipboard(`${location.origin}/candidate`);
    });

    // Refresh recordings
    document.getElementById('btnRefreshRecordings')?.addEventListener('click', loadRecordingsList);

    // Pipeline trigger
    document.getElementById('btnRunPipeline')?.addEventListener('click', async () => {
        const sessionId = document.getElementById('pipelineSessionInput')?.value?.trim();
        const statusEl = document.getElementById('pipelineStatus');
        if (!sessionId) {
            if (statusEl) statusEl.textContent = '⚠ Enter a session ID first.';
            return;
        }
        if (statusEl) statusEl.textContent = '⏳ Running pipeline… This may take a while.';
        try {
            const res = await fetch('/api/pipeline/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            if (statusEl) statusEl.textContent = '✓ Pipeline triggered successfully!';
        } catch (e) {
            if (statusEl) statusEl.textContent = `Error: ${e.message} — check backend server.`;
        }
    });
}

function copyToClipboard(text) {
    navigator.clipboard?.writeText(text)
        .then(() => { console.log('[TIPS] Copied:', text); })
        .catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        });
}
