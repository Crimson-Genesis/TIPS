// ═══════════════════════════════════════════════════════════════
// TIPS Unified Frontend — pages/pipelineExecution.js
// Page 4: Visualize the 6-stage processing pipeline
// ═══════════════════════════════════════════════════════════════
import { sessionData, fmtTime } from '../dataLoader.js';

const STAGES = [
    {
        id: 'ingest',
        icon: '📥',
        label: 'Stage 1: Ingest',
        desc: 'Load raw audio/video recordings and metadata',
        outputKeys: ['timeline'],
        detail: 'Reads interview recordings, extracts metadata (FPS, duration, sample rate), and initialises alignment grid.',
    },
    {
        id: 'transcribe',
        icon: '📝',
        label: 'Stage 2: Transcribe',
        desc: 'ASR transcription and VAD segmentation',
        outputKeys: ['interviewer'],
        detail: 'Runs WhisperX or similar ASR on interviewer and candidate audio to produce word-level transcripts.',
    },
    {
        id: 'align',
        icon: '🔗',
        label: 'Stage 3: Align',
        desc: 'Align speaking segments to timeline',
        outputKeys: ['speaking_segments'],
        detail: 'Merges VAD and ASR outputs into a unified speaking-segment map with speaker labels and timestamps.',
    },
    {
        id: 'qa_extract',
        icon: '💬',
        label: 'Stage 4: Q&A Extraction',
        desc: 'Extract question-answer pairs from transcript',
        outputKeys: ['qa_pairs'],
        detail: 'Identifies interviewer questions and pairs them with candidate answers based on speaker turns and silence gaps.',
    },
    {
        id: 'score',
        icon: '🧠',
        label: 'Stage 5: LLM Scoring',
        desc: 'LLM relevance scoring and keyword matching',
        outputKeys: ['score_timeline', 'relevance_scores'],
        detail: 'Sends each Q&A pair to an LLM (GPT-4, Gemini) for relevance scoring, keyword extraction, and competency assessment.',
    },
    {
        id: 'behavior',
        icon: '🎯',
        label: 'Stage 6: Behaviour Analysis',
        desc: 'Analyse audio/video for behavioural signals',
        outputKeys: ['behavior_metrics'],
        detail: 'Runs facial tracking, gaze estimation, head motion analysis, audio confidence and fluency scoring.',
    },
];

const FILE_LABELS = {
    timeline: 'timeline.json',
    qa_pairs: 'qa_pairs.json',
    score_timeline: 'candidate_score_timeline.json',
    relevance_scores: 'relevance_scores.json',
    behavior_metrics: 'candidate_behavior_metrics.json',
    speaking_segments: 'speaking_segments.json',
    audio_raw: 'candidate_audio_raw.json',
    video_raw: 'candidate_video_raw.json',
    interviewer: 'interviewer_transcript.json',
};

export function renderPipeline(el) {
    el.innerHTML = buildPipeline();
    setupFlowClick();
}

function isLoaded(key) {
    if (key === 'score_timeline') return (sessionData.checkpoints?.length > 0);
    if (key === 'relevance_scores') return (sessionData.relevance_scores?.length > 0);
    return !!sessionData[key];
}

function buildPipeline() {
    const tl = sessionData.timeline || {};
    const dur = tl.duration_seconds ?? tl.duration ?? 0;
    const fps = tl.fps ?? '—';
    const nQ = sessionData.qa_pairs?.qa_pairs?.length || sessionData.checkpoints?.length || 0;
    const nSegs = (sessionData.speaking_segments || []).length;

    return `
    <div class="section-header" style="margin-bottom:24px">
        <div class="section-title">Pipeline Execution</div>
        <div class="section-sub">6-stage TIPS backend processing pipeline</div>
    </div>

    <!-- Summary stats -->
    ${sessionData.loaded ? `
    <div class="grid-4" style="margin-bottom:24px">
        ${pStat('Duration', fmtTime(dur))}
        ${pStat('FPS', fps)}
        ${pStat('Q&A pairs', nQ)}
        ${pStat('Speaking segs', nSegs)}
    </div>` : ''}

    <!-- Flow diagram -->
    <div class="stat-card" style="padding:24px;margin-bottom:24px;overflow-x:auto">
        <div class="stat-card-title" style="margin-bottom:20px">Data Flow</div>
        <div style="display:flex;align-items:center;gap:0;flex-wrap:nowrap;min-width:600px">
            ${STAGES.map((stage, i) => {
        const loaded = stage.outputKeys.every(k => isLoaded(k));
        return `
                <div class="pipeline-node ${loaded ? 'complete' : sessionData.loaded ? 'incomplete' : 'idle'}"
                    data-stage="${stage.id}" style="cursor:pointer">
                    <div class="pn-icon">${stage.icon}</div>
                    <div class="pn-label">${stage.label}</div>
                    <div class="pn-status">${loaded ? '✓ Done' : sessionData.loaded ? '↻ Pending' : '—'}</div>
                </div>
                ${i < STAGES.length - 1 ? `<div class="pipeline-arrow ${loaded ? 'active' : ''}" style="flex-shrink:0">→</div>` : ''}`;
    }).join('')}
        </div>
    </div>

    <!-- Stage details -->
    <div class="grid-2" style="margin-bottom:24px">
        ${STAGES.map(stage => {
        const loaded = stage.outputKeys.every(k => isLoaded(k));
        const anyLoaded = stage.outputKeys.some(k => isLoaded(k));
        const statusColor = loaded ? 'var(--accent-green)' : anyLoaded ? 'var(--accent-orange)' : 'var(--text-muted)';
        const badge = loaded ? 'complete' : sessionData.loaded ? 'incomplete' : 'idle';
        return `<div class="stat-card" style="padding:16px" data-detail="${stage.id}">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                    <span style="font-size:18px">${stage.icon}</span>
                    <div>
                        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${stage.label}</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${stage.desc}</div>
                    </div>
                    <span style="margin-left:auto;font-size:11px;font-weight:600;color:${statusColor}">
                        ${loaded ? '✓ Complete' : sessionData.loaded ? '↻ Pending' : '—'}
                    </span>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);line-height:1.6;margin-bottom:10px">${stage.detail}</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px">
                    ${stage.outputKeys.map(k => {
            const ok = isLoaded(k);
            return `<span style="font-size:10px;padding:2px 8px;border-radius:4px;
                            font-family:var(--font-mono);background:${ok ? 'rgba(63,185,80,0.1)' : 'rgba(72,79,88,0.2)'};
                            color:${ok ? 'var(--accent-green)' : 'var(--text-muted)'}">
                            ${ok ? '✓' : ''} ${FILE_LABELS[k] || k}</span>`;
        }).join('')}
                </div>
            </div>`;
    }).join('')}
    </div>

    <!-- Output file inventory -->
    <div class="stat-card" style="overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border-subtle)">
            <div class="stat-card-title">Output File Inventory</div>
        </div>
        <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:12px">
                <thead>
                    <tr style="border-bottom:1px solid var(--border)">
                        <th style="padding:10px 16px;text-align:left;color:var(--text-muted);font-weight:600">File</th>
                        <th style="padding:10px 16px;text-align:left;color:var(--text-muted);font-weight:600">Stage</th>
                        <th style="padding:10px 16px;text-align:center;color:var(--text-muted);font-weight:600">Status</th>
                        <th style="padding:10px 16px;text-align:left;color:var(--text-muted);font-weight:600">Info</th>
                    </tr>
                </thead>
                <tbody>
                    ${buildInventory()}
                </tbody>
            </table>
        </div>
    </div>`;
}

function pStat(label, value) {
    return `<div class="stat-card" style="text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--text-primary)">${value}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${label}</div>
    </div>`;
}

function buildInventory() {
    const stageMap = {};
    STAGES.forEach(s => s.outputKeys.forEach(k => stageMap[k] = s.label));

    return Object.entries(FILE_LABELS).map(([key, fname]) => {
        const loaded = isLoaded(key);
        const stageName = stageMap[key] || '—';
        const info = getFileInfo(key);
        return `<tr style="border-bottom:1px solid var(--border-subtle)">
            <td style="padding:10px 16px;font-family:var(--font-mono);color:var(--accent-teal)">${fname}</td>
            <td style="padding:10px 16px;color:var(--text-muted);font-size:11px">${stageName}</td>
            <td style="padding:10px 16px;text-align:center">
                <span style="font-size:11px;font-weight:600;color:${loaded ? 'var(--accent-green)' : 'var(--text-muted)'}">
                    ${loaded ? '✓ Loaded' : '— Not loaded'}
                </span>
            </td>
            <td style="padding:10px 16px;color:var(--text-secondary);font-size:11px">${info}</td>
        </tr>`;
    }).join('');
}

function getFileInfo(key) {
    switch (key) {
        case 'timeline': {
            const t = sessionData.timeline;
            return t ? `${t.fps || '?'} fps · ${fmtTime(t.duration_seconds ?? t.duration ?? 0)}` : '—';
        }
        case 'qa_pairs': return `${sessionData.qa_pairs?.qa_pairs?.length ?? 0} Q&A pairs`;
        case 'score_timeline': return `${sessionData.checkpoints?.length ?? 0} checkpoints`;
        case 'relevance_scores': return `${sessionData.relevance_scores?.length ?? 0} entries`;
        case 'behavior_metrics': {
            const bm = sessionData.behavior_metrics;
            const segs = bm?.all_segments || bm?.segments || [];
            return bm ? `${segs.length} behavior segments` : '—';
        }
        case 'speaking_segments': return `${sessionData.speaking_segments?.length ?? 0} segments`;
        case 'audio_raw': return sessionData.audio_summary ? `${sessionData.audio_summary.feature_frame_count} frames` : '—';
        case 'video_raw': return sessionData.video_summary ? `${sessionData.video_summary.frame_count} frames` : '—';
        case 'interviewer': return sessionData.interviewer ? 'Loaded' : '—';
        default: return '—';
    }
}

function setupFlowClick() {
    document.querySelectorAll('.pipeline-node[data-stage]').forEach(node => {
        node.addEventListener('click', () => {
            const stageId = node.dataset.stage;
            const detail = document.querySelector(`[data-detail="${stageId}"]`);
            if (detail) {
                detail.style.border = '1px solid var(--accent-blue)';
                detail.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => { detail.style.border = '1px solid var(--border)'; }, 1800);
            }
        });
    });
}
