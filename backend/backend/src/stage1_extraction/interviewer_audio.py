"""
Stage 1B: Interviewer Audio Transcription (DIRECT PATH VERSION - FIXED SPLITTING)
"""
import json
from pathlib import Path
from typing import Dict
from faster_whisper import WhisperModel

def normalize_text(text: str) -> str:
    return " ".join(text.lower().strip().split())

def is_valid_segment(seg: Dict) -> bool:
    if not seg["text"]:
        return False
    if (seg["end_sec"] - seg["start_sec"]) < 0.2:
        return False
    return True

def split_and_merge_questions(segments, pause_split_sec=1.0, max_merge_gap=3.0):
    """
    1. Soft-split on pauses >= pause_split_sec
    2. Merge fragments until a question boundary is reached
    """

    # -------- STEP 1: soft split on pauses --------
    soft_segments = []

    for seg in segments:
        words = seg.get("words", [])
        if not words:
            continue

        chunk_words = [words[0]]
        chunk_start = words[0]["start_sec"]

        for i in range(1, len(words)):
            gap = words[i]["start_sec"] - words[i - 1]["end_sec"]

            if gap >= pause_split_sec:
                soft_segments.append({
                    "start_sec": round(chunk_start, 3),
                    "end_sec": round(chunk_words[-1]["end_sec"], 3),
                    "text": "".join(w["word"] for w in chunk_words).strip(),
                    "words": chunk_words
                })
                chunk_words = []
                chunk_start = words[i]["start_sec"]

            chunk_words.append(words[i])

        if chunk_words:
            soft_segments.append({
                "start_sec": round(chunk_start, 3),
                "end_sec": round(chunk_words[-1]["end_sec"], 3),
                "text": "".join(w["word"] for w in chunk_words).strip(),
                "words": chunk_words
            })

    # -------- STEP 2: merge until question completes --------
    merged = []
    buffer = None

    def is_question_complete(text: str) -> bool:
        text = text.strip().lower()
        return (
            text.endswith("?")
            or text.endswith(" ?")
        )

    for seg in soft_segments:
        if buffer is None:
            buffer = seg
            continue

        gap = seg["start_sec"] - buffer["end_sec"]

        # merge if:
        # - previous fragment not a complete question
        # - gap is reasonable
        if not is_question_complete(buffer["text"]) and gap <= max_merge_gap:
            buffer["end_sec"] = seg["end_sec"]
            buffer["text"] = (buffer["text"] + " " + seg["text"]).strip()
            buffer["words"].extend(seg["words"])
        else:
            merged.append(buffer)
            buffer = seg

    if buffer:
        merged.append(buffer)

    return merged

# def split_long_segments(segments, min_gap=1.0):  # Split on pauses > 1 second
#     """
#     Split segments at any gap >= min_gap seconds between words.
#     Default: 1.0 second pause = new question.
#     """
#     result = []
#
#     for seg in segments:
#         words = seg.get("words", [])
#
#         if len(words) <= 1:
#             result.append(seg)
#             continue
#
#         current_chunk_start = words[0]["start_sec"]
#         current_chunk_words = []
#
#         for i, word in enumerate(words):
#             current_chunk_words.append(word)
#
#             if i + 1 < len(words):
#                 gap = words[i + 1]["start_sec"] - word["end_sec"]
#
#                 # Split on gaps >= 1 second
#                 if gap >= min_gap:
#                     # Create segment from accumulated words (NO minimum duration check)
#                     result.append({
#                         "start_sec": round(current_chunk_start, 3),
#                         "end_sec": round(word["end_sec"], 3),
#                         "text": "".join(w["word"] for w in current_chunk_words).strip(),
#                         "words": current_chunk_words
#                     })
#                     # Start new chunk
#                     current_chunk_start = words[i + 1]["start_sec"]
#                     current_chunk_words = []
#
#         # Add remaining words as final chunk
#         if current_chunk_words:
#             result.append({
#                 "start_sec": round(current_chunk_start, 3),
#                 "end_sec": round(words[-1]["end_sec"], 3),
#                 "text": "".join(w["word"] for w in current_chunk_words).strip(),
#                 "words": current_chunk_words
#             })
#
#     return result

def transcribe(audio_path: str) -> dict:
    print(f"Loading Whisper model for {audio_path}...")
    model = WhisperModel("small", device="cpu", compute_type="int8")
    
    print("Transcribing interviewer audio...")
    segments, info = model.transcribe(
        audio_path, 
        word_timestamps=True,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500,  # Back to 500ms
            speech_pad_ms=200              # Back to 200ms
        ),
        condition_on_previous_text=False,
        compression_ratio_threshold=2.0,
        log_prob_threshold=-0.8,
        no_speech_threshold=0.5
    )
    
    raw_segments = []
    for seg in segments:
        raw_segments.append({
            "start_sec": round(seg.start, 3),
            "end_sec": round(seg.end, 3),
            "text": seg.text.strip(),
            "words": [
                {
                    "word": w.word,
                    "start_sec": round(w.start, 3),
                    "end_sec": round(w.end, 3),
                    "probability": w.probability
                }
                for w in (seg.words or [])
            ]
        })
    
    # Split segments at pauses >= 1 second
    # split_segments = split_long_segments(raw_segments, min_gap=1.0)
    split_segments = split_and_merge_questions(raw_segments)
    
    # SLIDING WINDOW DEDUPLICATION
    final_segments = []
    recent_window = []
    WINDOW_SEC = 30.0
    
    for seg in split_segments:
        if not is_valid_segment(seg):
            continue
        
        norm = normalize_text(seg["text"])
        current_time = seg["start_sec"]
        
        recent_window = [(txt, ts) for txt, ts in recent_window 
                        if current_time - ts < WINDOW_SEC]
        
        if norm in [txt for txt, _ in recent_window]:
            continue
        
        final_segments.append(seg)
        recent_window.append((norm, current_time))
    
    return {
        "language": info.language if hasattr(info, "language") else "unknown",
        "language_probability": getattr(info, "language_probability", 0.0),
        "segments": final_segments
    }

def run(interviewer_audio_path: str, output_dir: str) -> dict:
    """Execute Stage 1B: Interviewer Audio Transcription (DIRECT PATH)."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    interviewer_audio = Path(interviewer_audio_path)
    
    if not interviewer_audio.exists():
        raise FileNotFoundError(f"Interviewer audio not found: {interviewer_audio}")
    
    transcription = transcribe(str(interviewer_audio))
    
    output = {
        "dataset_id": interviewer_audio.stem.split('_')[0],
        "source_file": str(interviewer_audio),
        "transcription": transcription
    }
    
    out_file = output_path / "interviewer_transcript.json"
    with open(out_file, "w") as f:
        json.dump(output, f, indent=2)
    
    print(f"Stage 1B complete: {out_file}")
    return output
