// ═══════════════════════════════════════════════════════════════
// TIPS Unified Frontend — dataLoader.js
// Extended from dashboard: adds API loading mode
// ═══════════════════════════════════════════════════════════════

export const sessionData = {
    timeline: null,
    qa_pairs: null,
    checkpoints: [],
    final_verdict: null,
    relevance_scores: null,
    behavior_metrics: null,
    speaking_segments: null,
    audio_summary: null,
    video_summary: null,
    interviewer: null,
    loaded: false,
    errors: {},
};

// ── Parse JSONL for candidate_score_timeline ──────────────────
function parseScoreJSONL(text) {
    const checkpoints = [];
    let final_verdict = null;
    for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
            const obj = JSON.parse(line);
            if (obj.checkpoint_entry) checkpoints.push(obj.checkpoint_entry);
            if (obj.final_verdict) final_verdict = obj.final_verdict;
        } catch { /* skip */ }
    }
    return { checkpoints, final_verdict };
}

// ── Parse JSONL for relevance_scores ─────────────────────────
function parseRelevanceJSONL(text) {
    const scores = [];
    for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try { scores.push(JSON.parse(line)); } catch { /* skip */ }
    }
    if (!scores.length) {
        try {
            const parsed = JSON.parse(text);
            return Array.isArray(parsed) ? parsed : (parsed.scores || []);
        } catch { }
    }
    return scores;
}

// ── Audio aggregation ─────────────────────────────────────────
function aggregateAudio(raw) {
    if (!raw) return null;
    const feat = raw.audio_features || raw.features || [];
    const vad = raw.vad_segments || [];
    const transc = raw.transcription_segments || raw.transcription || [];
    let spkTime = 0;
    vad.forEach(s => { if (s.type === 'speaking' || s.is_speaking) spkTime += (s.end - s.start); });
    const pitch = feat.map(f => f.pitch || f.f0 || 0).filter(v => v > 0);
    const rms = feat.map(f => f.rms || f.energy || 0);
    return {
        feature_frame_count: feat.length,
        vad_segment_count: vad.length,
        transcription_count: Array.isArray(transc) ? transc.length : 0,
        total_speaking_sec: spkTime,
        avg_pitch: pitch.length ? pitch.reduce((a, b) => a + b, 0) / pitch.length : 0,
        avg_rms: rms.length ? rms.reduce((a, b) => a + b, 0) / rms.length : 0,
    };
}

// ── Video aggregation ─────────────────────────────────────────
function aggregateVideo(raw) {
    if (!raw) return null;
    const frames = raw.frames || raw.sampled_frames || [];
    const faceN = frames.filter(f => f.face_detected || (f.face_confidence || 0) > 0.5).length;
    const gaze = frames.map(f => f.gaze_stability || f.eye_gaze_stability || 0).filter(v => v > 0);
    const head = frames.map(f => f.head_motion || f.head_movement || 0).filter(v => v >= 0);
    return {
        frame_count: frames.length,
        face_presence_pct: frames.length ? (faceN / frames.length) * 100 : 0,
        avg_gaze_stability: gaze.length ? gaze.reduce((a, b) => a + b, 0) / gaze.length : 0,
        avg_head_motion: head.length ? head.reduce((a, b) => a + b, 0) / head.length : 0,
    };
}

function _parseMode(key) {
    if (key === 'score_timeline') return 'jsonl_score';
    if (key === 'relevance_scores') return 'jsonl_rel';
    return 'json';
}

async function _fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
}

function _parseText(text, mode) {
    if (mode === 'jsonl_score') return parseScoreJSONL(text);
    if (mode === 'jsonl_rel') return parseRelevanceJSONL(text);
    return JSON.parse(text);
}

/** Load from FastAPI /api/output/all endpoint */
export async function loadFromAPI(apiBase) {
    const res = await fetch(`${apiBase}/all`);
    if (!res.ok) throw new Error(`API error: HTTP ${res.status}`);
    const allData = await res.json();
    // allData is { key: rawText/object } — handle each
    for (const [key, value] of Object.entries(allData)) {
        try {
            if (key === 'score_timeline') {
                const parsed = typeof value === 'string'
                    ? parseScoreJSONL(value)
                    : parseScoreJSONL(JSON.stringify(value));
                _store('score_timeline', parsed);
            } else if (key === 'relevance_scores') {
                const arr = Array.isArray(value) ? value : parseRelevanceJSONL(typeof value === 'string' ? value : JSON.stringify(value));
                _store('relevance_scores', arr);
            } else {
                _store(key, value);
            }
        } catch (e) {
            sessionData.errors[key] = e.message;
        }
    }
    sessionData.loaded = true;
}

/** Load all files from a URL base path */
export async function loadFromPath(basePath, fileMap, onProgress) {
    const base = basePath.endsWith('/') ? basePath : basePath + '/';
    const keys = Object.keys(fileMap);
    let done = 0;
    const results = await Promise.allSettled(keys.map(async (key) => {
        const text = await _fetchText(base + fileMap[key]);
        const data = _parseText(text, _parseMode(key));
        onProgress && onProgress(++done, keys.length);
        return { key, data };
    }));
    _applyResults(results, keys);
}

/** Load all files from File objects (file picker) */
export async function loadFromFiles(filesByKey, onProgress) {
    const keys = Object.keys(filesByKey);
    let done = 0;
    const results = await Promise.allSettled(keys.map(async (key) => {
        const text = await filesByKey[key].text();
        const data = _parseText(text, _parseMode(key));
        onProgress && onProgress(++done, keys.length);
        return { key, data };
    }));
    _applyResults(results, keys);
}

function _applyResults(results, keys) {
    results.forEach((res, i) => {
        const key = keys[i];
        if (res.status === 'fulfilled') {
            _store(key, res.value.data);
        } else {
            sessionData.errors[key] = res.reason?.message || 'Error';
            console.warn(`[TIPS] Failed: ${key}`, res.reason);
        }
    });
    sessionData.loaded = true;
}

function _store(key, data) {
    switch (key) {
        case 'timeline':
            sessionData.timeline = data;
            break;
        case 'qa_pairs':
            sessionData.qa_pairs = data;
            break;
        case 'score_timeline':
            sessionData.checkpoints = data.checkpoints;
            sessionData.final_verdict = data.final_verdict;
            break;
        case 'relevance_scores':
            sessionData.relevance_scores = Array.isArray(data) ? data : [];
            break;
        case 'behavior_metrics':
            sessionData.behavior_metrics = data;
            break;
        case 'speaking_segments':
            sessionData.speaking_segments = Array.isArray(data) ? data : (data.segments || []);
            break;
        case 'audio_raw':
            sessionData.audio_summary = aggregateAudio(data);
            break;
        case 'video_raw':
            sessionData.video_summary = aggregateVideo(data);
            break;
        case 'interviewer':
            sessionData.interviewer = data;
            break;
    }
}

// ── Utility helpers ───────────────────────────────────────────

export function fmtTime(sec) {
    if (sec == null || isNaN(sec)) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function scoreClass(v) {
    if (v >= 0.7) return 'high';
    if (v >= 0.4) return 'mid';
    return 'low';
}

export function scoreColor(v) {
    if (v >= 0.7) return '#3fb950';
    if (v >= 0.4) return '#d29922';
    return '#f85149';
}

export function verdictClass(v) {
    if (!v) return 'strong';
    const l = v.toLowerCase();
    if (l.includes('strong')) return 'strong';
    if (l.includes('weak') || l.includes('moderate') || l.includes('needs')) return 'weak';
    return 'poor';
}

export function totalSpeakingTime(segments) {
    if (!segments || !segments.length) return 0;
    return segments.reduce((acc, s) => {
        return acc + ((s.end_time ?? s.end ?? 0) - (s.start_time ?? s.start ?? 0));
    }, 0);
}

export function avgCompetency(checkpoints, key) {
    const vals = checkpoints.map(c => c.competency_scores?.[key] ?? 0).filter(v => !isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

/** Export current session data as downloadable JSON */
export function exportSessionJSON(subset) {
    const data = subset || {
        timeline: sessionData.timeline,
        qa_pairs: sessionData.qa_pairs,
        checkpoints: sessionData.checkpoints,
        final_verdict: sessionData.final_verdict,
        relevance_scores: sessionData.relevance_scores,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tips-session-${sessionData.timeline?.dataset_id || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
