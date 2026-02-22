# TIPS — The Temporal Interview Profiling System

[![Python 3.11](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-00.svg)](https://fastapi.tiangolo.com/)
[![WebRTC](https://img.shields.io/badge/WebRTC-aiortc-green.svg)](https://aiortc.readthedocs.io/)

---

## A Prologue

*In the name of all that is methodical and systematic, behold! TIPS — The Temporal Interview Profiling System — a most noble contraption whereby the souls of candidates may be weighed, measured, and thoroughly examined in the crucible of the modern interview.*

*Whereas the art of hiring hath long suffered under the yoke of subjectivity and caprice, TIPS emergeth as a beacon of analytical rigour. This system doth process recorded video interviews through a multi-stage pipeline of considerable sophistication, extracting signals both auditory and visual, evaluating responses with the keen eye of Large Language Models, and rendering time-evolving verdicts upon the candidate's worthiness.*

---

## Of the System's Purpose

The Temporal Interview Profiling System (TIPS) standeth as an automated interview analysis engine, designed to process pre-recorded video interviews and generate comprehensive behavioural and semantic assessments of candidates whomst seek employment.

The system doth operate as a batch processing apparatus, wherein interviews are first recorded and subsequently subjected to six distinct stages of analysis, each building upon the last, until finally there emerge time-evolving candidate scores and verdicts upon hiring.

TIPS striveth to provide an objective, data-driven assessment by analysing:

- **Verbal Responses** — What the candidate doth uttereth
- **Vocal Characteristics** — How the candidate doth speaketh  
- **Visual Behaviour** — Whither the candidate doth looketh

Unlike实时 systems of lesser capability, TIPS understandeth not merely *what* is said, but *when* it is said, and *how* the candidate's confidence doth fluctuate throughout the interrogation.

---

## Of the Architecture

The architecture of TIPS consisteth of three principal components, each serving its sacred purpose:

```
┌─────────────────────┐     ┌───────────────────────┐     ┌──────────────────┐
│  Interview UI      │     │  Backend Pipeline      │     │   The Dashboard  │
│  (Recording)       │────▶│  (Six Stages)          │────▶│   (Visualisation)│
└─────────────────────┘     └───────────────────────┘     └──────────────────┘
```

### The Three Pillars

**Pillar I — The Interview Recording UI**  
A WebRTC-powered browser interface for conducting video interviews with synchronised audio capture from both interviewer and candidate.

**Pillar II — The Backend Pipeline**  
A six-stage processing system that analyseth recorded interviews and extracteth behavioural metrics and semantic relevance scores.

**Pillar III — The Dashboard**  
An interactive web-based visualisation interface for presenting and exploring analysis results in their full splendour.

---

## Of the Tech Stack

### For the Backend (the Great Engine)

| Component | Technology |
|-----------|------------|
| Tongue | Python 3.11 |
| Web Framework | FastAPI |
| WebRTC | aiortc |
| ASGI Server | uvicorn |
| Speech-to-Text | faster-whisper (small model) |
| Audio Analysis | librosa, webrtcvad |
| Video Processing | OpenCV, MediaPipe |
| LLM Inference | Transformers + PyTorch |
| LLM Quantization | BitsAndBytes (4-bit NF4) |
| Video Codec | ffmpeg, PyAV |

### For the Interview UI

| Component | Technology |
|-----------|------------|
| Backend Server | FastAPI (Python) |
| Real-time Comm. | WebSocket |
| Video/Audio Capture | WebRTC (Browser API) |
| Media Processing | aiortc (Python) |
| Frontend | HTML5, CSS3, JavaScript (ES6+) |

### For the Dashboard

| Component | Technology |
|-----------|------------|
| Frontend Framework | Vanilla JavaScript (ES6 Modules) |
| Routing | Custom SPA Router |
| Data Visualisation | Chart.js 4.4.2 |
| Styling | CSS3 with Custom Properties |

The LLM component employeth **Qwen2.5-3B-Instruct** with 4-bit quantisation, enabling operation upon GPUs of modest VRAM (approximately 3GB) whilst maintaining reasonable inference quality.

---

## Of the Project Structure

```
├── backend/                 # The Great Engine (Pipeline)
│   ├── main.py             # Pipeline orchestration
│   ├── config/             # Configuration module
│   ├── requirements.txt    # Python dependencies
│   ├── src/
│   │   ├── stage0_timebase/      # Stage 0 — Timebase Establishment
│   │   ├── stage1_extraction/    # Stage 1 — Signal Extraction
│   │   │   ├── candidate_audio.py  # Stage 1A
│   │   │   ├── interviewer_audio.py# Stage 1B
│   │   │   └── candidate_video.py  # Stage 1C
│   │   ├── stage2_temporal/      # Stage 2 — Temporal Segmentation
│   │   ├── stage3_behavior/      # Stage 3 — Behavioural Metrics
│   │   ├── stage4_semantic/      # Stage 4 — Semantic Scoring
│   │   └── stage5_aggregation/   # Stage 5 — Verdict Aggregation
│   ├── trans/              # Interview recordings (inputs)
│   ├── jd/                 # Job descriptions
│   ├── output/             # Pipeline JSON outputs
│   └── results/            # Timestamped results
│
├── web_ui/                 # The Interview Recording UI
│   ├── server.py           # FastAPI WebSocket server
│   ├── index.html         # Landing page (role selection)
│   ├── interviewer.html   # Interviewer control panel
│   ├── candidate.html     # Candidate interface
│   ├── interviewer.js     # Interviewer WebRTC client
│   ├── candidate.js       # Candidate WebRTC client
│   └── recordings/        # Stored interview sessions
│
├── docs/
│   ├── photos/            # Dashboard screenshots (1-16)
│   ├── TIPS_Body.tex      # The great tome of documentation
│   └── dfd.py             # Data flow diagram generator
│
├── Interview_scripts/     # LaTeX interview question scripts
│   ├── machine_learning_engineer.tex
│   ├── system_architect.tex
│   └── product_manager.tex
│
├── README.md
└── .gitattributes
```

---

## Of the Six Stages

The pipeline consisteth of six stages, each with its sacred duty:

| Stage | Name | Description |
|-------|------|-------------|
| 0 | **Timebase** | Establisheth canonical time base, synchroniseth all streams |
| 1 | **Extraction** | Three parallel sub-stages extract audio features, video features, and transcriptions |
| 2 | **Temporal** | Groupeth speaking segments, detecteth silence, paireth Q&A |
| 3 | **Behaviour** | Computeth confidence, fluency, eye contact, latency |
| 4 | **Semantic** | Scoreth answer relevance using LLM against Job Description |
| 5 | **Aggregation** | JD-conditioned scoring with chronological accumulation |

### Stage 0 — The Timebase

Stage 0 establisheth the canonical time base that synchroniseth all subsequent processing. This foundational stage extracteth:

- Video metadata (FPS, frame count, duration)
- Audio metadata (sample rate, channel count, duration)
- Timestamp alignment between video and audio streams
- Dataset identification for tracking

All subsequent stages depend upon this timebase, for it is the very foundation upon which the temple of analysis is built.

### Stages 1A, 1B, 1C — Parallel Signal Extraction

Stage 1 representeth the primary data extraction phase, uniquely designed for parallel execution:

**Stage 1A — Candidate Audio Processing**  
Extracteth RMS energy, pitch, voice activity segments, and speech transcription via Faster-Whisper.

**Stage 1B — Interviewer Audio Processing**  
Transcribeth the interviewer's utterances for question identification, with word-level timestamps.

**Stage 1C — Candidate Video Processing**  
Extracteth facial features, head pose estimation (yaw, pitch, roll), and gaze direction from sampled frames.

These three substages run concurrently, maximising throughput whilst minimising total processing time.

### Stage 2 — Temporal Segmentation

Stage 2 combineth the outputs of Stage 1 to create a unified temporal view:

1. **Speaking Segment Detection** — Identifyeth when each party doth speak
2. **Q&A Pairing** — Mapeth interviewer questions to candidate answers using temporal proximity and silence tolerance

The algorithm thus handleth natural interview flow wherein candidates may pause whilst collecting their thoughts.

### Stage 3 — Behavioural Metrics

Stage 3 computeth behavioural metrics for each candidate speaking segment:

**Audio Metrics:**
- Pitch (fundamental frequency) — indicateth confidence
- Energy (RMS) — indicateth assertiveness
- Speech rate — indicateth fluency
- Pause density — indicateth thinking time

**Video Metrics:**
- Face presence ratio — indicateth camera engagement
- Head motion — indicateth nervousness or engagement
- Gaze stability — indicateth eye contact quality

### Stage 4 — Semantic Relevance Scoring

Stage 4 implementeth the core intelligence of TIPS, employing the Qwen2.5-3B-Instruct LLM with 4-bit quantisation to:

- Evaluate semantic relevance between answers and job description (0.0-1.0)
- Extract matched keywords from technical vocabulary
- Assess five competency dimensions:
  - Technical Depth
  - System Design
  - Production Experience
  - Communication Clarity
  - Problem Solving
- Generate incremental verdicts after each question

### Stage 5 — Aggregation and Final Verdict

Stage 5 aggregateth the incremental assessments to render a final hiring recommendation:

**Verdict Options:**
- **STRONG_HIRE** — Exceedeth expectations
- **HIRE** — Meeteth requirements
- **BORDERLINE** — Mixed signals
- **NO_HIRE** — doth not meet requirements

With confidence levels of HIGH, MEDIUM, or LOW, and a natural language justification.

---

## Of the Dashboard

*Behold! The Dashboard, a panoptic vessel wherein the entirety of the candidate's performance shall be laid bare unto the analyst's discerning eye.*

The Dashboard consisteth of five principal views, each presenting different facets of the analysis:

### Session Hub

The grand entryway presenting an overview of the entire interview — candidate name, position sought, and all metadata pertaining to the assessment.

### Temporal Evidence

A scrolling timeline of all utterances, colour-coded by speaker, enabling traversal through the interview's chronology. Click upon any segment, and the video shall reposition itself to that moment whilst the transcript appeareth overlaid upon the visual.

### Metrics & Sigils

Two graphs of great utility:

- **Score Trajectory** — The candidate's performance over time
- **Behavioural Signals** — Three crucial metrics (Vocal Energy, Speech Rate, Gaze Stability), each toggleable at the analyst's pleasure

### The Analysis Chamber

A cornucopia of visualisations:

- **Question-Wise Relevance Score** — Bar graph for each interrogatory
- **Competency Breakdown** — Aggregated performance across all dimensions
- **Keyword Match Heatmap** — Distribution of key terms from the job description
- **Behavioural Distributions** — Confidence levels, fluency scores, response latencies
- **Performance Trajectory** — How performance evolved throughout

### Q&A Review

All question-answer pairs in unified view, each expandable to reveal the full particulars: question, answer, relevance score, behavioural metrics, and competency.

![Session Hub](docs/photos/3.png)
![Temporal Evidence](docs/photos/4.png)
![Score Trajectory](docs/photos/6.png)
![Analysis Section](docs/photos/7.png)
![Q&A Review](docs/photos/14.png)

---

## Of the Interview Recording UI

The Interview Recording UI provides a browser-based interface for conducting video interviews:

- **Landing Page** — Role selection (Interviewer / Candidate)
- **Interviewer Panel** — Start/control interview, view participant status
- **Candidate Interface** — Camera/microphone selection, local recording backup
- **Server-side Recording** — Captures interviewer audio, candidate audio, and candidate video
- **Dark/Light Theme** — Toggle support

The UI producestandardised output files in MP4 (video) and WAV (audio) formats, ensuring consistent input to the backend pipeline.

---

## Of Input & Output

### Input Requirements

The pipeline accepteth the following:

| File | Format | Description |
|------|--------|-------------|
| `candidate_video.mp4` | MP4 (H.264) | Candidate's video feed |
| `candidate_audio.wav` | WAV (48kHz) | Candidate's microphone |
| `interviewer_audio.wav` | WAV (48kHz) | Interviewer's microphone |
| `*.md` | Plain text | Job description |

### Output Artifacts

The pipeline producesthe following JSON files in `backend/output/`:

| File | Description |
|------|-------------|
| `timeline.json` | Master timebase synchronisation |
| `candidate_audio_raw.json` | Audio features + transcription |
| `candidate_video_raw.json` | Video frame features |
| `interviewer_transcript.json` | Interviewer speech-to-text |
| `speaking_segments.json` | Speaking vs silence segments |
| `qa_pairs.json` | Question-answer mappings |
| `candidate_behavior_metrics.json` | Behavioural metrics |
| `relevance_scores.json` | LLM-evaluated relevance scores |
| `candidate_score_timeline.json` | Time-evolving performance scores + final verdict |

---

## Of Setup & Usage

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/macOS
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

#iring interview recordings in trans Run pipeline (requ/ and JD in jd/)
python main.py
```

### Web UI Setup

```bash
cd web_ui

# Install Python dependencies
pip install fastapi uvicorn aiortc av

# Start the server
python server.py --host 0.0.0.0 --port 8000

# Open in browser
# Interviewer: http://localhost:8000/interviewer.html
# Candidate:  http://localhost:8000/candidate.html
```

### Quick Test (with Sample Data)

```bash
# Sample recordings and JDs are included within
cd backend
python main.py
```

---

## Of the Roadmap

- [x] Interview Recording (WebRTC)
- [x] Signal Extraction Pipeline
- [x] Temporal Segmentation
- [x] Behavioural Metrics Computation
- [x] LLM-Powered Semantic Scoring
- [x] Dashboard Visualisation
- [ ] Real-time streaming (contemplated)

---

## License

MIT License — freely use, modify, and distribute this system.

---

## The Final Word

*Thus concludes our discourse upon TIPS — The Temporal Interview Profiling System. May it serve thee well in the noble quest of finding worthy candidates amongst the multitude of applicants. May thy hiring decisions be ever more informed, thy analysis ever more precise, and thy process ever more streamlined.*

*For in the final analysis, the truth shall set thee free — and TIPS shall help thee find it.*

---

## Author

A systems-level exploration of temporal human-computer interaction in the domain of interviews.

*Written in the year of our Lord 2026.*
