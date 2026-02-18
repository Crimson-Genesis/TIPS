Good, this clarification matters.
Now the **working directory is small, flat, and correct**, which makes OpenCode controllable.

I will give you a **revised, precise prompt map**, **anchored to THIS directory**, not the earlier messy repo.

I will **not repeat theory**. This is an **execution map only**.

---

# WORKING DIRECTORY (LOCKED CONTEXT)

OpenCode will run **here**:

```
.
├── chats/                  # design documents (read-only)
├── instruction.md          # project instruction (read-only)
├── trans/                  # TEST DATA (authoritative input)
│   ├── 1_candidate_audio.wav
│   ├── 1_candidate_video.mp4
│   ├── 1_interviewer_audio.wav
│   ├── 2_candidate_audio.wav
│   ├── 2_candidate_video.mp4
│   └── 2_interviewer_audio.wav
├── things.tex              # backend spec (authoritative)
└── tree
```

👉 **All backend code will be created NEW** under a directory like `backend/`.

---

# ABSOLUTE RULES (DO NOT BREAK)

1. `trans/` is **read-only input**
2. `chats/` is **documentation only**
3. Backend code must **not modify original media**
4. All outputs go to `backend/output/`
5. JSON only between stages

---

# OPENCODE PROMPT MAP (REVISED & FINAL)

---

## PHASE 0 — CONTEXT PRIMING (MANDATORY)

### Prompt 0.1 — Load Context

**Mode:** plain / analysis

```
Context only. Do not write code.

This session builds the backend ML pipeline defined in things.tex
(backend_processing specification).

Working directory:
- Input data: ./trans/
- Documentation: ./chats/
- Backend code does NOT exist yet.

All outputs must be JSON.
All models are pretrained only.
No training.

Acknowledge once.
```

**STOP after acknowledgment**

---

## PHASE 1 — PLANNING (ONE PROMPT)

### Prompt 1.1 — Backend Plan

**Mode:** PLAN

```
You are in PLANNING MODE.

Using things.tex as the single source of truth:

1. Propose a backend directory structure rooted at ./backend/
2. List every Python module needed.
3. For each module:
   - responsibility
   - input files (relative paths)
   - output files (relative paths)
4. Define the execution order.
5. Define all intermediate JSON artifacts.

Constraints:
- Input data is in ./trans/
- Output data goes to ./backend/output/
- No code
- No new features

Return:
- directory tree
- module table
- execution sequence
```

**STOP**
You manually review and **LOCK** the plan.

---

## PHASE 2 — STRUCTURE GENERATION

### Prompt 2.1 — Project Skeleton

**Mode:** BUILD

```
BUILD MODE.

Create the backend project skeleton exactly as defined in the approved plan.

Requirements:
- Root at ./backend/
- Create all directories
- Create empty Python files
- Add __init__.py where required
- Add README.md explaining how to run the pipeline

Rules:
- No logic
- No ML
- Only TODO comments
```

**STOP**
Verify file tree exists.

---

## PHASE 3 — PIPELINE IMPLEMENTATION (STAGE BY STAGE)

> One stage = one prompt
> Never merge stages

---

### Prompt 3.1 — Stage 0: Canonical Time Base

**Mode:** BUILD

```
BUILD MODE.

Implement Stage 0 only.

Inputs:
- ./trans/*_candidate_video.mp4
- ./trans/*_candidate_audio.wav
- ./trans/*_interviewer_audio.wav

Tasks:
- Extract video FPS and duration
- Establish canonical video timeline
- Align audio timestamps logically

Output:
- ./backend/output/timeline.json

Rules:
- Deterministic
- No ML
- JSON only
```

---

### Prompt 3.2 — Stage 1A: Candidate Audio Extraction

**Mode:** BUILD

```
BUILD MODE.

Implement Stage 1A.

Inputs:
- ./trans/*_candidate_audio.wav
- timeline.json

Tasks:
- Audio feature extraction
- Timestamped transcription

Output:
- ./backend/output/candidate_audio_raw.json

Do not touch video or interviewer audio.
```

---

### Prompt 3.3 — Stage 1B: Interviewer Transcription

**Mode:** BUILD

```
BUILD MODE.

Implement Stage 1B.

Inputs:
- ./trans/*_interviewer_audio.wav
- timeline.json

Tasks:
- Speech-to-text transcription only

Output:
- ./backend/output/interviewer_transcript.json
```

---

### Prompt 3.4 — Stage 1C: Candidate Video Extraction

**Mode:** BUILD

```
BUILD MODE.

Implement Stage 1C.

Inputs:
- ./trans/*_candidate_video.mp4
- timeline.json

Tasks:
- Sample every 10th frame
- Extract face presence, gaze, head pose
- Timestamp everything

Output:
- ./backend/output/candidate_video_raw.json
```

---

## PHASE 4 — TEMPORAL STRUCTURE

### Prompt 4.1 — Stage 2: Temporal Grouping

**Mode:** BUILD

```
BUILD MODE.

Implement Stage 2.

Inputs:
- candidate_audio_raw.json
- interviewer_transcript.json
- candidate_video_raw.json

Tasks:
- Speaking vs non-speaking segmentation
- Question–answer pairing

Outputs:
- ./backend/output/speaking_segments.json
- ./backend/output/qa_pairs.json
```

---

## PHASE 5 — BEHAVIORAL METRICS

### Prompt 5.1 — Stage 3: Behavioral Metrics

**Mode:** BUILD

```
BUILD MODE.

Implement Stage 3.

Inputs:
- speaking_segments.json
- candidate_audio_raw.json
- candidate_video_raw.json

Tasks:
- Compute audio-based behavioral proxies
- Compute video-based behavioral proxies

Output:
- ./backend/output/candidate_behavior_metrics.json

No semantic reasoning.
```

---

## PHASE 6 — SEMANTIC ANALYSIS

### Prompt 6.1 — Stage 4: Relevance Scoring

**Mode:** BUILD

```
BUILD MODE.

Implement Stage 4.

Inputs:
- qa_pairs.json
- job_description.txt

Tasks:
- Semantic relevance scoring using local LLM
- Strict JSON output
- Deterministic decoding

Output:
- ./backend/output/relevance_scores.json
```

---

## PHASE 7 — AGGREGATION & VERDICT

### Prompt 7.1 — Stage 5: JD-Conditioned Aggregation

**Mode:** BUILD

```
BUILD MODE.

Implement Stage 5.

Inputs:
- candidate_behavior_metrics.json
- relevance_scores.json
- job_description.txt

Tasks:
- JD decomposition
- Chronological score aggregation

Output:
- ./backend/output/candidate_score_timeline.json
```

---

## PHASE 8 — ORCHESTRATION

### Prompt 8.1 — Pipeline Runner

**Mode:** BUILD

```
BUILD MODE.

Implement run_pipeline.py.

Tasks:
- Execute all stages in correct order
- Validate required inputs at each step
- Write logs
- Fail fast on missing artifacts

Do not reimplement stage logic.
```

---

## PHASE 9 — VERIFICATION (FINAL)

### Prompt 9.1 — System Audit

**Mode:** ANALYSIS

```
ANALYSIS MODE.

Audit the backend implementation:

- Verify directory structure
- Verify stage order
- Verify JSON contracts
- Compare behavior against things.tex

List discrepancies only.
Do not write code.
```

---

# HOW YOU KNOW THIS IS CORRECT

✔ Every prompt fits context window
✔ No prompt asks OpenCode to “design and build” together
✔ Inputs/outputs are explicit
✔ Directory boundaries are enforced
✔ Test data location is fixed

This map is **operationally correct**.
If you follow it exactly, OpenCode will behave like a disciplined engineer instead of a hallucinating one.
