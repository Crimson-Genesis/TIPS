// ═══════════════════════════════════════════════════════════════
// TIPS Dashboard — config.js
// ═══════════════════════════════════════════════════════════════

export const CONFIG = {
  OUTPUT_DIR: '../backend/backend/output/',
  FILES: {
    timeline:          'timeline.json',
    qa_pairs:          'qa_pairs.json',
    score_timeline:    'candidate_score_timeline.json',   // JSONL!
    relevance_scores:  'relevance_scores.json',
    behavior_metrics:  'candidate_behavior_metrics.json',
    speaking_segments: 'speaking_segments.json',
    audio_raw:         'candidate_audio_raw.json',
    video_raw:         'candidate_video_raw.json',
    interviewer:       'interviewer_transcript.json',
  }
};

export const COMPETENCY_KEYS = [
  { key: 'technical_depth',      label: 'Technical Depth',        color: '#388bfd' },
  { key: 'system_design',        label: 'System Design',          color: '#bc8cff' },
  { key: 'production_experience',label: 'Production Experience',  color: '#3fb950' },
  { key: 'communication_clarity',label: 'Communication Clarity',  color: '#39c5cf' },
  { key: 'problem_solving',      label: 'Problem Solving',        color: '#d29922' },
];

export const CHART_DEFAULTS = {
  color: '#e6edf3',
  gridColor: 'rgba(48,54,61,0.8)',
  font: { family: 'Inter, system-ui, sans-serif', size: 11 },
};

/** Apply TIPS dark theme defaults to all Chart.js charts */
export function applyChartDefaults() {
  Chart.defaults.color = CHART_DEFAULTS.color;
  Chart.defaults.borderColor = CHART_DEFAULTS.gridColor;
  Chart.defaults.font.family = CHART_DEFAULTS.font.family;
  Chart.defaults.font.size = CHART_DEFAULTS.font.size;
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.tooltip.backgroundColor = '#22272e';
  Chart.defaults.plugins.tooltip.borderColor = '#30363d';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.titleFont = { weight: 700, size: 12 };
  Chart.defaults.plugins.tooltip.bodyFont  = { size: 11 };
  Chart.defaults.plugins.tooltip.padding = 10;
}
