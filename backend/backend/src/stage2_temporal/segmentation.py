"""
Stage 2: Temporal Grouping (FIXED TIMING)
RULE:
- Answer for Question i = ALL candidate speech that STARTS between question_i.end_sec and question_(i+1).start_sec
"""
import json
from pathlib import Path

# -------------------------------------------------
# Speaking Segments
# -------------------------------------------------
def build_speaking_segments(candidate_audio_path, video_data_path, timeline_path):
    with open(candidate_audio_path) as f:
        cand_audio = json.load(f)
    with open(video_data_path) as f:
        video = json.load(f)
    with open(timeline_path) as f:
        timeline = json.load(f)
    
    vad_segments = cand_audio.get("vad_segments", [])
    video_frames = video.get("extraction", {}).get("frames", [])
    video_duration = timeline.get("video", {}).get("duration_sec", 0)
    
    frame_lookup = {
        f["timestamp_sec"]: f["frame_idx"]
        for f in video_frames
        if "timestamp_sec" in f
    }
    
    segments = []
    idx = 1
    for vad in vad_segments:
        if vad.get("type") != "speaking":
            continue
        start = vad["start_sec"]
        end = vad["end_sec"]
        frames = [
            frame_lookup[t]
            for t in frame_lookup
            if start <= t <= end
        ]
        segments.append({
            "segment_id": f"SEG{idx}",
            "type": "speaking",
            "start_time": start,
            "end_time": end,
            "duration_sec": round(end - start, 3),
            "video_frames": frames
        })
        idx += 1
    
    return {
        "dataset_id": cand_audio.get("dataset_id", "2"),
        "segments": segments,
        "speaking_count": len(segments),
        "non_speaking_count": 0
    }

# -------------------------------------------------
# Q&A Mapping
# -------------------------------------------------
def build_qa_pairs(interviewer_path, candidate_audio_path):
    with open(interviewer_path) as f:
        interviewer = json.load(f)
    with open(candidate_audio_path) as f:
        cand_audio = json.load(f)
    
    questions = interviewer["transcription"]["segments"]
    cand_segments = cand_audio["transcription"]["segments"]
    
    # Helper: check if text is a closing remark
    def is_closing(text):
        t = text.lower().strip()
        return any(phrase in t for phrase in ["thank you", "that's it", "thanks"])
    
    # Keep all questions including closing ones
    questions = sorted(questions, key=lambda q: q["start_sec"])
    
    # Cap question duration at 10 seconds max
    for q in questions:
        duration = q["end_sec"] - q["start_sec"]
        if duration > 10.0:
            q["end_sec"] = q["start_sec"] + 10.0
    
    qa_pairs = []
    for i, q in enumerate(questions):
        q_start = q["start_sec"]
        q_end = q["end_sec"]
        q_text = q["text"].strip()
        
        # Answer collection window: from question end to next question start
        answer_start = q_end
        
        if i + 1 < len(questions):
            answer_end = questions[i + 1]["start_sec"]
        else:
            # Last question - collect until end of candidate audio
            answer_end = cand_segments[-1]["end_sec"] if cand_segments else q_end + 60
        
        # Collect candidate segments - ONLY if they START in the window
        answer_parts = []
        used_segments = []
        for seg in cand_segments:
            seg_start = seg["start_sec"]
            
            # Include ONLY if segment STARTS in our window
            if answer_start <= seg_start < answer_end:
                answer_parts.append(seg["text"].strip())
                used_segments.append(seg)
        
        if answer_parts:
            answer = {
                "start_time": used_segments[0]["start_sec"],
                "end_time": used_segments[-1]["end_sec"],
                "segment_ids": [],
                "text": " ".join(answer_parts)
            }
        else:
            answer = {
                "start_time": None,
                "end_time": None,
                "segment_ids": [],
                "text": "No answer"
            }
        
        qa_pairs.append({
            "question_id": f"Q{i+1}",
            "question_text": q_text,
            "question_start_time": q_start,
            "question_end_time": q_end,
            "answer": answer
        })
    
    return {
        "dataset_id": interviewer.get("dataset_id", "2"),
        "qa_pairs": qa_pairs,
        "total_pairs": len(qa_pairs)
    }

# -------------------------------------------------
# Runner
# -------------------------------------------------
def run(output_dir):
    out = Path(output_dir)
    candidate_audio = out / "candidate_audio_raw.json"
    interviewer = out / "interviewer_transcript.json"
    video = out / "candidate_video_raw.json"
    timeline = out / "timeline.json"
    
    print("Building speaking segments...")
    segments = build_speaking_segments(candidate_audio, video, timeline)
    
    print("Building Q&A pairs...")
    qa = build_qa_pairs(interviewer, candidate_audio)
    
    with open(out / "speaking_segments.json", "w") as f:
        json.dump(segments, f, indent=2)
    
    with open(out / "qa_pairs.json", "w") as f:
        json.dump(qa, f, indent=2)
    
    print("Stage 2 complete")
    print("Questions:", qa["total_pairs"])

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python segmentation.py <output_dir>")
        sys.exit(1)
    run(sys.argv[1])
