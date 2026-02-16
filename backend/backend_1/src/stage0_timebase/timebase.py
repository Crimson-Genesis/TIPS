"""
Stage 0: Canonical Time Base
Extracts FPS and duration from video to establish canonical timeline.
"""
import json
import os
from pathlib import Path

import cv2
import librosa


def get_video_info(video_path: str) -> dict:
    """Extract FPS and duration from video file."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps if fps > 0 else 0
    
    cap.release()
    
    return {
        "fps": fps,
        "frame_count": frame_count,
        "duration_sec": round(duration, 3)
    }


def get_audio_info(audio_path: str) -> dict:
    """Get audio duration using librosa."""
    try:
        info = librosa.info(audio_path)
        duration = info.get('duration', 0)
        sr = info.get('sr', 0)
        return {
            "duration_sec": round(duration, 3),
            "sample_rate": sr
        }
    except Exception as e:
        print(f"librosa.info failed: {e}, trying sf.read")
        try:
            import soundfile as sf
            info = sf.info(audio_path)
            return {
                "duration_sec": round(info.duration, 3),
                "sample_rate": info.samplerate
            }
        except Exception as e2:
            print(f"soundfile.info also failed: {e2}")
            y, sr = librosa.load(audio_path, sr=None)
            duration = librosa.get_duration(y=y, sr=sr)
            return {
                "duration_sec": round(duration, 3),
                "sample_rate": sr
            }


def run(input_dir: str, output_dir: str, dataset_id: str = "2") -> dict:
    """
    Execute Stage 0: Canonical Time Base
    
    Args:
        input_dir: Path to input directory (e.g., '../trans')
        output_dir: Path to output directory (e.g., '../backend/output')
        dataset_id: Dataset identifier (e.g., '1' or '2')
    
    Returns:
        timeline dict
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    candidate_video = input_path / f"{dataset_id}_candidate_video.mp4"
    candidate_audio = input_path / f"{dataset_id}_candidate_audio.wav"
    interviewer_audio = input_path / f"{dataset_id}_interviewer_audio.wav"
    
    for f in [candidate_video, candidate_audio, interviewer_audio]:
        if not f.exists():
            raise FileNotFoundError(f"Input file not found: {f}")
    
    video_info = get_video_info(str(candidate_video))
    candidate_audio_info = get_audio_info(str(candidate_audio))
    interviewer_audio_info = get_audio_info(str(interviewer_audio))
    
    timeline = {
        "timebase": "video",
        "dataset_id": dataset_id,
        "video": {
            "file": str(candidate_video),
            "fps": video_info["fps"],
            "frame_count": video_info["frame_count"],
            "duration_sec": video_info["duration_sec"]
        },
        "audio": {
            "candidate": {
                "file": str(candidate_audio),
                "duration_sec": candidate_audio_info["duration_sec"],
                "sample_rate": candidate_audio_info["sample_rate"]
            },
            "interviewer": {
                "file": str(interviewer_audio),
                "duration_sec": interviewer_audio_info["duration_sec"],
                "sample_rate": interviewer_audio_info["sample_rate"]
            }
        },
        "alignment": {
            "video_to_audio_offset_sec": 0.0,
            "notes": "Audio and video assumed to be synchronized at start"
        }
    }
    
    output_file = output_path / "timeline.json"
    with open(output_file, 'w') as f:
        json.dump(timeline, f, indent=2)
    
    print(f"Stage 0 complete: {output_file}")
    return timeline


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python -m stage0_timebase <input_dir> <output_dir> [dataset_id]")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    output_dir = sys.argv[2]
    dataset_id = sys.argv[3] if len(sys.argv) > 3 else "2"
    
    run(input_dir, output_dir, dataset_id)
