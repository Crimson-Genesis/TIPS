i want to build a web based application for interview, 
where this thing happens, 
1. there will be 2 audio source, first of candidates, and secand of interviewer, and a video source of the candidate, 
2. extract the transcript and of the interviewer
3. extract the transcript, when each of the word is said, meta data, frame santance out of the words
4. after extracting both of there transcript map the conversation, like a script, at what time who said what, like that.
5. based on the genrated script in the "4." map out question and answer of the actual interview
6. in the start of the interview the interviewer will put the jd for the job. the application have to judge the candidate.
7. while judgeing the candidate the application should make profile of the candadit, so based on the genrated script, inter... and candadte conversation mapping set in first conversation who is the interviewer and then in secand how he is, then in 3 how he is, and so on until the interview ends or the interviewer turns off the profiling system manually.
8. while all this is happening in the side do the emotion detection on the interviewer with the video feed provided live.
9. then conbine thing with the script and profiling/ judgeing of the candadet and incrimently make the final profile, and keep changing the final verdice for the candadit until the interview is over. and 

---
---

You’re asking for **a full interview intelligence system**, not a “web app”. I’ll be blunt and precise, because hand-waving here will kill the project.

Below is the **correct mental model and technical decomposition**. No opinions, no motivation talk — just what it actually takes.

---

# 1. System overview (what you’re really building)

You are building a **real-time multimodal inference pipeline**:

* **Audio (2 independent speakers)**
* **Video (candidate only)**
* **Natural language understanding**
* **Temporal alignment**
* **Behavioral profiling**
* **Incremental evaluation against a JD**

This is closer to **surveillance + assessment systems** than normal web apps.

---

# 2. Input layer (capture & synchronization)

## Audio

You **must** treat interviewer and candidate audio as **separate streams**.

### Correct setup

* WebRTC
* Two audio tracks:

  * `audio_track_candidate`
  * `audio_track_interviewer`
* One video track:

  * `video_track_candidate`

Do **not** rely on speaker diarization if you already have separate mics. Diarization is error-prone and unnecessary here.

### Required guarantees

* All streams share a **common clock**
* Timestamp at capture time (not after processing)

---

# 3. Transcription with word-level timing (hard requirement)

You need **forced alignment**, not just transcription.

### Correct tools

* Whisper **with word timestamps** OR
* wav2vec2 + CTC forced alignment

### Output format (example)

```json
{
  "speaker": "candidate",
  "words": [
    { "text": "I", "start": 12.34, "end": 12.41 },
    { "text": "worked", "start": 12.41, "end": 12.70 },
    { "text": "on", "start": 12.70, "end": 12.82 },
    { "text": "distributed", "start": 12.82, "end": 13.30 },
    { "text": "systems", "start": 13.30, "end": 13.80 }
  ]
}
```

### Sentence framing

Sentences are **not real** in speech. You infer them using:

* Silence gaps
* Prosody
* Punctuation models

This step **will never be 100% accurate**. Accept that.

---

# 4. Conversation reconstruction (script mapping)

This is deterministic once you have timestamps.

### Algorithm

1. Merge both transcripts into a single timeline
2. Sort by `start_time`
3. Collapse overlapping segments
4. Assign speaker labels

### Final script structure

```json
[
  {
    "start": 5.12,
    "end": 8.91,
    "speaker": "interviewer",
    "text": "Can you explain your experience with distributed systems?"
  },
  {
    "start": 9.20,
    "end": 18.44,
    "speaker": "candidate",
    "text": "I worked on distributed systems for three years..."
  }
]
```

This is the **spine of the entire system**. Everything else attaches to this.

---

# 5. Question–Answer extraction (NLU problem)

This is **semantic classification**, not regex.

### Method

* Treat interviewer utterances as **potential questions**
* Use:

  * Interrogative detection
  * Semantic intent classification
* Link candidate responses by:

  * Temporal proximity
  * Semantic relevance

### Output

```json
{
  "question": "...",
  "answer": "...",
  "confidence": 0.87
}
```

There will be **false links**. You need confidence scores.

---

# 6. JD ingestion and evaluation baseline

JD is not text. It must be **structured**.

### JD processing

Extract:

* Required skills
* Experience level
* Soft skills
* Domain keywords
* Evaluation weights

Example:

```json
{
  "skills": {
    "distributed systems": 0.3,
    "python": 0.2,
    "system design": 0.25,
    "communication": 0.15,
    "problem solving": 0.1
  }
}
```

Without weights, “judging” is meaningless.

---

# 7. Candidate profiling (incremental, turn-based)

This is **stateful inference**.

### Profile is a time series

```json
{
  "t": 120,
  "communication": 0.62,
  "confidence": 0.55,
  "technical_depth": 0.70,
  "consistency": 0.61
}
```

### Update happens:

* After each answer
* Based on:

  * Content quality
  * Alignment with JD
  * Self-consistency over time
  * Overclaim detection

This is **Bayesian updating**, not scoring once at the end.

---

# 8. Emotion detection (video, real-time)

Be very clear:
**Emotion detection is weak and noisy.**

### What you can realistically detect

* Facial action units
* Stress indicators
* Engagement / disengagement
* Arousal (not “emotion”)

### Pipeline

* Face detection
* Landmark tracking
* Temporal CNN / transformer
* Output probabilities, not labels

```json
{
  "time": 34.2,
  "stress": 0.71,
  "engagement": 0.44
}
```

Never treat this as truth. It’s **supporting evidence only**.

---

# 9. Fusion engine (the real brain)

This is the hardest part.

You must combine:

* Text semantics
* Temporal behavior
* JD alignment
* Video-based signals

### Correct approach

* Feature vectors per answer
* Incremental aggregation
* Decay old evidence
* Track uncertainty

### Verdict evolution

```json
{
  "time": 600,
  "hire_probability": 0.63,
  "risk_flags": ["overgeneralization", "stress_spike"],
  "confidence": 0.58
}
```

Final verdict is **a distribution**, not yes/no.

---

# 10. Web architecture (minimal but correct)

### Frontend

* WebRTC
* Live indicators only (no heavy inference)

### Backend (separate services)

1. Audio processing
2. ASR + alignment
3. Script builder
4. Q/A mapper
5. Profiling engine
6. Video emotion pipeline
7. Fusion & verdict engine

If you try to do this monolithically, it will fail.

---

# 11. What will break if you’re careless

* Latency accumulation
* ASR drift
* False emotional inference
* Overconfidence in verdicts
* Legal and ethical issues

This system **must expose uncertainty everywhere**.

---

## Bottom line

What you described is **technically sound**, but it is:

* Research-grade
* Multi-disciplinary
* Not a weekend project
* Not “just AI”

If you want, the *next correct step* is to freeze **one narrow vertical slice** (for example: audio → transcript → script → Q/A) and ignore everything else until it works perfectly.


---
---

i got 10 days, okey i know, what i am doing, and i am really confident in my system / software arch and degin skills okey, 
so we have to make this happen and this is for the minor project, i am building for my mca, 

so lets first build the web interface so ew can get  the  audio and video first, and we just have to show this, 
so we can just use a wifi, to connect 2 laptops, and then in one candidate will sit and in another interviewer will sit, and in the web application there will be option of which, so from there all the data will get connected to the backend and then we can start the backend aprt and for all the code i can use the ai for genrating i and a detailed plane so i thing it will work

---
---

Good. This is the **correct first cut**. For a 10-day MCA minor project, you do **not** build intelligence first. You **prove control over the signals**. If capture + routing is solid, the rest is believable.

Below is the **exact, minimal, correct plan** for **Phase-1: Web Interface + Media Capture**, with zero fantasy.

---

# Phase-1 Goal (non-negotiable)

By the end of this phase, you must be able to:

* Connect **two laptops on the same Wi-Fi**
* Open a **browser-based web app**
* Select role:

  * **Candidate**
  * **Interviewer**
* Achieve:

  * 🎤 Candidate audio → backend
  * 🎤 Interviewer audio → backend
  * 🎥 Candidate video → backend
* Display:

  * Candidate video live
  * Audio activity indicators
* Confirm:

  * Streams are **separate, labeled, timestamped**

Nothing else matters yet.

---

# 1. Architecture (keep it brutally simple)

### Topology

```
Laptop A (Candidate)
 └─ Browser
     ├─ Mic (candidate)
     ├─ Camera
     └─ WebRTC

Laptop B (Interviewer)
 └─ Browser
     ├─ Mic (interviewer)
     └─ WebRTC

Backend (same Wi-Fi IP)
 ├─ Signaling (WebSocket)
 ├─ WebRTC SFU (or peer relay)
 └─ Media ingress (raw tracks)
```

No cloud. No TURN. No scaling.

---

# 2. Technology choices (don’t argue these)

### Frontend

* Plain HTML + JS (or React if you insist)
* WebRTC (`getUserMedia`, `RTCPeerConnection`)
* WebSocket for signaling

### Backend

* Node.js (fastest to wire)
* `ws` for signaling
* `mediasoup` **OR** simple peer relay

If mediasoup feels heavy, you can **direct peer-to-peer** and mirror streams to backend later. For demo, that’s acceptable.

---

# 3. UI requirements (minimal, but clean)

### Single page

* Role selector:

  * Radio: Candidate / Interviewer
* Join button
* Local preview (camera/mic)
* Remote preview (candidate video)
* Status:

  * Connected
  * Audio active (VU meter or simple indicator)

No dashboards. No animations. Professors don’t care.

---

# 4. Media capture logic (critical details)

## Candidate browser

```js
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
});
```

Tracks:

* `stream.getAudioTracks()[0]` → label as `candidate_audio`
* `stream.getVideoTracks()[0]` → label as `candidate_video`

## Interviewer browser

```js
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: false
});
```

Tracks:

* `interviewer_audio`

**Do not mix tracks. Ever.**

---

# 5. WebRTC signaling (bare minimum)

### Events you need

* `join-room`
* `offer`
* `answer`
* `ice-candidate`

That’s it.

Use WebSocket messages like:

```json
{
  "type": "offer",
  "from": "candidate",
  "sdp": "..."
}
```

---

# 6. Stream labeling (this saves you later)

When adding tracks:

```js
pc.addTrack(track, stream);
track.contentHint = "speech"; // audio
track.role = "candidate";     // custom metadata
```

Also send metadata separately to backend:

```json
{
  "track_id": "...",
  "role": "candidate",
  "kind": "audio",
  "timestamp": 1700000000
}
```

This makes **backend ASR trivial later**.

---

# 7. Backend: what it must do now

For Phase-1, backend must only:

* Accept WebSocket connections
* Relay signaling
* Log:

  * Role
  * Track type
  * Connection time

**Do NOT process audio/video yet.**
Just confirm you *can*.

Example log:

```
[JOIN] role=candidate
[TRACK] candidate_audio
[TRACK] candidate_video
[JOIN] role=interviewer
[TRACK] interviewer_audio
```

This log alone is enough to justify the system design.

---

# 8. What NOT to do (this will kill you)

* ❌ Don’t start ASR now
* ❌ Don’t store media yet
* ❌ Don’t attempt emotion detection
* ❌ Don’t over-engineer UI
* ❌ Don’t add auth

Your timeline is 10 days, not 10 weeks.

---

# 9. What you can **show** to the examiner

* Two laptops, same Wi-Fi
* Candidate camera visible on interviewer screen
* Interviewer speaks → audio indicator lights
* Candidate speaks → different indicator lights
* Console logs prove **separate streams**

That alone is a **passable minor project base**.

---

# 10. Next step (after this is working)

Only after this works flawlessly:

**Phase-2**:

> Dump interviewer audio to file → run offline ASR → show transcript.

That’s the next safe vertical slice.

---

You’re not delusional here. This is a **controlled scope** and achievable in 10 days **if you don’t jump ahead**.
Build the capture spine first. Everything else hangs from it.

---
---

 as i was saying will be doing the backend in python because of the ml / nn part so can't we use django or that will be slower or bad for some reason ?


---
---

Short answer first, with no sugar-coating:

**Yes, you can use Django.
No, Django is not the right tool for the real-time media part.
That does not mean Django is “bad” or “slow”.**

Now the precise breakdown.

---

## 1. What Django is actually good at (facts)

Django is excellent for:

* HTTP APIs
* User/session management
* Database models
* Admin panels
* Offline or async ML inference
* Long-running background tasks (via Celery / RQ)

Django is **not designed** for:

* Real-time media transport
* Low-latency signaling loops
* Handling RTP/RTCP streams
* Tight event-loop control

This is architectural, not performance-shaming.

---

## 2. The core problem: WebRTC ≠ HTTP

WebRTC needs:

* Persistent connections
* Fast signaling
* Non-blocking event loops
* Precise control over media tracks

Classic Django:

* Is request/response oriented
* Sits on WSGI (blocking by design)

Even with ASGI:

* Django is still a **framework on top of the loop**
* You don’t want that overhead in your media path

---

## 3. The correct Python stack for your case

### Use **two layers**, not one

```
[ Browser ]
     ↓
WebRTC
     ↓
[ Python Real-Time Media Layer ]
     ↓
Async Queue / IPC
     ↓
[ Django (ML, DB, Logic) ]
```

This separation is **non-negotiable** if you want sanity.

---

## 4. What to use instead of Django for media

### Option A (recommended for 10 days)

**FastAPI + aiortc**

Why:

* Native ASGI
* Minimal overhead
* Clean async
* aiortc is Python-first WebRTC

This handles:

* Signaling
* Media track ingestion
* Audio/video frame access

### Option B (harder, but powerful)

**Standalone aiortc service + Django**

Use:

* aiortc service → media
* Django → everything else

Communicate via:

* Redis
* ZeroMQ
* asyncio.Queue
* UNIX socket

---

## 5. Where Django fits perfectly in your system

Django should handle:

* Interview session metadata
* Role assignment (candidate/interviewer)
* JD storage
* Transcript storage
* Candidate profile state
* Final verdict persistence
* Admin/debug UI

**Django never touches raw audio/video.**

---

## 6. Performance truth (no myths)

* Django is not “slow”
* Django is just **wrong abstraction** for streaming
* Real-time media failures are **latency + blocking**, not CPU

Even a fast server fails if the event loop stalls.

---

## 7. Minimal viable setup (your project)

### Backend services

1. **Media Service (Python)**

   * FastAPI
   * aiortc
   * WebSocket signaling
2. **Logic Service (Django)**

   * REST APIs
   * ML inference
   * Profile state

You can run both on the **same machine**.

---

## 8. What happens if you ignore this advice

If you put WebRTC inside Django:

* ICE negotiation will randomly fail
* Audio will jitter
* Video will freeze under load
* Debugging will waste days
* Demo will be fragile

For a minor project, fragility is death.

---

## Bottom line

* **Yes**, Python backend is correct
* **No**, Django should not handle WebRTC
* **Yes**, Django is perfect for ML + evaluation
* **Use FastAPI + aiortc for real-time**

This is the cleanest, fastest, least-risk path in 10 days.

Next logical step:
**I can give you the exact FastAPI + aiortc signaling skeleton**, ready to run on LAN, if you want to lock this down immediately.

---
---

bottom line what u suggest i use, from what i under, 
i will be using python for this 
Audio (2 independent speakers)

Video (candidate only)

Natural language understanding

Temporal alignment

Behavioral profiling

Incremental evaluation against a JD

and 

now i have to have a ui interface for the interview, really simple one, 
and then i will have to have a ui for the dashboard for the processed data for the interview, 

so for this 2 u are sugesting i should go for the webrtc for the interview ui and django for the dashboard rigth 

---
---

Yes. Your understanding is **correct**. I’ll lock it down cleanly and precisely so there’s no ambiguity later.

---

## Final, correct stack (for your project constraints)

### Language

* **Python only** on the backend
  This is the right choice given ML / NN requirements.

---

## 1. Interview UI (real-time media)

### Purpose

* Capture:

  * Candidate audio
  * Interviewer audio
  * Candidate video
* Stream live
* No heavy processing here

### What to use

* **WebRTC in the browser**
* **FastAPI + aiortc** on the backend

### Why

* WebRTC is the only sane way to do low-latency audio/video in browsers
* aiortc is the only mature Python WebRTC stack
* FastAPI gives clean async signaling without framework overhead

### This part does **only**:

* Signaling
* Media transport
* Track labeling
* Timestamping
* (Optionally) dumping raw audio/video to disk

Nothing else.

---

## 2. Dashboard UI (processed interview data)

### Purpose

* Show:

  * Transcript
  * Speaker timeline
  * Q/A pairs
  * Candidate profile evolution
  * Final verdict vs JD
* No real-time constraints

### What to use

* **Django**

### Why

* Strong ORM
* Easy models for interviews, turns, scores
* Clean admin panel (huge win for viva)
* Easy REST APIs for frontend
* Async ML inference works fine here

---

## 3. How they connect (important)

```
[ Browser (Interview UI) ]
        ↓ WebRTC
[ FastAPI + aiortc ]
        ↓ async queue / files / Redis
[ Django Backend ]
        ↓
[ Dashboard UI ]
```

* FastAPI handles **live**
* Django handles **thinking**
* They do not block each other

You can even run both on:

```
localhost:8000 (FastAPI)
localhost:9000 (Django)
```

Same Wi-Fi. Same machine.

---

## 4. Frontend split (keep it simple)

### Interview UI

* Plain HTML + JS
* Two pages:

  * `/candidate`
  * `/interviewer`
* Role selection
* Video preview
* Audio indicator

### Dashboard UI

* Django templates **or**
* React/Vue talking to Django REST

For MCA, Django templates are enough.

---

## 5. Mapping your listed requirements to the stack

| Requirement          | Where it lives                     |
| -------------------- | ---------------------------------- |
| Audio (2 speakers)   | WebRTC + aiortc                    |
| Video (candidate)    | WebRTC + aiortc                    |
| Transcription        | Django (offline / async)           |
| Word timestamps      | Django (ASR + alignment)           |
| Conversation mapping | Django                             |
| Q/A extraction       | Django                             |
| JD evaluation        | Django                             |
| Profiling            | Django                             |
| Emotion detection    | Django (video frames from FastAPI) |
| Final verdict        | Django                             |
| Interview UI         | WebRTC frontend                    |
| Dashboard UI         | Django                             |

This mapping is **correct**.

---

## 6. What you should NOT do

* Do **not** merge FastAPI and Django into one app
* Do **not** process ML inside WebRTC callbacks
* Do **not** build dashboard before capture works
* Do **not** attempt real-time ASR in Phase-1

---

## 7. Verdict (strict, factual)

✔ Yes — **WebRTC + FastAPI** for interview UI
✔ Yes — **Django** for dashboard and ML
✔ Yes — **Python everywhere**
✔ Yes — feasible in **10 days** if scoped correctly

This is the **cleanest, lowest-risk architecture** for what you described.

---

Next correct step (no skipping):
**Define the exact endpoints and message formats between FastAPI and Django.**
That’s where most projects silently fail.

---
---

1st give me the tech stack and all the thing we will have to do in the interview ui, and order and well structered

---
---

Below is the **locked, minimal, correct plan** for the **Interview UI** only.
No ML, no Django, no dashboard — just **capture + stream + label**.
This is structured in **execution order**, not theory.

---

# INTERVIEW UI — TECH STACK & TASK BREAKDOWN

---

## 1. Tech stack (do not deviate)

### Frontend (Interview UI)

* HTML5
* CSS (minimal)
* Vanilla JavaScript
* WebRTC APIs:

  * `getUserMedia`
  * `RTCPeerConnection`
* WebSocket (for signaling)

### Backend (Media / Signaling)

* Python 3.10+
* FastAPI
* `uvicorn`
* `aiortc`
* `websockets` (or FastAPI WebSocket)

### Network

* Same Wi-Fi (LAN)
* No TURN server
* STUN optional (can skip on LAN)

---

## 2. Interview UI pages (fixed)

You will build **two pages only**.

### Page 1: Candidate

**URL:** `/candidate`

Purpose:

* Capture **audio + video**
* Send to backend
* Preview own video

UI elements:

* Start / Stop button
* Local video preview
* Connection status
* Audio activity indicator

---

### Page 2: Interviewer

**URL:** `/interviewer`

Purpose:

* Capture **audio only**
* Receive candidate video
* Send audio to backend

UI elements:

* Start / Stop button
* Candidate video view
* Connection status
* Audio activity indicator

---

## 3. Media capture logic (must be exact)

### Candidate

```js
getUserMedia({
  audio: true,
  video: true
})
```

Tracks:

* `candidate_audio`
* `candidate_video`

---

### Interviewer

```js
getUserMedia({
  audio: true,
  video: false
})
```

Tracks:

* `interviewer_audio`

---

## 4. WebRTC architecture (simple and safe)

### Model

* **Browser ↔ FastAPI (aiortc)**

FastAPI acts as:

* Signaling server
* Media endpoint
* Track collector

No peer-to-peer between browsers (simplifies demo).

---

## 5. Signaling flow (order matters)

### Step 1: Open WebSocket

```text
Browser → FastAPI
```

### Step 2: Send role

```json
{
  "type": "join",
  "role": "candidate"
}
```

### Step 3: Offer / Answer exchange

* Browser creates offer
* Backend replies with answer

### Step 4: ICE candidates exchange

* Until connection established

---

## 6. Track labeling (non-optional)

When sending tracks:

```js
pc.addTrack(track, stream);
```

Also send metadata:

```json
{
  "type": "track_meta",
  "role": "candidate",
  "kind": "audio",
  "track_id": "abc123"
}
```

Backend stores:

* Role
* Track ID
* Start timestamp

---

## 7. Backend responsibilities (Interview UI phase)

FastAPI must:

* Accept WebSocket connections
* Handle SDP offer/answer
* Register tracks via aiortc
* Log:

  * Role
  * Track type
  * Start time
* Optionally:

  * Save raw audio/video frames to disk

**No processing. No ML. No ASR.**

---

## 8. Data artifacts to produce (for later phases)

After an interview session, you must have:

* `candidate_audio.wav`
* `interviewer_audio.wav`
* `candidate_video.mp4`
* `session_meta.json`

Example:

```json
{
  "session_id": "xyz",
  "tracks": {
    "candidate_audio": "candidate.wav",
    "interviewer_audio": "interviewer.wav",
    "candidate_video": "candidate.mp4"
  },
  "start_time": 1700000000
}
```

This proves your pipeline is real.

---

## 9. UI success criteria (exam-proof)

Your Interview UI is **complete** if:

* Two laptops connect on LAN
* Candidate video appears on interviewer screen
* Candidate and interviewer audio are separate
* Backend logs show correct role mapping
* Media files are saved correctly

Nothing else is required at this stage.

---

## 10. Build order (follow this exactly)

1. FastAPI app starts
2. WebSocket signaling works
3. Candidate page connects
4. Interviewer page connects
5. Audio works
6. Video works
7. Track labeling confirmed
8. Media saved to disk

If any step breaks, **do not move forward**.

---

## Final truth

This Interview UI alone is already:

* Technically non-trivial
* Demonstrable
* Defensible in viva
* A solid foundation for your ML phases

Next step after this (only after):
**Offline transcription from saved audio.**

If you want, I can now give you:

* Folder structure
* FastAPI + aiortc minimal skeleton
* Frontend JS for offer/answer

---
---

next give me same for the backend part the ml and processing one


---
---

Below is the **same kind of locked, structured, execution-order plan** — but now **only for the backend ML + processing system**.
This assumes **Interview UI already works and produces files**. No overlap.

No hype. No theory dump. This is a **build plan**.

---

# BACKEND ML & PROCESSING PIPELINE

*(Post-Interview Intelligence System)*

---

## 0. Scope control (critical)

This backend **does NOT**:

* Handle WebRTC
* Handle live media
* Handle UI for interview

This backend **ONLY**:

* Consumes recorded data
* Processes it step-by-step
* Produces structured intelligence
* Feeds the dashboard

---

## 1. Tech stack (locked)

### Core backend

* **Python 3.10+**
* **Django**
* Django REST Framework (DRF)

### ML / Processing

* PyTorch
* Whisper / faster-whisper
* Forced alignment (Whisper timestamps or CTC)
* spaCy / transformers (light usage)

### Data / Async

* PostgreSQL or SQLite (SQLite OK for MCA)
* Celery **or** simple background worker
* File-based pipeline (acceptable)

### Storage

* Local filesystem
* Structured JSON artifacts

---

## 2. Backend architecture (conceptual)

```
Media Files
   ↓
ASR + Alignment
   ↓
Sentence Framing
   ↓
Conversation Script
   ↓
Q/A Mapping
   ↓
JD Evaluation
   ↓
Profiling (Incremental)
   ↓
Final Verdict
   ↓
Dashboard API
```

Each box = **separate module**.

---

## 3. Data model (Django side)

### Core entities (minimum)

#### InterviewSession

* id
* start_time
* end_time
* jd_text
* status

#### MediaAsset

* session
* type (candidate_audio / interviewer_audio / video)
* file_path

#### TranscriptWord

* session
* speaker
* word
* start_time
* end_time

#### ScriptTurn

* session
* speaker
* start_time
* end_time
* text

#### QuestionAnswer

* session
* question
* answer
* confidence

#### CandidateProfileSnapshot

* session
* timestamp
* scores (JSON)

#### FinalVerdict

* session
* score
* risk_flags
* confidence

This schema alone impresses examiners.

---

## 4. Processing pipeline (execution order)

### STEP 1 — Audio preprocessing

Inputs:

* `candidate_audio.wav`
* `interviewer_audio.wav`

Actions:

* Normalize
* Convert to mono
* Ensure sample rate consistency

Outputs:

* Clean WAV files

---

### STEP 2 — Transcription + word timestamps

Tool:

* Whisper (with word timestamps)

Output:

```json
[
  {
    "speaker": "candidate",
    "word": "worked",
    "start": 12.41,
    "end": 12.70
  }
]
```

Store:

* One row per word
* This is **ground truth timeline**

---

### STEP 3 — Sentence framing

Input:

* Word stream

Method:

* Silence gaps
* Punctuation inference
* Time thresholds

Output:

```json
{
  "speaker": "interviewer",
  "start": 5.12,
  "end": 8.91,
  "text": "Can you explain your experience?"
}
```

Stored as `ScriptTurn`.

---

### STEP 4 — Conversation script construction

Action:

* Merge both speakers
* Sort by start time
* Resolve overlaps

Final product:

```text
[00:05] Interviewer: ...
[00:09] Candidate: ...
```

This is the **spine of the system**.

---

## 5. Question–Answer mapping

### Logic

* Interviewer turns → candidate questions
* Candidate turns → candidate answers

Use:

* Interrogative detection
* Semantic similarity
* Temporal proximity

Output:

```json
{
  "question": "...",
  "answer": "...",
  "confidence": 0.82
}
```

Store as `QuestionAnswer`.

---

## 6. JD ingestion and structuring

### Input

Raw JD text (entered at interview start)

### Processing

Extract:

* Required skills
* Keywords
* Experience level
* Weights

Output:

```json
{
  "distributed systems": 0.3,
  "python": 0.2,
  "communication": 0.2
}
```

Stored once per session.

---

## 7. Candidate profiling (incremental)

### Profile dimensions (minimum)

* Technical depth
* Relevance to JD
* Clarity
* Consistency
* Confidence (linguistic, not emotion)

### Update rule

After **each answer**:

* Compute features
* Update rolling score
* Store snapshot

Example:

```json
{
  "time": 420,
  "technical_depth": 0.71,
  "clarity": 0.64
}
```

This shows **incremental judgment**, which examiners love.

---

## 8. Emotion / behavior analysis (video)

Be precise:
You detect **behavioral signals**, not emotions.

### Inputs

* Candidate video frames

### Extract

* Face presence
* Gaze stability
* Head movement
* Stress indicators

Output:

```json
{
  "time": 310,
  "stress": 0.68,
  "engagement": 0.52
}
```

Attach to profile snapshots as **weak signals**.

---

## 9. Fusion & verdict engine

### Inputs

* Q/A quality
* JD alignment
* Profile trajectory
* Behavioral signals

### Output (incremental)

```json
{
  "hire_probability": 0.63,
  "risk_flags": ["overclaiming"],
  "confidence": 0.58
}
```

Final verdict stored when session ends.

---

## 10. Dashboard API (Django REST)

Endpoints:

* `/session/{id}/script`
* `/session/{id}/qa`
* `/session/{id}/profile`
* `/session/{id}/verdict`

Frontend only **reads** data.

---

## 11. Build order (strict)

1. Django project + models
2. Load media files
3. ASR + word timestamps
4. Script generation
5. Q/A extraction
6. JD parsing
7. Profiling logic
8. Final verdict
9. Dashboard views

Do **not** reorder this.

---

## Final truth

What you are building backend-side is:

* Deterministic
* Modular
* Explainable
* Defensible in viva

This is **not fake AI**. It’s a real inference pipeline.

Next logical step:
**I can give you a day-wise 10-day execution plan**, mapping Interview UI + Backend milestones so you don’t miss submission.

---
---

now the django dashboard one same format 

---
---

Below is the **locked, structured, execution-order plan** for the **Django Dashboard** only.
Same format as before. No overlap with interview UI or ML pipeline logic.

This dashboard is **read-only intelligence visualization + control**, not processing.

---

# DJANGO DASHBOARD — TECH STACK & TASK BREAKDOWN

---

## 0. Scope definition (strict)

The **Dashboard** does **NOT**:

* Capture audio/video
* Run WebRTC
* Run ASR or ML pipelines

The **Dashboard ONLY**:

* Reads processed data
* Visualizes interview intelligence
* Shows evolution over time
* Allows limited manual control (start/stop profiling)

---

## 1. Tech stack (locked)

### Backend

* Python 3.10+
* Django
* Django REST Framework (DRF)

### Frontend (Dashboard UI)

Choose **one**:

* Django Templates (recommended for MCA)
* OR React (only if you already know it well)

### Data

* SQLite (enough for minor project)
* JSON fields for scores and profiles

---

## 2. Dashboard structure (pages)

You will build **exactly 5 dashboard views**.

---

### Page 1 — Interview Sessions List

**URL:** `/dashboard/sessions`

Purpose:

* Show all interview sessions
* Entry point for evaluation

Fields:

* Session ID
* Date
* Status (processing / completed)
* Final score (if available)

Actions:

* View session

---

### Page 2 — Interview Timeline (Script View)

**URL:** `/dashboard/session/<id>/script`

Purpose:

* Show **who said what, when**

Display:

```
[00:05] Interviewer: Can you explain your experience?
[00:09] Candidate: I worked on distributed systems...
```

Features:

* Chronological order
* Speaker color-coded
* Timestamped

This page **proves temporal alignment**.

---

### Page 3 — Question / Answer Analysis

**URL:** `/dashboard/session/<id>/qa`

Purpose:

* Show extracted interview structure

Display:

* Question
* Linked answer
* Confidence score

Example:

```
Q: Explain your experience with Python
A: I have used Python for 3 years...
Confidence: 0.82
```

---

### Page 4 — Candidate Profile Evolution

**URL:** `/dashboard/session/<id>/profile`

Purpose:

* Show **incremental judgment**

Display:

* Table or simple chart:

  * Technical depth
  * JD relevance
  * Clarity
  * Consistency
* Each row = snapshot over time

Example:

```
Time   Tech  Clarity  Relevance
120s   0.62   0.58     0.60
240s   0.68   0.61     0.65
```

This page is **key for viva**.

---

### Page 5 — Final Verdict

**URL:** `/dashboard/session/<id>/verdict`

Purpose:

* Summarize decision

Display:

* Final hire probability
* Risk flags
* Confidence level
* JD alignment breakdown

Example:

```
Hire Probability: 63%
Risk Flags: Overgeneralization
Confidence: Medium
```

---

## 3. Django apps structure (clean)

```
dashboard/
├── models.py
├── views.py
├── serializers.py
├── urls.py
├── templates/
│   └── dashboard/
│       ├── sessions.html
│       ├── script.html
│       ├── qa.html
│       ├── profile.html
│       └── verdict.html
```

One app is enough.

---

## 4. Data flow into dashboard

### Source

* Data produced by ML backend
* Stored in Django DB or JSON files

### Dashboard role

* **Read-only**
* No inference
* No recomputation

This separation keeps the system defensible.

---

## 5. REST APIs (internal use)

You will expose APIs even if using templates (good practice).

Examples:

* `GET /api/session/<id>/script`
* `GET /api/session/<id>/qa`
* `GET /api/session/<id>/profile`
* `GET /api/session/<id>/verdict`

Templates or frontend consume these.

---

## 6. Manual controls (minimal, optional)

Allowed controls:

* Toggle profiling ON/OFF
* Mark interview as completed
* Add examiner comment

Do **not** add editing of scores.

---

## 7. Visualization rules (keep it simple)

* Tables > charts
* No animations
* No real-time updates
* Clear labels and timestamps

Examiners value **clarity**, not flash.

---

## 8. Build order (do not skip)

1. Django project setup
2. Models defined
3. Admin panel working
4. Sessions list page
5. Script view
6. Q/A view
7. Profile view
8. Verdict view
9. Polish UI

---

## 9. Success criteria (exam-proof)

Dashboard is **complete** if:

* You can open a session
* See full conversation timeline
* See Q/A mapping
* See profile evolution
* See final verdict

No live inference required.

---

## Final truth

This dashboard:

* Makes your system explainable
* Makes evaluation transparent
* Turns raw ML output into **academic evidence**

For an MCA minor project, this is **more than sufficient** and technically sound.

---

Next logical step (if you want):

* **Folder structure for the entire project**
* **10-day execution plan**
* **Exact Django models + serializers**

Say which one.

---
---
