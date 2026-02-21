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
    setupFileSelection();
    setupPipelineExecution();
}

function isLoaded(key) {
    if (key === 'score_timeline') return (sessionData.checkpoints?.length > 0);
    if (key === 'relevance_scores') return (sessionData.relevance_scores?.length > 0);
    return !!sessionData[key];
}

function buildPipeline() {
    const tl = sessionData.timeline || {};
    // Get duration and FPS from the nested video structure (matching hub.js)
    const dur = tl.video?.duration_sec ?? tl.audio?.candidate?.duration_sec ?? tl.duration_seconds ?? tl.duration ?? 0;
    const fps = tl.video?.fps ?? tl.fps ?? '—';
    const nQ = sessionData.qa_pairs?.qa_pairs?.length || sessionData.checkpoints?.length || 0;
    const nSegs = (sessionData.speaking_segments || []).length;

    return `
    <div class="section-header" style="margin-bottom:24px">
        <div class="section-title">Pipeline Execution</div>
        <div class="section-sub">6-stage TIPS backend processing pipeline</div>
    </div>

    <!-- File Processing Section -->
    <div class="stat-card" style="padding:20px;margin-bottom:24px">
        <div class="stat-card-title" style="margin-bottom:16px">Process Interview Recording</div>
        <div class="section-sub" style="margin-bottom:16px;color:var(--text-muted)">
            Select interviewer audio and candidate video files to execute the full pipeline
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
            <!-- Interviewer Audio -->
            <div style="display:flex;flex-direction:column;gap:8px">
                <label style="font-size:12px;font-weight:600;color:var(--text-secondary)">
                    🎙️ Interviewer Audio (.wav)
                </label>
                <div style="position:relative">
                    <input type="file" id="interviewerAudioInput" accept=".wav,.mp3" 
                        style="display:none" />
                    <button id="selectInterviewerBtn" 
                        style="width:100%;padding:10px 16px;background:var(--bg-elevated);
                            border:2px dashed var(--border);border-radius:8px;color:var(--text-secondary);
                            font-size:13px;cursor:pointer;transition:all 0.2s;font-family:inherit">
                        <span id="interviewerFileName">Click to select file...</span>
                    </button>
                </div>
            </div>

            <!-- Candidate Video -->
            <div style="display:flex;flex-direction:column;gap:8px">
                <label style="font-size:12px;font-weight:600;color:var(--text-secondary)">
                    🎥 Candidate Video (.mp4)
                </label>
                <div style="position:relative">
                    <input type="file" id="candidateVideoInput" accept=".mp4,.webm,.avi" 
                        style="display:none" />
                    <button id="selectCandidateBtn" 
                        style="width:100%;padding:10px 16px;background:var(--bg-elevated);
                            border:2px dashed var(--border);border-radius:8px;color:var(--text-secondary);
                            font-size:13px;cursor:pointer;transition:all 0.2s;font-family:inherit">
                        <span id="candidateFileName">Click to select file...</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Candidate Audio (Optional) -->
        <div style="margin-bottom:16px">
            <label style="font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:8px">
                🎤 Candidate Audio (.wav) <span style="color:var(--text-muted);font-weight:400">(Optional - extracted from video if not provided)</span>
            </label>
            <input type="file" id="candidateAudioInput" accept=".wav,.mp3" 
                style="display:none" />
            <button id="selectCandidateAudioBtn" 
                style="width:100%;padding:10px 16px;background:var(--bg-elevated);
                    border:2px dashed var(--border);border-radius:8px;color:var(--text-secondary);
                    font-size:13px;cursor:pointer;transition:all 0.2s;font-family:inherit">
                <span id="candidateAudioFileName">Click to select file (optional)...</span>
            </button>
        </div>

        <!-- Job Description -->
        <div style="margin-bottom:16px">
            <label style="font-size:12px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:8px">
                📋 Job Description (.md) <span style="color:var(--text-muted);font-weight:400">(Required for LLM scoring)</span>
            </label>
            <input type="file" id="jdInput" accept=".md,.txt" 
                style="display:none" />
            <button id="selectJdBtn" 
                style="width:100%;padding:10px 16px;background:var(--bg-elevated);
                    border:2px dashed var(--border);border-radius:8px;color:var(--text-secondary);
                    font-size:13px;cursor:pointer;transition:all 0.2s;font-family:inherit">
                <span id="jdFileName">Click to select file...</span>
            </button>
        </div>

        <!-- Execute Button -->
        <div style="display:flex;gap:12px;align-items:center">
            <button id="executePipelineBtn" disabled
                style="flex:1;padding:12px 24px;background:var(--accent-blue);border:none;
                    border-radius:8px;color:white;font-size:14px;font-weight:600;
                    cursor:pointer;transition:all 0.2s;font-family:inherit;
                    display:flex;align-items:center;justify-content:center;gap:8px">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Execute Pipeline
            </button>
            <div id="pipelineStatus" style="font-size:12px;color:var(--text-muted);
                font-family:var(--font-mono)"></div>
        </div>

        <!-- Progress indicator -->
        <div id="progressContainer" style="display:none;margin-top:16px">
            <div style="width:100%;height:4px;background:var(--bg-primary);border-radius:2px;overflow:hidden">
                <div id="progressBar" style="width:0%;height:100%;background:var(--accent-blue);
                    transition:width 0.3s"></div>
            </div>
            <div id="progressText" style="margin-top:8px;font-size:12px;color:var(--text-muted);
                font-family:var(--font-mono)"></div>
        </div>
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
            const fps = t?.video?.fps ?? t?.fps ?? '?';
            const dur = t?.video?.duration_sec ?? t?.audio?.candidate?.duration_sec ?? t?.duration_seconds ?? t?.duration ?? 0;
            return t ? `${fps} fps · ${fmtTime(dur)}` : '—';
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

let selectedFiles = {
    interviewerAudio: null,
    candidateVideo: null,
    candidateAudio: null,
    jd: null
};

function setupFileSelection() {
    // Interviewer Audio
    const interviewerInput = document.getElementById('interviewerAudioInput');
    const interviewerBtn = document.getElementById('selectInterviewerBtn');
    const interviewerFileName = document.getElementById('interviewerFileName');

    interviewerBtn?.addEventListener('click', () => interviewerInput?.click());
    interviewerInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFiles.interviewerAudio = file;
            interviewerFileName.textContent = `✓ ${file.name}`;
            interviewerBtn.style.borderColor = 'var(--accent-green)';
            interviewerBtn.style.color = 'var(--accent-green)';
            checkFilesReady();
        }
    });

    // Candidate Video
    const candidateInput = document.getElementById('candidateVideoInput');
    const candidateBtn = document.getElementById('selectCandidateBtn');
    const candidateFileName = document.getElementById('candidateFileName');

    candidateBtn?.addEventListener('click', () => candidateInput?.click());
    candidateInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFiles.candidateVideo = file;
            candidateFileName.textContent = `✓ ${file.name}`;
            candidateBtn.style.borderColor = 'var(--accent-green)';
            candidateBtn.style.color = 'var(--accent-green)';
            checkFilesReady();
        }
    });

    // Candidate Audio (Optional)
    const candidateAudioInput = document.getElementById('candidateAudioInput');
    const candidateAudioBtn = document.getElementById('selectCandidateAudioBtn');
    const candidateAudioFileName = document.getElementById('candidateAudioFileName');

    candidateAudioBtn?.addEventListener('click', () => candidateAudioInput?.click());
    candidateAudioInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFiles.candidateAudio = file;
            candidateAudioFileName.textContent = `✓ ${file.name}`;
            candidateAudioBtn.style.borderColor = 'var(--accent-green)';
            candidateAudioBtn.style.color = 'var(--accent-green)';
        }
    });

    // Job Description
    const jdInput = document.getElementById('jdInput');
    const jdBtn = document.getElementById('selectJdBtn');
    const jdFileName = document.getElementById('jdFileName');

    jdBtn?.addEventListener('click', () => jdInput?.click());
    jdInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFiles.jd = file;
            jdFileName.textContent = `✓ ${file.name}`;
            jdBtn.style.borderColor = 'var(--accent-green)';
            jdBtn.style.color = 'var(--accent-green)';
            checkFilesReady();
        }
    });
}

function checkFilesReady() {
    const executeBtn = document.getElementById('executePipelineBtn');
    if (selectedFiles.interviewerAudio && selectedFiles.candidateVideo && selectedFiles.jd) {
        executeBtn.disabled = false;
        executeBtn.style.opacity = '1';
        executeBtn.style.cursor = 'pointer';
    } else {
        executeBtn.disabled = true;
        executeBtn.style.opacity = '0.5';
        executeBtn.style.cursor = 'not-allowed';
    }
}

function setupPipelineExecution() {
    const executeBtn = document.getElementById('executePipelineBtn');
    const statusDiv = document.getElementById('pipelineStatus');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    executeBtn?.addEventListener('click', async () => {
        if (executeBtn.disabled) return;

        // Disable button during execution
        executeBtn.disabled = true;
        executeBtn.style.opacity = '0.5';
        statusDiv.textContent = 'Uploading files...';
        progressContainer.style.display = 'block';
        updateProgress(0, 'Preparing files...');

        try {
            // Create FormData
            const formData = new FormData();
            formData.append('interviewer_audio', selectedFiles.interviewerAudio);
            formData.append('candidate_video', selectedFiles.candidateVideo);
            formData.append('jd', selectedFiles.jd);
            if (selectedFiles.candidateAudio) {
                formData.append('candidate_audio', selectedFiles.candidateAudio);
            }

            updateProgress(10, 'Uploading files...');

            // Upload files and trigger pipeline
            const response = await fetch('/api/pipeline/execute', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }

            updateProgress(20, 'Files uploaded. Starting pipeline...');
            
            // Poll for pipeline status
            await pollPipelineStatus(result.session_id);

        } catch (error) {
            console.error('Pipeline execution error:', error);
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.style.color = 'var(--accent-red)';
            progressContainer.style.display = 'none';
            executeBtn.disabled = false;
            executeBtn.style.opacity = '1';
        }
    });
}

function updateProgress(percent, message) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressText) progressText.textContent = message;
}

async function pollPipelineStatus(sessionId) {
    const statusDiv = document.getElementById('pipelineStatus');
    const executeBtn = document.getElementById('executePipelineBtn');
    const progressContainer = document.getElementById('progressContainer');

    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max (5 sec intervals)

    const poll = async () => {
        try {
            const response = await fetch(`/api/pipeline/status/${sessionId}`);
            const status = await response.json();

            if (status.stage) {
                // Update progress bar and message
                const stageProgress = {
                    'Stage 1': 30,
                    'Stage 2': 45,
                    'Stage 3': 60,
                    'Stage 4': 75,
                    'Stage 5': 90,
                    'Stage 6': 95
                };
                const progress = stageProgress[status.stage] || 20;
                updateProgress(progress, `${status.stage}: ${status.message || 'Processing...'}`);

                // Get completed stages from backend
                const completedStages = new Set(status.completed_stages || []);
                
                // Update visual stage indicators
                updateStageVisuals(status.stage, status.status, completedStages);
            }

            if (status.status === 'completed') {
                // Mark all stages as complete
                markAllStagesComplete();
                updateProgress(100, 'Pipeline completed successfully!');
                statusDiv.textContent = '✓ Complete';
                statusDiv.style.color = 'var(--accent-green)';
                
                // Reload data after a short delay
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
                return;
            }

            if (status.status === 'failed') {
                throw new Error(status.error || 'Pipeline execution failed');
            }

            if (attempts++ < maxAttempts) {
                setTimeout(poll, 2000); // Poll every 2 seconds for real-time updates
            } else {
                throw new Error('Pipeline timeout - check server logs');
            }

        } catch (error) {
            console.error('Status poll error:', error);
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.style.color = 'var(--accent-red)';
            progressContainer.style.display = 'none';
            executeBtn.disabled = false;
            executeBtn.style.opacity = '1';
        }
    };

    poll();
}

function updateStageVisuals(currentStage, pipelineStatus, completedStages) {
    // Map stage names to IDs
    const stageMap = {
        'Stage 1': 'ingest',
        'Stage 2': 'transcribe',
        'Stage 3': 'align',
        'Stage 4': 'qa_extract',
        'Stage 5': 'score',
        'Stage 6': 'behavior'
    };

    const stageOrder = ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5', 'Stage 6'];
    const currentStageIndex = stageOrder.indexOf(currentStage);

    // Process all stages
    for (let i = 0; i < stageOrder.length; i++) {
        const stageName = stageOrder[i];
        const stageId = stageMap[stageName];
        
        // Check if this stage is marked as completed by the backend
        const isCompleted = completedStages.has(stageName);
        const isCurrent = i === currentStageIndex;
        
        // Update pipeline node
        const node = document.querySelector(`[data-stage="${stageId}"]`);
        if (node) {
            node.classList.remove('incomplete', 'running', 'idle', 'complete');
            
            if (isCompleted) {
                node.classList.add('complete');
                const statusEl = node.querySelector('.pn-status');
                if (statusEl) statusEl.textContent = '✓ Done';
            } else if (isCurrent) {
                node.classList.add('running');
                const statusEl = node.querySelector('.pn-status');
                if (statusEl) statusEl.textContent = '⟳ Running';
            } else {
                node.classList.add('idle');
            }
        }

        // Update arrow - activate if previous stage is complete
        const arrows = document.querySelectorAll('.pipeline-arrow');
        if (arrows[i] && i > 0) {
            const prevStageName = stageOrder[i - 1];
            if (completedStages.has(prevStageName)) {
                arrows[i].classList.add('active');
            }
        }

        // Update detail card
        if (isCompleted) {
            updateDetailCard(stageId, 'complete');
        } else if (isCurrent) {
            updateDetailCard(stageId, 'running');
        }
    }
}

function updateDetailCard(stageId, status) {
    const card = document.querySelector(`[data-detail="${stageId}"]`);
    if (!card) return;

    const statusEl = card.querySelector('span[style*="margin-left:auto"]');
    if (!statusEl) return;

    if (status === 'complete') {
        statusEl.textContent = '✓ Complete';
        statusEl.style.color = 'var(--accent-green)';
        card.style.borderLeft = '3px solid var(--accent-green)';
    } else if (status === 'running') {
        statusEl.textContent = '⟳ Running';
        statusEl.style.color = 'var(--accent-blue)';
        card.style.borderLeft = '3px solid var(--accent-blue)';
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function markAllStagesComplete() {
    const stages = ['ingest', 'transcribe', 'align', 'qa_extract', 'score', 'behavior'];
    
    stages.forEach(stageId => {
        // Update pipeline node
        const node = document.querySelector(`[data-stage="${stageId}"]`);
        if (node) {
            node.classList.remove('incomplete', 'running', 'idle');
            node.classList.add('complete');
            const statusEl = node.querySelector('.pn-status');
            if (statusEl) statusEl.textContent = '✓ Done';
        }

        // Update detail card
        updateDetailCard(stageId, 'complete');
    });

    // Activate all arrows
    document.querySelectorAll('.pipeline-arrow').forEach(arrow => {
        arrow.classList.add('active');
    });
}

