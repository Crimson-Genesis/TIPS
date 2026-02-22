# server.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
from aiortc import (
    RTCPeerConnection,
    RTCSessionDescription,
    MediaStreamTrack,
    RTCIceCandidate,
)
from aiortc.contrib.media import MediaRecorder, MediaRelay
from pathlib import Path
import uuid
import av
import time
import subprocess
import shutil
from typing import Optional
from fractions import Fraction

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get the directory where server.py is located
_BASE_DIR = Path(__file__).parent
recordings_dir = _BASE_DIR / "recordings"
recordings_dir.mkdir(exist_ok=True)


class SynchronizedVideoTrack(MediaStreamTrack):
    """
    A video track that uses frame count for perfectly consistent timing.
    """

    kind = "video"

    def __init__(self, track: MediaStreamTrack):
        super().__init__()
        self.track = track
        self.frame_count = 0
        self.fps = 30
        self.time_base = Fraction(1, 90000)  # 90kHz for video

    async def recv(self):
        frame = await self.track.recv()

        # Set PTS based on frame count for perfect 30fps timing
        frame.pts = int(self.frame_count * 90000 / self.fps)
        frame.time_base = self.time_base

        self.frame_count += 1
        return frame


class SynchronizedAudioTrack(MediaStreamTrack):
    """
    An audio track that uses sample count for perfectly consistent timing.
    """

    kind = "audio"

    def __init__(self, track: MediaStreamTrack):
        super().__init__()
        self.track = track
        self.sample_count = 0
        self.sample_rate = 48000
        self.time_base = Fraction(1, 48000)  # 48kHz for audio

    async def recv(self):
        frame = await self.track.recv()

        # Set PTS based on sample count
        frame.pts = self.sample_count
        frame.time_base = self.time_base

        # Increment by actual samples in this frame
        if hasattr(frame, "samples"):
            self.sample_count += frame.samples
        else:
            self.sample_count += 960  # Default 20ms frame at 48kHz

        return frame


class RoomState:
    IDLE = "IDLE"
    INTERVIEWER_CONNECTED = "INTERVIEWER_CONNECTED"
    BOTH_CONNECTED = "BOTH_CONNECTED"
    RECORDING = "RECORDING"


class Room:
    def __init__(self):
        self.state = RoomState.IDLE
        self.interviewer_ws = None
        self.candidate_ws = None
        self.interviewer_pc = None
        self.candidate_pc = None
        self.interviewer_recorder = None
        self.candidate_audio_recorder = None
        self.candidate_video_recorder = None
        self.interviewer_audio_track = None
        self.candidate_audio_track = None
        self.candidate_video_track = None
        self.normalized_candidate_video_track = None
        self.normalized_interviewer_audio_track = None
        self.normalized_candidate_audio_track = None
        self.session_id = None
        self.should_close = False
        self.recording_start_time = None

    def reset(self):
        self.state = RoomState.IDLE
        self.interviewer_ws = None
        self.candidate_ws = None
        self.interviewer_pc = None
        self.candidate_pc = None
        self.interviewer_recorder = None
        self.candidate_audio_recorder = None
        self.candidate_video_recorder = None
        self.interviewer_audio_track = None
        self.candidate_audio_track = None
        self.candidate_video_track = None
        self.normalized_candidate_video_track = None
        self.normalized_interviewer_audio_track = None
        self.normalized_candidate_audio_track = None
        self.session_id = None
        self.should_close = False
        self.recording_start_time = None


room = Room()


async def broadcast_state():
    state_msg = json.dumps({"type": "state-update", "state": room.state})
    if room.interviewer_ws:
        try:
            await room.interviewer_ws.send_text(state_msg)
        except:
            pass
    if room.candidate_ws:
        try:
            await room.candidate_ws.send_text(state_msg)
        except:
            pass


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    role = None

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            msg_type = msg.get("type")

            if msg_type == "join-interviewer":
                if room.state != RoomState.IDLE:
                    await websocket.send_text(
                        json.dumps({"type": "error", "message": "Room occupied"})
                    )
                    await websocket.close()
                    return

                role = "interviewer"
                room.interviewer_ws = websocket
                room.interviewer_pc = RTCPeerConnection()

                @room.interviewer_pc.on("track")
                def on_track(track):
                    if track.kind == "audio":
                        room.interviewer_audio_track = track

                @room.interviewer_pc.on("connectionstatechange")
                async def on_conn_state():
                    if (
                        room.interviewer_pc
                        and room.interviewer_pc.connectionState == "failed"
                    ):
                        await cleanup_interviewer()

                room.state = RoomState.INTERVIEWER_CONNECTED
                await broadcast_state()
                await websocket.send_text(
                    json.dumps({"type": "joined", "role": "interviewer"})
                )

            elif msg_type == "join-candidate":
                if room.state != RoomState.INTERVIEWER_CONNECTED:
                    await websocket.send_text(
                        json.dumps(
                            {"type": "error", "message": "Interviewer not connected"}
                        )
                    )
                    await websocket.close()
                    return

                role = "candidate"
                room.candidate_ws = websocket
                room.candidate_pc = RTCPeerConnection()

                @room.candidate_pc.on("track")
                def on_track(track):
                    if track.kind == "audio":
                        room.candidate_audio_track = track
                    elif track.kind == "video":
                        room.candidate_video_track = track

                @room.candidate_pc.on("connectionstatechange")
                async def on_conn_state():
                    if (
                        room.candidate_pc
                        and room.candidate_pc.connectionState == "failed"
                    ):
                        await cleanup_candidate()

                room.state = RoomState.BOTH_CONNECTED
                await broadcast_state()
                await websocket.send_text(
                    json.dumps({"type": "joined", "role": "candidate"})
                )

            elif msg_type == "offer":
                if role == "interviewer" and room.interviewer_pc:
                    offer = RTCSessionDescription(sdp=msg["sdp"], type=msg["sdpType"])
                    await room.interviewer_pc.setRemoteDescription(offer)
                    answer = await room.interviewer_pc.createAnswer()
                    await room.interviewer_pc.setLocalDescription(answer)
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "answer",
                                "sdp": room.interviewer_pc.localDescription.sdp,
                                "sdpType": room.interviewer_pc.localDescription.type,
                            }
                        )
                    )
                elif role == "candidate" and room.candidate_pc:
                    offer = RTCSessionDescription(sdp=msg["sdp"], type=msg["sdpType"])
                    await room.candidate_pc.setRemoteDescription(offer)
                    answer = await room.candidate_pc.createAnswer()
                    await room.candidate_pc.setLocalDescription(answer)
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "answer",
                                "sdp": room.candidate_pc.localDescription.sdp,
                                "sdpType": room.candidate_pc.localDescription.type,
                            }
                        )
                    )

            elif msg_type == "ice-candidate":
                candidate_data = msg.get("candidate")
                if candidate_data and candidate_data.get("candidate"):
                    try:
                        from aiortc.sdp import candidate_from_sdp

                        ice_candidate = candidate_from_sdp(candidate_data["candidate"])
                        ice_candidate.sdpMid = candidate_data.get("sdpMid")
                        ice_candidate.sdpMLineIndex = candidate_data.get(
                            "sdpMLineIndex"
                        )

                        if role == "interviewer" and room.interviewer_pc:
                            await room.interviewer_pc.addIceCandidate(ice_candidate)
                        elif role == "candidate" and room.candidate_pc:
                            await room.candidate_pc.addIceCandidate(ice_candidate)
                    except Exception as e:
                        print(f"ICE candidate error: {e}")

            elif msg_type == "start-recording":
                if role == "interviewer" and room.state == RoomState.BOTH_CONNECTED:
                    existing_files = list(recordings_dir.glob("*"))
                    interview_numbers = []
                    for f in existing_files:
                        parts = f.stem.split("-")
                        if len(parts) >= 1 and parts[0].isdigit():
                            interview_numbers.append(int(parts[0]))

                    next_interview_number = max(interview_numbers, default=0) + 1

                    # Use consistent timestamp format matching client-side
                    from datetime import datetime

                    now = datetime.now()
                    timestamp = now.strftime("%Y%m%d_%H%M%S")
                    room.session_id = timestamp

                    # Set global recording start time
                    room.recording_start_time = time.time()

                    # Create synchronized tracks (NO recording_start_time parameter needed)
                    if room.interviewer_audio_track:
                        room.normalized_interviewer_audio_track = (
                            SynchronizedAudioTrack(room.interviewer_audio_track)
                        )

                    if room.candidate_audio_track:
                        room.normalized_candidate_audio_track = SynchronizedAudioTrack(
                            room.candidate_audio_track
                        )

                    if room.candidate_video_track:
                        # room.normalized_candidate_video_track = SynchronizedVideoTrack(
                        #     room.candidate_video_track
                        # )
                        room.normalized_candidate_video_track = (
                            room.candidate_video_track
                        )

                    # Prepare all recorders
                    recorders_to_start = []

                    if room.normalized_interviewer_audio_track:
                        filename = (
                            f"{next_interview_number}-interviewer-{room.session_id}.wav"
                        )
                        room.interviewer_recorder = MediaRecorder(
                            str(recordings_dir / filename)
                        )
                        room.interviewer_recorder.addTrack(
                            room.normalized_interviewer_audio_track
                        )
                        recorders_to_start.append(room.interviewer_recorder)

                    if room.normalized_candidate_audio_track:
                        filename = f"{next_interview_number}-candidate-audio-{room.session_id}.wav"
                        room.candidate_audio_recorder = MediaRecorder(
                            str(recordings_dir / filename)
                        )
                        room.candidate_audio_recorder.addTrack(
                            room.normalized_candidate_audio_track
                        )
                        recorders_to_start.append(room.candidate_audio_recorder)

                    if room.normalized_candidate_video_track:
                        filename = f"{next_interview_number}-candidate-video-{room.session_id}.mp4"

                        # Create custom container for video with proper options
                        # room.candidate_video_recorder = MediaRecorder(
                        #     str(recordings_dir / filename)
                        # )
                        room.candidate_video_recorder = MediaRecorder(
                            str(recordings_dir / filename),
                            format="mp4",
                            options={
                                "video_codec": "libx264",
                                "video_bitrate": "2000k",
                                "video_framerate": "30",
                            },
                        )

                        room.candidate_video_recorder.addTrack(
                            room.normalized_candidate_video_track
                        )
                        recorders_to_start.append(room.candidate_video_recorder)

                    # Start all recorders simultaneously
                    if recorders_to_start:
                        await asyncio.gather(
                            *[recorder.start() for recorder in recorders_to_start]
                        )
                        print(f"Started recording session: {room.session_id}")

                    room.state = RoomState.RECORDING
                    await broadcast_state()

            elif msg_type == "stop-recording":
                if role == "interviewer" and room.state == RoomState.RECORDING:
                    print(f"Stopping recording session: {room.session_id}")

                    # Stop all recorders
                    stop_tasks = []
                    if room.interviewer_recorder:
                        stop_tasks.append(room.interviewer_recorder.stop())
                    if room.candidate_audio_recorder:
                        stop_tasks.append(room.candidate_audio_recorder.stop())
                    if room.candidate_video_recorder:
                        stop_tasks.append(room.candidate_video_recorder.stop())

                    if stop_tasks:
                        await asyncio.gather(*stop_tasks)

                    if room.interviewer_ws:
                        try:
                            await room.interviewer_ws.send_text(
                                json.dumps({"type": "stopped"})
                            )
                        except:
                            pass
                    if room.candidate_ws:
                        try:
                            await room.candidate_ws.send_text(
                                json.dumps({"type": "stopped"})
                            )
                        except:
                            pass

                    room.should_close = True

                    if room.interviewer_pc:
                        await room.interviewer_pc.close()
                    if room.candidate_pc:
                        await room.candidate_pc.close()

                    print(f"Recording session {room.session_id} completed")
                    room.reset()
                    await broadcast_state()

                    return

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if role == "interviewer":
            await cleanup_interviewer()
        elif role == "candidate":
            await cleanup_candidate()


async def cleanup_interviewer():
    if room.interviewer_pc:
        await room.interviewer_pc.close()
    room.reset()
    await broadcast_state()


async def cleanup_candidate():
    if room.candidate_pc:
        await room.candidate_pc.close()
    room.candidate_ws = None
    room.candidate_pc = None
    room.candidate_audio_track = None
    room.candidate_video_track = None
    room.normalized_candidate_video_track = None
    room.normalized_candidate_audio_track = None
    if room.state == RoomState.BOTH_CONNECTED or room.state == RoomState.RECORDING:
        room.state = RoomState.INTERVIEWER_CONNECTED
    await broadcast_state()


# ─── WebRTC + original web_ui pages ────────────────────────────
@app.get("/interviewer")
async def interviewer():
    return FileResponse(_BASE_DIR / "interviewer.html")


@app.get("/candidate")
async def candidate():
    return FileResponse(_BASE_DIR / "candidate.html")


@app.get("/interviewer.html")
async def interviewer_html():
    return FileResponse(_BASE_DIR / "interviewer.html")


@app.get("/candidate.html")
async def candidate_html():
    return FileResponse(_BASE_DIR / "candidate.html")


@app.get("/interviewer.js")
async def interviewer_js():
    return FileResponse(_BASE_DIR / "interviewer.js")


@app.get("/candidate.js")
async def candidate_js():
    return FileResponse(_BASE_DIR / "candidate.js")


# ─── API Endpoints (read-only, used by the unified frontend) ────
_OUTPUT_DIR = Path("../backend/backend/output")

OUTPUT_FILES = {
    "timeline":           "timeline.json",
    "qa_pairs":           "qa_pairs.json",
    "score_timeline":     "candidate_score_timeline.json",
    "relevance_scores":   "relevance_scores.json",
    "behavior_metrics":   "candidate_behavior_metrics.json",
    "speaking_segments":  "speaking_segments.json",
    "audio_raw":          "candidate_audio_raw.json",
    "video_raw":          "candidate_video_raw.json",
    "interviewer":        "interviewer_transcript.json",
}


@app.get("/api/status")
async def api_status():
    """Return current room state for the control page."""
    return JSONResponse({
        "state": room.state.name,
        "interviewer_connected": room.interviewer is not None,
        "candidate_connected": room.candidate is not None,
        "is_recording": room.is_recording,
    })


@app.get("/api/recordings")
async def api_recordings():
    """List recordings from the recordings directory."""
    files = []
    if recordings_dir.exists():
        for f in sorted(recordings_dir.iterdir()):
            if f.is_file() and f.suffix in (".wav", ".mp4", ".webm"):
                files.append({"name": f.name, "size": f.stat().st_size})
    return JSONResponse(files)


@app.get("/api/output/{filename}")
async def api_output_file(filename: str):
    """Serve a single output file by name."""
    target = _OUTPUT_DIR / filename
    if not target.exists():
        return JSONResponse({"error": f"File not found: {filename}"}, status_code=404)
    try:
        content = target.read_text(encoding="utf-8")
        return JSONResponse(json.loads(content))
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/output")
async def api_output_list():
    """List available output files."""
    available = {}
    for key, fname in OUTPUT_FILES.items():
        fpath = _OUTPUT_DIR / fname
        available[key] = {"name": fname, "available": fpath.exists()}
    return JSONResponse(available)


@app.get("/api/output/all")
async def api_output_all():
    """Return all available output files merged into one JSON object."""
    result = {}
    for key, fname in OUTPUT_FILES.items():
        fpath = _OUTPUT_DIR / fname
        if fpath.exists():
            try:
                text = fpath.read_text(encoding="utf-8")
                # Handle JSONL files (one JSON object per line)
                if text.strip().startswith('{') and '\n' in text.strip():
                    lines = [l.strip() for l in text.strip().split('\n') if l.strip()]
                    try:
                        result[key] = [json.loads(l) for l in lines]
                    except Exception:
                        result[key] = json.loads(text)
                else:
                    result[key] = json.loads(text)
            except Exception:
                result[key] = None
    return JSONResponse(result)


# ─── Pipeline Execution API ──────────────────────────────
# Store pipeline execution status
pipeline_status = {}

@app.post("/api/pipeline/execute")
async def execute_pipeline(
    interviewer_audio: UploadFile = File(...),
    candidate_video: UploadFile = File(...),
    jd: UploadFile = File(...),
    candidate_audio: Optional[UploadFile] = File(None)
):
    """Upload files and trigger pipeline execution"""
    try:
        session_id = str(uuid.uuid4())[:8]
        
        # Create session directory
        backend_dir = _BASE_DIR.parent / "backend" / "backend"
        temp_input_dir = backend_dir / "temp_input"
        temp_input_dir.mkdir(exist_ok=True)
        
        # Save uploaded files
        interviewer_path = temp_input_dir / f"{session_id}_interviewer_audio.wav"
        candidate_video_path = temp_input_dir / f"{session_id}_candidate_video.mp4"
        jd_path = temp_input_dir / f"{session_id}_jd.md"
        
        with open(interviewer_path, "wb") as f:
            content = await interviewer_audio.read()
            f.write(content)
        
        with open(candidate_video_path, "wb") as f:
            content = await candidate_video.read()
            f.write(content)
        
        with open(jd_path, "wb") as f:
            content = await jd.read()
            f.write(content)
        
        if candidate_audio:
            candidate_audio_path = temp_input_dir / f"{session_id}_candidate_audio.wav"
            with open(candidate_audio_path, "wb") as f:
                content = await candidate_audio.read()
                f.write(content)
        else:
            candidate_audio_path = None
        
        # Initialize pipeline status
        pipeline_status[session_id] = {
            "status": "running",
            "stage": "Stage 1",
            "message": "Starting pipeline...",
            "error": None
        }
        
        # Start pipeline execution in background
        asyncio.create_task(run_pipeline_async(
            session_id, 
            str(interviewer_path), 
            str(candidate_video_path),
            str(candidate_audio_path) if candidate_audio_path else None,
            str(jd_path),
            backend_dir
        ))
        
        return JSONResponse({
            "success": True,
            "session_id": session_id,
            "message": "Pipeline started"
        })
        
    except Exception as e:
        return JSONResponse({
            "error": str(e)
        }, status_code=500)


async def run_pipeline_async(session_id, interviewer_audio, candidate_video, candidate_audio, jd_path, backend_dir):
    """Run the pipeline in background"""
    try:
        pipeline_status[session_id]["stage"] = "Stage 1"
        pipeline_status[session_id]["message"] = "Ingesting files..."
        
        # Build command to run main.py
        main_py = backend_dir / "main.py"
        
        # Prepare arguments - must match main.py argparse
        cmd = [
            "python", str(main_py),
            "--video", candidate_video,
            "--candidate-audio", candidate_audio if candidate_audio else candidate_video,  # Use video if no separate audio
            "--interviewer-audio", interviewer_audio,
            "--jd", jd_path
        ]
        
        # Run pipeline
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=str(backend_dir)
        )
        
        # Track completed stages
        completed_stages = set()
        
        # Monitor output for stage updates
        while True:
            output = process.stdout.readline()
            if output == '' and process.poll() is not None:
                break
            if output:
                line = output.strip()
                print(f"[Pipeline {session_id}] {line}")  # Debug logging
                
                # Parse stage information from output
                if "[START]" in line:
                    if "Stage 1" in line or "Extraction" in line or "Ingest" in line:
                        pipeline_status[session_id]["stage"] = "Stage 1"
                        pipeline_status[session_id]["message"] = "Audio/Video extraction"
                    elif "Stage 2" in line or "Transcribe" in line:
                        completed_stages.add("Stage 1")
                        pipeline_status[session_id]["stage"] = "Stage 2"
                        pipeline_status[session_id]["message"] = "Speech transcription"
                    elif "Stage 3" in line or "Align" in line or "Temporal" in line:
                        completed_stages.add("Stage 2")
                        pipeline_status[session_id]["stage"] = "Stage 3"
                        pipeline_status[session_id]["message"] = "Temporal alignment"
                    elif "Stage 4" in line or "Q&A" in line or "QA" in line:
                        completed_stages.add("Stage 3")
                        pipeline_status[session_id]["stage"] = "Stage 4"
                        pipeline_status[session_id]["message"] = "Q&A extraction"
                    elif "Stage 5" in line or "Scoring" in line or "LLM" in line:
                        completed_stages.add("Stage 4")
                        pipeline_status[session_id]["stage"] = "Stage 5"
                        pipeline_status[session_id]["message"] = "LLM semantic scoring"
                    elif "Stage 6" in line or "Behavior" in line or "Aggregat" in line:
                        completed_stages.add("Stage 5")
                        pipeline_status[session_id]["stage"] = "Stage 6"
                        pipeline_status[session_id]["message"] = "Behavioral analysis"
                
                # Track completions
                if "[COMPLETE]" in line:
                    for stage in ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Stage 5", "Stage 6"]:
                        if stage in line:
                            completed_stages.add(stage)
                            break
        
        return_code = process.poll()
        
        if return_code == 0:
            # Copy results to output directory
            results_dir = backend_dir / "results"
            output_dir = backend_dir / "output"
            output_dir.mkdir(exist_ok=True)
            
            # Find the latest session directory (or specific session_id)
            session_dirs = sorted(results_dir.glob(f"*{session_id}*")) if results_dir.exists() else []
            if not session_dirs:
                # Try numbered directories
                session_dirs = sorted(results_dir.glob("*-*")) if results_dir.exists() else []
            
            if session_dirs:
                latest_dir = session_dirs[-1]
                for file in latest_dir.glob("*.json"):
                    shutil.copy(file, output_dir / file.name)
            
            pipeline_status[session_id]["status"] = "completed"
            pipeline_status[session_id]["message"] = "Pipeline completed successfully"
            pipeline_status[session_id]["completed_stages"] = list(completed_stages)
        else:
            stderr = process.stderr.read()
            pipeline_status[session_id]["status"] = "failed"
            pipeline_status[session_id]["error"] = f"Pipeline failed: {stderr}"
            
    except Exception as e:
        pipeline_status[session_id]["status"] = "failed"
        pipeline_status[session_id]["error"] = str(e)


@app.get("/api/pipeline/status/{session_id}")
async def get_pipeline_status(session_id: str):
    """Get pipeline execution status"""
    if session_id not in pipeline_status:
        return JSONResponse({"error": "Session not found"}, status_code=404)
    
    status_data = pipeline_status[session_id].copy()
    # Ensure completed_stages exists
    if "completed_stages" not in status_data:
        status_data["completed_stages"] = []
    
    return JSONResponse(status_data)


# ─── Static file mounts ──────────────────────────────
_FRONTEND_DIR = _BASE_DIR.parent / "frontend"
_DASHBOARD_DIR = _BASE_DIR.parent / "dashboard"
_BACKEND_DIR = _BASE_DIR.parent / "backend"

# Mount backend directory for video/audio access
if _BACKEND_DIR.exists():
    app.mount("/backend", StaticFiles(directory=str(_BACKEND_DIR)), name="backend")

# Mount dashboard CSS and JS
if _DASHBOARD_DIR.exists():
    app.mount("/dashboard", StaticFiles(directory=str(_DASHBOARD_DIR)), name="dashboard")

# Mount frontend static files
if _FRONTEND_DIR.exists():
    app.mount("/frontend", StaticFiles(directory=str(_FRONTEND_DIR)), name="frontend")


@app.get("/")
async def index():
    """Serve the unified frontend SPA if available, else fall back to old index."""
    frontend_index = _FRONTEND_DIR / "index.html"
    if frontend_index.exists():
        return FileResponse(str(frontend_index))
    return FileResponse("index.html")


@app.get("/app/{rest_of_path:path}")
async def spa_catchall(rest_of_path: str):
    """Catch-all: redirect sub-paths to the unified frontend SPA."""
    frontend_index = _FRONTEND_DIR / "index.html"
    if frontend_index.exists():
        return FileResponse(str(frontend_index))
    return FileResponse("index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
