# TIPS — Temporal Interview Profiling System

[![Python 3.11](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-00.svg)](https://fastapi.tiangolo.com/)
[![WebRTC](https://img.shields.io/badge/WebRTC-aiortc-green.svg)](https://aiortc.readthedocs.io/)

TIPS is an automated interview analysis system that processes recorded video interviews, extracts behavioral signals from audio and video, evaluates answer relevance using LLMs, and produces time-evolving candidate scores against job descriptions.

---

## Overview

TIPS combines browser-based interview recording with a multi-stage backend pipeline that processes the interview data:

1. **Interview Recording** — Browser-based video/audio interview via WebRTC with server-side recording
2. **Signal Extraction** — Audio features, video features, and speech-to-text transcription
3. **Temporal Segmentation** — Speaking segments, silence detection, and Q&A pairing
4. **Behavioral Metrics** — Confidence, fluency, eye contact, and response latency
5. **Semantic Scoring** — LLM-powered relevance evaluation against job descriptions
6. **Score Aggregation** — JD-conditioned scoring with chronological accumulation

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Web UI        │     │  Backend Pipeline │     │   JSON Outputs  │
│ (Recording)     │────▶│  (6-Stage)        │────▶│   (Timeline,    │
│                 │     │                  │     │    Scores, etc) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Tech Stack

### Backend
- **Python 3.11** — Core runtime
- **FastAPI** — Web server framework
- **aiortc** — WebRTC implementation
- **uvicorn** — ASGI server
- **faster-whisper** — Speech-to-text
- **librosa** — Audio feature extraction
- **opencv-python** — Video processing
- **mediapipe** — Face/pose detection
- **transformers + torch** — LLM-based semantic scoring
- **webrtcvad** — Voice activity detection

### Frontend
- **JavaScript** — Client-side WebRTC
- **HTML/CSS** — Interviewer and candidate interfaces

### Infrastructure
- **ffmpeg** — Audio/video processing
- **Git LFS** — Large file storage for recordings

---

## Project Structure

```
├── backend/                 # Interview processing pipeline
│   ├── main.py             # Pipeline orchestration
│   ├── main_1.py           # Alternative orchestration
│   ├── config/             # Configuration module
│   ├── requirements.txt    # Python dependencies
│   ├── src/
│   │   ├── stage0_timebase/      # Time base establishment
│   │   ├── stage1_extraction/    # Signal extraction
│   │   ├── stage2_temporal/      # Temporal segmentation
│   │   ├── stage3_behavior/      # Behavioral metrics
│   │   ├── stage4_semantic/      # Relevance scoring
│   │   └── stage5_aggregation/   # Score aggregation
│   ├── trans/              # Interview recordings input
│   ├── jd/                 # Job descriptions
│   ├── output/             # Pipeline JSON outputs
│   └── results/            # Timestamped results
│
├── web_ui/                 # WebRTC interview interface
│   ├── server.py           # FastAPI WebSocket server
│   ├── index.html         # Landing page (role selection)
│   ├── interviewer.html   # Interviewer control panel
│   ├── candidate.html     # Candidate interface
│   ├── interviewer.js     # Interviewer WebRTC client
│   ├── candidate.js       # Candidate WebRTC client
│   └── recordings/        # Stored interview sessions
│
├── Interview_scripts/      # LaTeX interview question scripts
│   ├── machine_learning_engineer.tex
│   ├── system_architectonic.tex
│   └── product_manager.tex
│
├── README.md
└── .gitattributes
```

---

## Pipeline Stages

| Stage | Name | Description |
|-------|------|-------------|
| 0 | Timebase | Establish canonical time base from video file |
| 1 | Extraction | Extract audio features, video features, and transcriptions |
| 2 | Temporal | Group speaking segments, detect silence, pair Q&A |
| 3 | Behavior | Compute confidence, fluency, eye contact, latency |
| 4 | Semantic | Score answer relevance using LLM against JD |
| 5 | Aggregation | JD-conditioned scoring with chronological accumulation |

---

## Web UI

The web UI provides a browser-based interview interface:

- **Landing Page** — Role selection (Interviewer / Candidate)
- **Interviewer Panel** — Start/control interview, view participant status
- **Candidate Interface** — Camera/microphone selection, local recording backup
- **Server-side Recording** — Captures interviewer audio, candidate audio, and candidate video
- **Dark/Light Theme** — Toggle support

## Interview Scripts

Pre-built LaTeX interview scripts for testing:

- **Machine Learning Engineer** — ML fundamentals, system design, practical applications
- **System Architect** — Distributed systems, scalability, architecture patterns
- **Product Manager** — Product sense, execution, leadership

---

## Setup & Usage

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/macOS
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Run pipeline (requires interview recordings in trans/ and JD in jd/)
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

### Quick Test (with sample data)

```bash
# Sample recordings and JDs are included in the repo
cd backend
python main.py
```

---

## Output Artifacts

The pipeline produces JSON files in `backend/output/`:

| File | Description |
|------|-------------|
| `timeline.json` | Master timebase synchronization |
| `candidate_audio_raw.json` | Audio features + transcription |
| `candidate_video_raw.json` | Video frame features |
| `interviewer_transcript.json` | Interviewer speech-to-text |
| `speaking_segments.json` | Speaking vs silence segments |
| `qa_pairs.json` | Question-answer mappings |
| `candidate_behavior_metrics.json` | Behavioral metrics (confidence, fluency, etc.) |
| `relevance_scores.json` | LLM-evaluated relevance scores |
| `candidate_score_timeline.json` | Time-evolving performance scores |

---

## Roadmap

- [x] Interview recording (WebRTC)
- [x] Signal extraction pipeline
- [x] Temporal segmentation
- [x] Behavioral metrics computation
- [x] LLM-powered semantic scoring
- [ ] Dashboard visualization (planned)

---

## License

MIT License

---

## Author

Systems-level exploration of temporal human-computer interaction in interviews.
