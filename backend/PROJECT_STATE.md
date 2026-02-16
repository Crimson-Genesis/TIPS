# PROJECT STATE LOG
Temporal Interview Profiling System (Backend)

## Working Directory (LOCKED)
.
├── chats/                  # documentation (read-only)
├── instruction.md          # instructions (read-only)
├── things.tex              # backend spec (authoritative)
├── trans/                  # test data (read-only)
└── backend/                # backend implementation

## Environment Status
- Python: 3.11
- Virtualenv: active
- Torch: CUDA available
- Models installed & cached:
  - Qwen 2.5 3B Instruct
  - Sentence-BERT (all-MiniLM-L6-v2)
  - faster-whisper (small)

HF_HUB_OFFLINE = enabled

## Completed Phases

### Phase 0 — Context Priming
- OpenCode context loaded
- Constraints acknowledged

### Phase 1 — Planning
- Backend structure planned
- Modules defined
- Execution order locked

### Phase 2 — Structure Generation
- ./backend/ directory created
- Subdirectories created
- Empty Python files created
- run_pipeline.py created
- README.md created

### Phase 3 — Pipeline Implementation

#### Stage 0 — Canonical Time Base
Status: COMPLETE
- Extract video FPS and duration
- Establish canonical video timeline
- Align audio timestamps
Output:
- backend/output/timeline.json
  - fps: 24.0
  - duration_sec: 385.333
  - 9248 frames

#### Stage 1A — Candidate Audio Extraction
Status: COMPLETE
- Audio feature extraction (RMS, pitch)
- Voice Activity Detection (VAD)
- Whisper transcription with word-level timestamps
Output:
- backend/output/candidate_audio_raw.json
  - 3854 feature frames
  - 214 speaking segments (VAD)
  - 48 transcription segments

#### Stage 1B — Interviewer Transcription
Status: COMPLETE
- Whisper transcription with word-level timestamps
Output:
- backend/output/interviewer_transcript.json
  - 20 interview segments

#### Stage 1C — Candidate Video Extraction
Status: COMPLETE
- Sample every 10th frame (925 frames)
- Face detection (Haar Cascade)
- Head pose estimation (yaw, pitch, roll)
- Gaze estimation
Output:
- backend/output/candidate_video_raw.json
  - 925 sampled frames
  - Face detected in ~99% of frames

#### Stage 2 — Temporal Grouping
Status: COMPLETE (FINAL - FIXED)
- Candidate audio VAD defines speaking segments
- Video frames aligned to audio timestamps
- Non-speaking intervals preserved explicitly
- Q&A mapping: SET-BASED approach
  - Answer = ALL speaking segments with start_time > question_end_time
    AND start_time < next_question_start_time
  - Silence does NOT break answer
  - Only next interviewer question terminates answer
- Follow-up questions correctly show "No answer"
Output:
- backend/output/speaking_segments.json
  - 429 total segments (214 speaking + 215 non_speaking)
- backend/output/qa_pairs.json
  - 20 Q&A pairs
  - 4 follow-up questions with "No answer" (correct behavior)

#### Stage 3 — Behavioral Metrics
Status: COMPLETE
- Audio metrics per speaking segment: pitch_mean/variance, energy_mean/variance,
  speech_rate, pause_density, prosodic_variability
- Video metrics per speaking segment: face_presence_ratio, head_motion_mean/variance,
  gaze_stability, facial_motion_intensity, expression_change_rate
- All values numeric, no semantic inference
Output:
- backend/output/candidate_behavior_metrics.json
  - 214 speaking segments with metrics

#### Stage 4 — Semantic Relevance
Status: COMPLETE (JSONL format)
- Uses keyword matching for deterministic scoring
- Incremental JSONL output (one line per QA pair)
- JD: machine_learning_engineer.md
Output:
- backend/output/relevance_scores.jsonl
  - 20 QA pairs processed

## Current Stop Point
- Ready to start **Stage 4 (Semantic Relevance Scoring)**

## Do NOT redo
- Planning
- Dependency installation
- Model downloads
- Stage 0 / Stage 1 / Stage 2 / Stage 3 implementations
