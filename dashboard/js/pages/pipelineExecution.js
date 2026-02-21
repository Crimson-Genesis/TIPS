// ═══════════════════════════════════════════════════════════════
// TIPS Dashboard — pages/pipelineExecution.js (fixed)
// Page 3: Pipeline Execution View
// ═══════════════════════════════════════════════════════════════
import { sessionData, fmtTime } from '../dataLoader.js';

const STAGES = [
  {
    num: 0, name: 'Canonical Timebase',
    desc: 'Extracts video FPS/duration and aligns all audio timestamps to a single master clock.',
    outputFile: 'timeline.json',
    dataKey: 'timeline',
    getStats(d) {
      const v = d?.video;
      return [
        { val: v?.fps ?? '—', lbl: 'FPS' },
        { val: v?.frame_count?.toLocaleString() ?? '—', lbl: 'Total Frames' },
        { val: fmtTime(v?.duration_sec), lbl: 'Duration' },
        { val: d?.alignment?.video_to_audio_offset_sec ?? '—', lbl: 'AV Offset (s)' },
      ];
    }
  },
  {
    num: 1, name: 'Stage 1A — Candidate Audio', emoji: '🎙',
    desc: 'Extracts RMS, pitch, speech rate, pause density from candidate audio. Runs VAD and Whisper transcription.',
    outputFile: 'candidate_audio_raw.json',
    dataKey: 'audio_summary',
    getStats(d) {
      return [
        { val: d?.feature_frame_count?.toLocaleString() ?? '—', lbl: 'Feature Frames' },
        { val: d?.vad_segment_count ?? '—', lbl: 'VAD Segments' },
        { val: d?.transcription_count ?? '—', lbl: 'Transcript Segs' },
        { val: d?.avg_pitch ? d.avg_pitch.toFixed(0) + ' Hz' : '—', lbl: 'Avg Pitch' },
      ];
    }
  },
  {
    num: 2, name: 'Stage 1B — Interviewer Audio', emoji: '🎤',
    desc: 'Runs Whisper transcription on interviewer audio only. No other processing.',
    outputFile: 'interviewer_transcript.json',
    dataKey: 'interviewer',
    getStats(d) {
      // interviewer_transcript.json structure:
      // { dataset_id, source_file, transcription: { language, segments: [...] } }
      const segs = d?.transcription?.segments || d?.segments || [];
      const words = segs.reduce((a, s) => a + (s.text?.trim().split(/\s+/).length || 0), 0);
      const lastSeg = segs[segs.length - 1];
      const lastEnd = lastSeg ? (lastSeg.end_sec ?? lastSeg.end ?? lastSeg.end_time ?? 0) : 0;
      return [
        { val: segs.length, lbl: 'Segments' },
        { val: words, lbl: 'Words (approx)' },
        { val: fmtTime(lastEnd), lbl: 'Last Timestamp' },
      ];
    }
  },
  {
    num: 3, name: 'Stage 1C — Candidate Video', emoji: '🎥',
    desc: 'Samples every 10th frame. Detects face, estimates head pose (yaw/pitch/roll), gaze direction.',
    outputFile: 'candidate_video_raw.json',
    dataKey: 'video_summary',
    getStats(d) {
      return [
        { val: d?.frame_count?.toLocaleString() ?? '—', lbl: 'Frames Sampled' },
        { val: d?.face_presence_pct ? d.face_presence_pct.toFixed(1) + '%' : '—', lbl: 'Face Presence' },
        { val: d?.avg_gaze_stability ? d.avg_gaze_stability.toFixed(2) : '—', lbl: 'Avg Gaze Stability' },
        { val: d?.avg_head_motion ? d.avg_head_motion.toFixed(2) : '—', lbl: 'Avg Head Motion' },
      ];
    }
  },
  {
    num: 4, name: 'Stage 2 — Temporal Grouping', emoji: '⏱',
    desc: 'Groups audio frames into speaking/silent segments via VAD. Maps interviewer questions to candidate answers.',
    outputFile: 'speaking_segments.json + qa_pairs.json',
    dataKey: 'speaking_segments',
    getStats(d) {
      // All segments in speaking_segments.json are type="speaking"
      const segs = d || [];
      const qa = sessionData.qa_pairs;
      return [
        { val: segs.length, lbl: 'Speaking Segments' },
        { val: qa?.total_pairs ?? qa?.qa_pairs?.length ?? '—', lbl: 'Q&A Pairs' },
      ];
    }
  },
  {
    num: 5, name: 'Stage 3 — Behavioral Metrics', emoji: '📶',
    desc: 'Computes per-speaking-segment audio and video behavioral metrics. No LLM involved.',
    outputFile: 'candidate_behavior_metrics.json',
    dataKey: 'behavior_metrics',
    getStats(d) {
      const segs = d?.segments || [];
      return [
        { val: segs.length, lbl: 'Segments Processed' },
        { val: 7, lbl: 'Audio Metric Fields' },
        { val: 6, lbl: 'Video Metric Fields' },
      ];
    }
  },
  {
    num: 6, name: 'Stage 4 — Semantic Relevance', emoji: '🧠',
    desc: 'LLM-powered (Qwen 2.5 3B + Sentence-BERT) keyword matching for answer relevance against job description.',
    outputFile: 'relevance_scores.json',
    dataKey: 'relevance_scores',
    getStats(d) {
      const list = Array.isArray(d) ? d : [];
      const avg = list.length
        ? (list.reduce((a, s) => a + (s.relevance_score || 0), 0) / list.length).toFixed(2)
        : '—';
      const totalKw = list.reduce((a, s) => a + (s.matched_keywords?.length || 0), 0);
      return [
        { val: list.length, lbl: 'QA Pairs Scored' },
        { val: avg, lbl: 'Avg Relevance' },
        { val: totalKw, lbl: 'Total KW Matches' },
      ];
    }
  },
  {
    num: 7, name: 'Stage 5 — Score Aggregation', emoji: '🏁',
    desc: 'JD-conditioned incremental scoring across all checkpoints. Produces final verdict using Qwen 2.5 3B.',
    outputFile: 'candidate_score_timeline.json (JSONL)',
    dataKey: 'checkpoints',
    getStats(d) {
      const fv = sessionData.final_verdict;
      return [
        { val: Array.isArray(d) ? d.length : '—', lbl: 'Checkpoints' },
        { val: fv?.verdict?.replace(/_/g, ' ') ?? '—', lbl: 'Final Verdict' },
        { val: fv?.overall_score ? (fv.overall_score * 100).toFixed(0) + '%' : '—', lbl: 'Overall Score' },
        { val: fv?.confidence ?? '—', lbl: 'Confidence' },
      ];
    }
  },
];

export function renderPipeline(el) {
  console.log('[TIPS] renderPipeline called. timeline:', !!sessionData.timeline,
    'checkpoints:', sessionData.checkpoints?.length,
    'loaded:', sessionData.loaded);

  if (!sessionData.loaded) {
    el.innerHTML = noData();
    return;
  }
  try {
    el.innerHTML = buildPipeline();
    setupFlowClick();
    console.log('[TIPS] renderPipeline complete');
  } catch (err) {
    console.error('[TIPS] renderPipeline ERROR:', err);
    el.innerHTML = `<div class="empty-state"><div class="es-icon">⚠</div><div class="es-title">Render Error</div><div class="es-sub"><code>${err.message}</code><br>Check console (F12).</div></div>`;
  }
}

function noData() {
  const errs = Object.keys(sessionData.errors || {});
  const errHtml = errs.length
    ? `<div style="margin-top:12px;font-size:11px;color:var(--score-low)">Failed files: ${errs.join(', ')}</div>`
    : '';
  return `<div class="empty-state"><div class="es-icon">⚙️</div><div class="es-title">No data loaded yet</div><div class="es-sub">Click <strong>Load Session</strong> → <em>Folder Picker</em> and select your <code>output/</code> folder.${errHtml}</div></div>`;
}

function buildPipeline() {
  const tl = sessionData.timeline;
  return `
  <div class="section-header">
    <div class="section-title">Pipeline Execution View</div>
    <div class="section-sub">Stage-by-stage status and output inventory</div>
  </div>

  <!-- Header stats -->
  <div class="grid-4 reveal" style="margin-bottom:28px">
    <div class="stat-card">
      <div class="stat-label">Dataset ID</div>
      <div class="stat-value" style="font-size:20px">${tl?.dataset_id ?? '—'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Duration</div>
      <div class="stat-value">${fmtTime(tl?.video?.duration_sec)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Stages Complete</div>
      <div class="stat-value">${STAGES.filter(s => getData(s.dataKey)).length} / ${STAGES.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Output Files</div>
      <div class="stat-value">9</div>
      <div class="stat-sub">JSON / JSONL</div>
    </div>
  </div>

  <!-- Data Flow + Stage Cards side by side -->
  <div class="grid-2 reveal" style="align-items:start">

    <!-- Flow Diagram -->
    <div class="card" style="padding:20px">
      <div class="card-title">Data Flow</div>
      <div class="flow-diagram">
        <div class="flow-node">
          <div class="flow-box input">Input Files (audio + video + JD)</div>
        </div>
        <div class="flow-arrow"></div>
        <div class="flow-node" data-stage="0"><div class="flow-box">[S0] Timebase</div></div>
        <div class="flow-arrow"></div>
        <div class="flow-parallel">
          <div class="flow-node" data-stage="1"><div class="flow-box" style="font-size:10px">[S1A] Audio</div></div>
          <div class="flow-node" data-stage="2"><div class="flow-box" style="font-size:10px">[S1B] Interviewer</div></div>
          <div class="flow-node" data-stage="3"><div class="flow-box" style="font-size:10px">[S1C] Video</div></div>
        </div>
        <div class="flow-arrow"></div>
        <div class="flow-node" data-stage="4"><div class="flow-box">[S2] Temporal Grouping</div></div>
        <div class="flow-arrow"></div>
        <div class="flow-node" data-stage="5"><div class="flow-box">[S3] Behavioral Metrics</div></div>
        <div class="flow-arrow"></div>
        <div class="flow-node" data-stage="6"><div class="flow-box">[S4] Semantic Relevance</div></div>
        <div class="flow-arrow"></div>
        <div class="flow-node" data-stage="7"><div class="flow-box">[S5] Score Aggregation</div></div>
        <div class="flow-arrow"></div>
        <div class="flow-node"><div class="flow-box output">◈ Dashboard</div></div>
      </div>
    </div>

    <!-- Stage Cards -->
    <div>
      ${STAGES.map(s => buildStageCard(s)).join('')}
    </div>
  </div>

  <!-- File Inventory -->
  <div class="section-header reveal" style="margin-top:32px">
    <div class="section-title">Output File Inventory</div>
  </div>
  <div class="card reveal">
    <table class="data-table">
      <thead><tr><th>File</th><th>Status</th><th>Records / Notes</th></tr></thead>
      <tbody>
        ${buildInventory()}
      </tbody>
    </table>
  </div>`;
}

function getData(key) {
  const v = sessionData[key];
  if (Array.isArray(v)) return v.length > 0 ? v : null;
  return v || null;
}

function buildStageCard(stage) {
  const data = getData(stage.dataKey);
  const status = data ? 'complete' : 'missing';
  const stats = data ? stage.getStats(data) : [];
  return `
  <div class="stage-card reveal" data-stage-card="${stage.num}">
    <div class="stage-num">${stage.num}</div>
    <div class="stage-body">
      <div class="stage-header">
        <span class="stage-name">${stage.emoji || ''} ${stage.name}</span>
        <span class="stage-badge ${status}">${status}</span>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${stage.desc}</div>
      <div class="stage-output">→ ${stage.outputFile}</div>
      ${stats.length > 0 ? `
      <div class="stage-stats">
        ${stats.map(s => `<div class="stage-stat"><div class="stage-stat-val">${s.val}</div><div class="stage-stat-lbl">${s.lbl}</div></div>`).join('')}
      </div>` : ''}
    </div>
  </div>`;
}

function inventoryCount(key, d, ok) {
  if (!ok) return '—';
  if (Array.isArray(d)) return d.length;
  if (d?.qa_pairs) return d.qa_pairs.length;
  if (d?.segments) return d.segments.length;
  if (d?.transcription?.segments) return d.transcription.segments.length;
  return '✓';
}

function buildInventory() {
  const inv = [
    { file: 'timeline.json', key: 'timeline', note: 'FPS, duration, alignment' },
    { file: 'candidate_audio_raw.json', key: 'audio_summary', note: 'Feature frames + VAD' },
    { file: 'interviewer_transcript.json', key: 'interviewer', note: 'Interviewer speech segments' },
    { file: 'candidate_video_raw.json', key: 'video_summary', note: 'Per-frame video features' },
    { file: 'speaking_segments.json', key: 'speaking_segments', note: 'Speaking segment timeline' },
    { file: 'qa_pairs.json', key: 'qa_pairs', note: 'Question–answer pairs' },
    { file: 'candidate_behavior_metrics.json', key: 'behavior_metrics', note: 'Audio + video per segment' },
    { file: 'relevance_scores.json', key: 'relevance_scores', note: 'Per-QA LLM relevance scoring (JSONL)' },
    { file: 'candidate_score_timeline.json', key: 'checkpoints', note: 'JSONL incremental + final verdict' },
  ];
  return inv.map(row => {
    const d = sessionData[row.key];
    const ok = !!d;
    const count = inventoryCount(row.key, d, ok);
    return `<tr>
      <td style="color:var(--accent-teal)">${row.file}</td>
      <td><span class="stage-badge ${ok ? 'complete' : 'missing'}" style="font-size:10px">${ok ? 'loaded' : 'missing'}</span></td>
      <td style="color:var(--text-secondary)">${count} · ${row.note}</td>
    </tr>`;
  }).join('');
}

function setupFlowClick() {
  document.querySelectorAll('.flow-node[data-stage]').forEach(node => {
    node.addEventListener('click', () => {
      const idx = parseInt(node.dataset.stage);
      document.querySelectorAll('.stage-card').forEach(c => c.style.outline = 'none');
      const card = document.querySelector(`.stage-card[data-stage-card="${idx}"]`);
      if (card) {
        card.style.outline = '2px solid var(--accent-blue)';
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      document.querySelectorAll('.flow-box').forEach(b => b.classList.remove('active'));
      node.querySelector('.flow-box')?.classList.add('active');
    });
  });
}
