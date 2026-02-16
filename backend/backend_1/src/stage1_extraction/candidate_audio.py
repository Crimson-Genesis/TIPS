"""
Stage 1A: Candidate Audio Feature Extraction (DIRECT PATH VERSION)
"""
import json
from pathlib import Path
import librosa
import numpy as np
import webrtcvad
from faster_whisper import WhisperModel

def extract_features(audio_path: str, sample_rate: int = 16000) -> dict:
    """Extract low-level audio features."""
    y, sr = librosa.load(audio_path, sr=sample_rate)
    
    features = []
    frame_length = int(0.025 * sample_rate)
    hop_length = int(0.010 * sample_rate)
    
    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    pitches, magnitudes = librosa.piptrack(y=y, sr=sr, hop_length=hop_length)
    
    for i in range(0, len(rms), 10):
        if i >= len(rms):
            break
        timestamp = i * hop_length / sample_rate
        
        pitch_values = pitches[:, i]
        pitch = pitch_values[pitch_values > 0].mean() if np.any(pitch_values > 0) else 0
        
        features.append({
            "frame_idx": i,
            "timestamp_sec": round(timestamp, 3),
            "rms_energy": round(float(rms[i]), 4),
            "pitch_hz": round(float(pitch), 2) if pitch > 0 else 0
        })
    
    return features

def voice_activity_detection(audio_path: str, sample_rate: int = 16000) -> list:
    """Detect voice activity using webrtcvad."""
    vad = webrtcvad.Vad(2)
    
    y, sr = librosa.load(audio_path, sr=sample_rate)
    y_int16 = (y * 32767).astype(np.int16)
    
    frame_duration_ms = 30
    frame_samples = int(sample_rate * frame_duration_ms / 1000)
    
    segments = []
    is_speaking = False
    segment_start = 0
    
    for i in range(0, len(y_int16), frame_samples):
        frame = y_int16[i:i + frame_samples]
        if len(frame) < frame_samples:
            break
        
        try:
            is_speech = vad.is_speech(frame.tobytes(), sample_rate)
        except:
            is_speech = False
        
        timestamp = i / sample_rate
        
        if is_speech and not is_speaking:
            segment_start = timestamp
            is_speaking = True
        elif not is_speech and is_speaking:
            segments.append({
                "start_sec": round(segment_start, 3),
                "end_sec": round(timestamp, 3),
                "type": "speaking"
            })
            is_speaking = False
    
    if is_speaking:
        segments.append({
            "start_sec": round(segment_start, 3),
            "end_sec": round(len(y_int16) / sample_rate, 3),
            "type": "speaking"
        })
    
    return segments

def split_long_segments(segments, min_gap=1.5):
    """Split segments at any gap >= min_gap seconds between words."""
    result = []
    
    for seg in segments:
        words = seg.get("words", [])
        
        if len(words) <= 1:
            result.append(seg)
            continue
        
        current_chunk_start = words[0]["start_sec"]
        current_chunk_words = []
        
        for i, word in enumerate(words):
            current_chunk_words.append(word)
            
            if i + 1 < len(words):
                gap = words[i + 1]["start_sec"] - word["end_sec"]
                
                if gap >= min_gap:
                    result.append({
                        "start_sec": round(current_chunk_start, 3),
                        "end_sec": round(word["end_sec"], 3),
                        "text": "".join(w["word"] for w in current_chunk_words).strip(),
                        "words": current_chunk_words
                    })
                    current_chunk_start = words[i + 1]["start_sec"]
                    current_chunk_words = []
        
        if current_chunk_words:
            result.append({
                "start_sec": round(current_chunk_start, 3),
                "end_sec": round(words[-1]["end_sec"], 3),
                "text": "".join(w["word"] for w in current_chunk_words).strip(),
                "words": current_chunk_words
            })
    
    return result

def transcribe(audio_path: str) -> dict:
    """Transcribe audio with enhanced sensitivity and better segmentation."""
    print("Loading Whisper model...")
    model = WhisperModel("small", device="cpu", compute_type="int8")
    
    print("Transcribing...")
    segments, info = model.transcribe(
        audio_path, 
        word_timestamps=True,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=700,
            speech_pad_ms=200
        ),
        condition_on_previous_text=False,
        compression_ratio_threshold=2.0,
        log_prob_threshold=-0.8,
        no_speech_threshold=0.5,
        initial_prompt="This is an interview response with clear pauses between sentences."
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
    
    final_segments = split_long_segments(raw_segments, min_gap=1.5)
    
    result = {
        "language": info.language if hasattr(info, 'language') else "unknown",
        "language_probability": info.language_probability if hasattr(info, 'language_probability') else 0,
        "segments": final_segments
    }
    
    return result

def run(candidate_audio_path: str, output_dir: str, timeline: dict) -> dict:
    """Execute Stage 1A: Candidate Audio Extraction (DIRECT PATH)."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    candidate_audio = Path(candidate_audio_path)
    
    if not candidate_audio.exists():
        raise FileNotFoundError(f"Candidate audio not found: {candidate_audio}")
    
    print(f"Processing: {candidate_audio}")
    
    sample_rate = timeline["audio"]["candidate"]["sample_rate"]
    
    print("Extracting features...")
    features = extract_features(str(candidate_audio), sample_rate)
    
    print("Running VAD...")
    vad_segments = voice_activity_detection(str(candidate_audio), sample_rate)
    
    print("Transcribing...")
    transcription = transcribe(str(candidate_audio))
    
    output = {
        "dataset_id": candidate_audio.stem.split('_')[0],  # Extract from filename
        "source_file": str(candidate_audio),
        "sample_rate": sample_rate,
        "features": features,
        "vad_segments": vad_segments,
        "transcription": transcription
    }
    
    output_file = output_path / "candidate_audio_raw.json"
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"Stage 1A complete: {output_file}")
    return output
