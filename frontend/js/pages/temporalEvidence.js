// ═══════════════════════════════════════════════════════════════
// TIPS Unified Frontend — pages/temporalEvidence.js
// Page 2: Timeline, speaking segments, Q&A timing, score overlay
// ═══════════════════════════════════════════════════════════════
import { sessionData, fmtTime, scoreColor } from '../dataLoader.js';

let chartInstances = {};
let playheadSec = 0;
let wavesurferCandidate = null;
let wavesurferInterviewer = null;
let videoElement = null;
let currentRegions = [];
let currentZoom = 50;
let keydownHandler = null;
let spacebarHandler = null;

export function renderTemporal(el) {
    // Clean up previous instance before rendering new one
    cleanupTemporal();
    
    if (!sessionData.loaded) {
        el.innerHTML = `<div class="empty-state"><div class="es-icon">⏱</div>
            <div class="es-title">No session loaded</div>
            <div class="es-sub">Load a session to view temporal evidence.</div></div>`;
        return;
    }
    el.innerHTML = buildTemporal();
    setupVideoWaveform();
    setupEvidencePanels();
    setupTranscriptPanel();
}

function buildTemporal() {
    const dur = sessionData.timeline?.duration_seconds ?? sessionData.timeline?.duration ?? 0;
    const segs = sessionData.speaking_segments || [];
    const qaPairs = sessionData.qa_pairs?.qa_pairs || [];
    const checkpoints = sessionData.checkpoints || [];
    
    // Get video/audio file paths
    const datasetId = sessionData.timeline?.dataset_id || '2';
    const videoPath = `/backend/backend/trans/${datasetId}_candidate_video.mp4`;
    const audioPath = `/backend/backend/trans/${datasetId}_candidate_audio.wav`;

    return `
    <div class="section-header" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
            <div class="section-title">Temporal Evidence</div>
            <div class="section-sub">Interactive video timeline with synchronized dual-track audio waveforms</div>
        </div>
    </div>

    <!-- Video + Waveform Section -->
    <div class="stat-card" style="padding:0;margin-bottom:20px;overflow:hidden">
        <!-- Video Player -->
        <div style="position:relative;background:#000;aspect-ratio:16/9">
            <video id="interactiveVideo" 
                src="${videoPath}" 
                style="width:100%;height:100%;object-fit:contain"
                controls
                preload="metadata">
                Your browser does not support the video tag.
            </video>
            
            <!-- Question/Answer Display Overlay -->
            <div id="questionOverlay" style="position:absolute;bottom:60px;left:20px;right:20px;
                background:rgba(0,0,0,0.90);border-left:4px solid rgba(188, 140, 255, 1);
                padding:14px 18px;border-radius:8px;display:none;backdrop-filter:blur(10px);
                box-shadow:0 8px 32px rgba(0,0,0,0.5)">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
                    <div id="overlayHeader" style="font-size:11px;color:rgba(188, 140, 255, 1);font-weight:700;
                        text-transform:uppercase;letter-spacing:0.06em">Question & Answer</div>
                    <button id="closeOverlay" style="background:transparent;border:none;color:rgba(255,255,255,0.5);
                        font-size:16px;cursor:pointer;padding:0;width:20px;height:20px;line-height:1;
                        transition:color 0.2s" title="Close (ESC)">×</button>
                </div>
                <div id="questionText" style="font-size:14px;color:#fff;line-height:1.6;margin-bottom:0"></div>
                <div id="answerContainer" style="display:block;margin-top:12px;padding-top:12px;border-top:1px solid rgba(188, 140, 255, 0.3)">
                    <div style="font-size:10px;color:rgba(63, 185, 80, 1);font-weight:600;
                        text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">💬 Candidate's Answer</div>
                    <div id="answerText" style="font-size:14px;color:#e6e6e6;line-height:1.6"></div>
                </div>
            </div>
        </div>

        <!-- Dual-Track Waveform Container -->
        <div style="padding:20px;background:var(--bg-elevated)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <div class="stat-card-title">Synchronized Audio Timeline</div>
                <div style="display:flex;gap:8px;align-items:center">
                    <button id="zoomOutBtn" title="Zoom Out" style="padding:6px 10px;background:var(--bg-secondary);
                        border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;
                        cursor:pointer;font-family:inherit;font-weight:500;transition:all 0.2s">
                        ➖
                    </button>
                    <input type="range" id="zoomSlider" min="10" max="200" value="50" 
                        style="width:120px;cursor:pointer" title="Zoom Level">
                    <button id="zoomInBtn" title="Zoom In" style="padding:6px 10px;background:var(--bg-secondary);
                        border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:12px;
                        cursor:pointer;font-family:inherit;font-weight:500;transition:all 0.2s">
                        ➕
                    </button>
                    <div style="width:1px;height:20px;background:var(--border);margin:0 4px"></div>
                    <button id="playPauseBtn" style="padding:6px 12px;background:var(--accent-blue);
                        border:none;border-radius:6px;color:#fff;font-size:12px;cursor:pointer;
                        font-family:inherit;font-weight:500">
                        ▶ Play
                    </button>
                    <span id="currentTime" style="font-size:12px;color:var(--text-muted);
                        font-family:var(--font-mono);min-width:90px">00:00 / ${fmtTime(dur)}</span>
                </div>
            </div>
            
            <!-- Interviewer Waveform -->
            <div style="margin-bottom:8px">
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;font-family:var(--font-mono);
                    text-transform:uppercase;letter-spacing:0.05em;display:flex;align-items:center;gap:6px">
                    <span style="width:8px;height:8px;border-radius:50%;background:#8b949e"></span>
                    Interviewer Audio
                </div>
                <div id="waveformInterviewer" style="position:relative;min-height:80px;
                    background:var(--bg-primary);border-radius:8px;overflow:hidden"></div>
            </div>
            
            <!-- Candidate Waveform -->
            <div style="margin-bottom:12px">
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;font-family:var(--font-mono);
                    text-transform:uppercase;letter-spacing:0.05em;display:flex;align-items:center;gap:6px">
                    <span style="width:8px;height:8px;border-radius:50%;background:#388bfd"></span>
                    Candidate Audio
                </div>
                <div id="waveformCandidate" style="position:relative;min-height:80px;
                    background:var(--bg-primary);border-radius:8px;overflow:hidden"></div>
            </div>
            
            <!-- Segment Legend -->
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;font-size:11px;color:var(--text-muted)">
                ${legendDot('rgba(139, 148, 158, 0.4)', 'Interviewer Audio')}
                ${legendDot('rgba(56, 139, 253, 0.4)', 'Candidate Audio')}
                ${legendDot('rgba(188, 140, 255, 0.5)', 'Q&A Segment (unified)')}
                <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">
                    💡 Click any Q&A segment to view question & answer | Use zoom controls for detailed view
                </span>
            </div>
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

async function setupVideoWaveform() {
    const datasetId = sessionData.timeline?.dataset_id || '2';
    const candidateAudioPath = `/backend/backend/trans/${datasetId}_candidate_audio.wav`;
    const interviewerAudioPath = `/backend/backend/trans/${datasetId}_interviewer_audio.wav`;
    const qaPairs = sessionData.qa_pairs?.qa_pairs || [];
    const dur = sessionData.timeline?.video?.duration_sec ?? 
                 sessionData.timeline?.duration_seconds ?? 
                 sessionData.timeline?.duration ?? 385;
    
    videoElement = document.getElementById('interactiveVideo');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const currentTimeDisplay = document.getElementById('currentTime');
    const questionOverlay = document.getElementById('questionOverlay');
    const questionText = document.getElementById('questionText');
    const closeOverlayBtn = document.getElementById('closeOverlay');
    const zoomSlider = document.getElementById('zoomSlider');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    
    if (!videoElement || !window.WaveSurfer) {
        console.warn('Video element or WaveSurfer not available');
        return;
    }

    // Close overlay button handler
    if (closeOverlayBtn && questionOverlay) {
        closeOverlayBtn.addEventListener('click', () => {
            questionOverlay.style.display = 'none';
        });
        
        // Hover effect for close button
        closeOverlayBtn.addEventListener('mouseenter', () => {
            closeOverlayBtn.style.color = '#fff';
        });
        closeOverlayBtn.addEventListener('mouseleave', () => {
            closeOverlayBtn.style.color = 'rgba(255,255,255,0.5)';
        });
    }

    // ESC key to close overlay
    keydownHandler = (e) => {
        if (e.key === 'Escape' && questionOverlay && questionOverlay.style.display === 'block') {
            questionOverlay.style.display = 'none';
        }
    };
    document.addEventListener('keydown', keydownHandler);
    
    // Spacebar to play/pause (prevent default scroll behavior)
    spacebarHandler = (e) => {
        // Only handle spacebar if not typing in an input field
        if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            if (videoElement) {
                if (videoElement.paused) {
                    videoElement.play();
                    if (wavesurferCandidate) wavesurferCandidate.play();
                    if (wavesurferInterviewer) wavesurferInterviewer.play();
                    if (playPauseBtn) playPauseBtn.textContent = '⏸ Pause';
                } else {
                    videoElement.pause();
                    if (wavesurferCandidate) wavesurferCandidate.pause();
                    if (wavesurferInterviewer) wavesurferInterviewer.pause();
                    if (playPauseBtn) playPauseBtn.textContent = '▶ Play';
                }
            }
        }
    };
    document.addEventListener('keydown', spacebarHandler);
    
    // Pause audio/video when tab is hidden or browser is minimized
    const visibilityHandler = () => {
        if (document.hidden && videoElement && !videoElement.paused) {
            videoElement.pause();
            if (wavesurferCandidate) wavesurferCandidate.pause();
            if (wavesurferInterviewer) wavesurferInterviewer.pause();
            if (playPauseBtn) playPauseBtn.textContent = '▶ Play';
        }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    
    // Store visibility handler for cleanup
    if (!window.temporalCleanupHandlers) {
        window.temporalCleanupHandlers = [];
    }
    window.temporalCleanupHandlers.push({ type: 'visibilitychange', handler: visibilityHandler });
    
    // Cleanup on page unload/refresh
    const beforeUnloadHandler = () => {
        if (videoElement) {
            videoElement.pause();
            if (wavesurferCandidate) wavesurferCandidate.pause();
            if (wavesurferInterviewer) wavesurferInterviewer.pause();
        }
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);
    window.temporalCleanupHandlers.push({ type: 'beforeunload', handler: beforeUnloadHandler, target: 'window' });

    // Initialize WaveSurfer for CANDIDATE
    try {
        wavesurferCandidate = WaveSurfer.create({
            container: '#waveformCandidate',
            waveColor: 'rgba(56, 139, 253, 0.4)',
            progressColor: 'rgba(56, 139, 253, 0.9)',
            cursorColor: '#388bfd',
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            height: 80,
            normalize: true,
            backend: 'WebAudio',
            mediaControls: false,
            interact: true,
            hideScrollbar: true,
            autoCenter: true,
            minPxPerSec: currentZoom
        });

        // Load candidate audio
        await wavesurferCandidate.load(candidateAudioPath);

        // Initialize regions plugin for candidate waveform
        const RegionsPlugin = window.WaveSurfer.Regions || window.RegionsPlugin;
        if (RegionsPlugin) {
            const candidateRegions = wavesurferCandidate.registerPlugin(RegionsPlugin.create());
            currentRegions = [];

            // Create UNIFIED regions for each Q&A pair (question start to answer end)
            qaPairs.forEach((pair, index) => {
                const qStart = pair.question_start_time ?? 0;
                const aEnd = pair.answer?.end_time ?? pair.question_end_time ?? qStart + 5;

                // Unified Q&A region (purple/violet) - covers entire question-answer interaction
                const unifiedRegion = candidateRegions.addRegion({
                    start: qStart,
                    end: aEnd,
                    color: 'rgba(188, 140, 255, 0.35)',
                    drag: false,
                    resize: false,
                    id: `qa-${pair.question_id}`,
                    content: `Q${index + 1}`
                });

                currentRegions.push({ region: unifiedRegion, data: pair, index: index });
            });

            // Region click handler - jump video to exact timestamp and show Q&A
            candidateRegions.on('region-clicked', (region, e) => {
                e.stopPropagation();
                
                // Find the Q&A pair for this unified region
                const regionData = currentRegions.find(r => r.region.id === region.id);
                
                if (regionData) {
                    const pair = regionData.data;
                    const qIndex = regionData.index + 1;
                    const overlayHeader = document.getElementById('overlayHeader');
                    const answerContainer = document.getElementById('answerContainer');
                    const answerText = document.getElementById('answerText');
                    
                    // Jump to question start time (beginning of Q&A interaction)
                    const targetTime = pair.question_start_time ?? 0;
                    videoElement.currentTime = targetTime;
                    wavesurferCandidate.seekTo(targetTime / dur);
                    if (wavesurferInterviewer) {
                        wavesurferInterviewer.seekTo(targetTime / dur);
                    }
                    
                    // Show both question and answer in the overlay
                    overlayHeader.textContent = `Q${qIndex}: Question & Answer`;
                    overlayHeader.style.color = 'rgba(188, 140, 255, 1)';
                    questionText.textContent = pair.question_text;
                    answerText.textContent = pair.answer?.text || 'No answer recorded';
                    answerContainer.style.display = 'block';
                    questionOverlay.style.borderLeftColor = 'rgba(188, 140, 255, 1)';
                    
                    // Show overlay
                    questionOverlay.style.display = 'block';
                    
                    // Auto-hide after 10 seconds
                    setTimeout(() => {
                        questionOverlay.style.display = 'none';
                    }, 10000);
                    
                    console.log(`Jumped to Q${qIndex} at ${targetTime.toFixed(2)}s`);
                }
            });
        }

    } catch (error) {
        console.error('Error initializing candidate waveform:', error);
        document.getElementById('waveformCandidate').innerHTML = `
            <div style="padding:30px;text-align:center;color:var(--text-muted)">
                <div style="font-size:12px">⚠️ Unable to load candidate audio</div>
                <div style="font-size:11px;margin-top:4px">${error.message}</div>
            </div>
        `;
    }

    // Initialize WaveSurfer for INTERVIEWER
    try {
        wavesurferInterviewer = WaveSurfer.create({
            container: '#waveformInterviewer',
            waveColor: 'rgba(139, 148, 158, 0.4)',
            progressColor: 'rgba(139, 148, 158, 0.9)',
            cursorColor: '#8b949e',
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            height: 80,
            normalize: true,
            backend: 'WebAudio',
            mediaControls: false,
            interact: true,
            hideScrollbar: true,
            autoCenter: true,
            minPxPerSec: currentZoom
        });

        // Load interviewer audio
        await wavesurferInterviewer.load(interviewerAudioPath);

    } catch (error) {
        console.error('Error initializing interviewer waveform:', error);
        document.getElementById('waveformInterviewer').innerHTML = `
            <div style="padding:30px;text-align:center;color:var(--text-muted)">
                <div style="font-size:12px">⚠️ Unable to load interviewer audio</div>
                <div style="font-size:11px;margin-top:4px">${error.message}</div>
            </div>
        `;
    }

    // Synchronization between video and both waveforms
    if (videoElement && wavesurferCandidate) {
        // Sync waveforms with video timeupdate
        videoElement.addEventListener('timeupdate', () => {
            const currentTime = videoElement.currentTime;
            const normalizedPos = currentTime / dur;
            
            if (wavesurferCandidate && Math.abs(wavesurferCandidate.getCurrentTime() - currentTime) > 0.3) {
                wavesurferCandidate.seekTo(normalizedPos);
            }
            if (wavesurferInterviewer && Math.abs(wavesurferInterviewer.getCurrentTime() - currentTime) > 0.3) {
                wavesurferInterviewer.seekTo(normalizedPos);
            }
            
            currentTimeDisplay.textContent = `${fmtTime(currentTime)} / ${fmtTime(dur)}`;
        });

        // Sync video with candidate waveform seeking
        wavesurferCandidate.on('seeking', (currentTime) => {
            if (Math.abs(videoElement.currentTime - currentTime) > 0.3) {
                videoElement.currentTime = currentTime;
                if (wavesurferInterviewer) {
                    wavesurferInterviewer.seekTo(currentTime / dur);
                }
            }
        });

        // Sync video with interviewer waveform seeking
        if (wavesurferInterviewer) {
            wavesurferInterviewer.on('seeking', (currentTime) => {
                if (Math.abs(videoElement.currentTime - currentTime) > 0.3) {
                    videoElement.currentTime = currentTime;
                    wavesurferCandidate.seekTo(currentTime / dur);
                }
            });
        }

        // Play/Pause button
        playPauseBtn.addEventListener('click', () => {
            if (videoElement.paused) {
                videoElement.play();
                wavesurferCandidate.play();
                if (wavesurferInterviewer) wavesurferInterviewer.play();
                playPauseBtn.textContent = '⏸ Pause';
            } else {
                videoElement.pause();
                wavesurferCandidate.pause();
                if (wavesurferInterviewer) wavesurferInterviewer.pause();
                playPauseBtn.textContent = '▶ Play';
            }
        });

        // Sync play/pause from video controls
        videoElement.addEventListener('play', () => {
            wavesurferCandidate.play();
            if (wavesurferInterviewer) wavesurferInterviewer.play();
            playPauseBtn.textContent = '⏸ Pause';
        });

        videoElement.addEventListener('pause', () => {
            wavesurferCandidate.pause();
            if (wavesurferInterviewer) wavesurferInterviewer.pause();
            playPauseBtn.textContent = '▶ Play';
        });

        // Waveform click - seek both and show relevant Q&A
        wavesurferCandidate.on('interaction', () => {
            const time = wavesurferCandidate.getCurrentTime();
            videoElement.currentTime = time;
            if (wavesurferInterviewer) {
                wavesurferInterviewer.seekTo(time / dur);
            }
            
            // Find and show the Q&A pair closest to this timestamp
            showQAAtTime(time);
        });

        if (wavesurferInterviewer) {
            wavesurferInterviewer.on('interaction', () => {
                const time = wavesurferInterviewer.getCurrentTime();
                videoElement.currentTime = time;
                wavesurferCandidate.seekTo(time / dur);
                
                // Find and show the Q&A pair closest to this timestamp
                showQAAtTime(time);
            });
        }

        // Helper function to show Q&A pair at specific timestamp
        function showQAAtTime(timestamp) {
            if (currentRegions.length === 0) return;
            
            // Find the Q&A pair that contains this timestamp
            const region = currentRegions.find(r => {
                const pair = r.data;
                const start = pair.question_start_time ?? 0;
                const end = pair.answer?.end_time ?? pair.question_end_time ?? start + 5;
                return timestamp >= start && timestamp <= end;
            });
            
            if (region) {
                const pair = region.data;
                const qIndex = region.index + 1;
                const overlayHeader = document.getElementById('overlayHeader');
                const answerContainer = document.getElementById('answerContainer');
                const answerText = document.getElementById('answerText');
                const questionText = document.getElementById('questionText');
                
                overlayHeader.textContent = `Q${qIndex}: Question & Answer`;
                overlayHeader.style.color = 'rgba(188, 140, 255, 1)';
                questionText.textContent = pair.question_text;
                answerText.textContent = pair.answer?.text || 'No answer recorded';
                answerContainer.style.display = 'block';
                document.getElementById('questionOverlay').style.borderLeftColor = 'rgba(188, 140, 255, 1)';
                document.getElementById('questionOverlay').style.display = 'block';
                
                setTimeout(() => {
                    document.getElementById('questionOverlay').style.display = 'none';
                }, 8000);
            }
        }
    }

    // Zoom controls
    if (zoomSlider && zoomInBtn && zoomOutBtn) {
        const updateZoom = (newZoom) => {
            currentZoom = newZoom;
            zoomSlider.value = newZoom;
            
            if (wavesurferCandidate) {
                wavesurferCandidate.zoom(newZoom);
            }
            if (wavesurferInterviewer) {
                wavesurferInterviewer.zoom(newZoom);
            }
        };

        zoomSlider.addEventListener('input', (e) => {
            updateZoom(parseInt(e.target.value));
        });

        zoomInBtn.addEventListener('click', () => {
            const newZoom = Math.min(200, currentZoom + 10);
            updateZoom(newZoom);
        });

        zoomOutBtn.addEventListener('click', () => {
            const newZoom = Math.max(10, currentZoom - 10);
            updateZoom(newZoom);
        });
    }

    console.log('✓ Dual-track Video + Waveform initialized with', qaPairs.length, 'Q&A segments');
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

// Cleanup function to stop audio/video and destroy instances
export function cleanupTemporal() {
    console.log('Cleaning up Temporal Evidence page...');
    
    // Pause and reset video with error handling
    if (videoElement) {
        try {
            videoElement.pause();
            videoElement.currentTime = 0;
            videoElement.src = ''; // Clear source to fully stop
            videoElement.load(); // Reset the element
        } catch (e) {
            console.warn('Error stopping video:', e);
        }
    }
    
    // Stop and destroy WaveSurfer instances
    if (wavesurferCandidate) {
        try {
            wavesurferCandidate.stop();
            wavesurferCandidate.pause();
            wavesurferCandidate.destroy();
        } catch (e) {
            console.warn('Error destroying candidate wavesurfer:', e);
        }
        wavesurferCandidate = null;
    }
    
    if (wavesurferInterviewer) {
        try {
            wavesurferInterviewer.stop();
            wavesurferInterviewer.pause();
            wavesurferInterviewer.destroy();
        } catch (e) {
            console.warn('Error destroying interviewer wavesurfer:', e);
        }
        wavesurferInterviewer = null;
    }
    
    // Remove event listeners
    if (keydownHandler) {
        document.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
    }
    
    if (spacebarHandler) {
        document.removeEventListener('keydown', spacebarHandler);
        spacebarHandler = null;
    }
    
    // Remove visibility change listeners
    if (window.temporalCleanupHandlers) {
        window.temporalCleanupHandlers.forEach(({ type, handler, target }) => {
            if (target === 'window') {
                window.removeEventListener(type, handler);
            } else {
                document.removeEventListener(type, handler);
            }
        });
        window.temporalCleanupHandlers = [];
    }
    
    // Aggressively find and stop any remaining media
    const pageContainer = document.getElementById('page-temporal');
    if (pageContainer) {
        pageContainer.querySelectorAll('video, audio').forEach(media => {
            try {
                media.pause();
                media.currentTime = 0;
                media.src = '';
            } catch (e) {
                console.warn('Error stopping media element:', e);
            }
        });
    }
    
    // Clear references
    videoElement = null;
    currentRegions = [];
    
    // Destroy chart instances
    Object.values(chartInstances).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            try {
                chart.destroy();
            } catch (e) {
                console.warn('Error destroying chart:', e);
            }
        }
    });
    chartInstances = {};
    
    console.log('Temporal Evidence cleanup completed');
}
