"""
Stage 3: Behavioral Metrics Extraction

Computes NUMERIC behavioral proxies from audio/video signals.
No emotion detection, no semantic inference, no evaluation.
"""
import json
from pathlib import Path
import numpy as np


def compute_audio_metrics(audio_features: list, segment_start: float, segment_end: float) -> dict:
    """Compute audio metrics for a speaking segment."""
    
    # Filter features to this segment
    seg_features = [
        f for f in audio_features
        if segment_start <= f.get("timestamp_sec", 0) <= segment_end
    ]
    
    if not seg_features:
        return {
            "pitch_mean": 0.0,
            "pitch_variance": 0.0,
            "energy_mean": 0.0,
            "energy_variance": 0.0,
            "speech_rate": 0.0,
            "pause_density": 0.0,
            "prosodic_variability": 0.0
        }
    
    # Extract pitch and energy values
    pitches = [f.get("pitch_hz", 0) for f in seg_features if f.get("pitch_hz", 0) > 0]
    energies = [f.get("rms_energy", 0) for f in seg_features]
    
    # Pitch metrics
    pitch_mean = float(np.mean(pitches)) if pitches else 0.0
    pitch_variance = float(np.var(pitches)) if len(pitches) > 1 else 0.0
    
    # Energy metrics
    energy_mean = float(np.mean(energies)) if energies else 0.0
    energy_variance = float(np.var(energies)) if len(energies) > 1 else 0.0
    
    # Speech rate (approximate using segment duration / feature count)
    duration = segment_end - segment_start
    feature_count = len(seg_features)
    speech_rate = feature_count / duration if duration > 0 else 0.0
    
    # Pause density (low energy frames / total frames)
    energy_threshold = energy_mean * 0.1 if energy_mean > 0 else 0.001
    pause_count = sum(1 for e in energies if e < energy_threshold)
    pause_density = pause_count / len(energies) if energies else 0.0
    
    # Prosodic variability (Δ pitch + Δ energy)
    if len(pitches) > 1:
        pitch_deltas = np.diff(pitches)
        pitch_variability = float(np.mean(np.abs(pitch_deltas)))
    else:
        pitch_variability = 0.0
    
    if len(energies) > 1:
        energy_deltas = np.diff(energies)
        energy_variability = float(np.mean(np.abs(energy_deltas)))
    else:
        energy_variability = 0.0
    
    prosodic_variability = pitch_variability + energy_variability
    
    return {
        "pitch_mean": round(pitch_mean, 2),
        "pitch_variance": round(pitch_variance, 2),
        "energy_mean": round(energy_mean, 6),
        "energy_variance": round(energy_variance, 8),
        "speech_rate": round(speech_rate, 4),
        "pause_density": round(pause_density, 4),
        "prosodic_variability": round(prosodic_variability, 6)
    }


def compute_video_metrics(video_frames: list, segment_start: float, segment_end: float) -> dict:
    """Compute video metrics for a speaking segment."""
    
    # Filter frames to this segment
    seg_frames = [
        f for f in video_frames
        if segment_start <= f.get("timestamp_sec", 0) <= segment_end
    ]
    
    total_frames = len(seg_frames)
    
    if total_frames == 0:
        return {
            "face_presence_ratio": 0.0,
            "head_motion_mean": 0.0,
            "head_motion_variance": 0.0,
            "gaze_stability": 0.0,
            "facial_motion_intensity": 0.0,
            "expression_change_rate": 0.0
        }
    
    # Face presence ratio
    face_detected_count = sum(1 for f in seg_frames if f.get("face_detected", False))
    face_presence_ratio = face_detected_count / total_frames
    
    # Head motion (yaw + pitch + roll deltas)
    head_poses = []
    for f in seg_frames:
        pose = f.get("head_pose")
        if pose:
            head_poses.append([
                pose.get("yaw", 0),
                pose.get("pitch", 0),
                pose.get("roll", 0)
            ])
    
    head_motions = []
    if len(head_poses) > 1:
        for i in range(1, len(head_poses)):
            delta = np.linalg.norm(
                np.array(head_poses[i]) - np.array(head_poses[i-1])
            )
            head_motions.append(delta)
    
    head_motion_mean = float(np.mean(head_motions)) if head_motions else 0.0
    head_motion_variance = float(np.var(head_motions)) if len(head_motions) > 1 else 0.0
    
    # Gaze stability (variance of gaze offsets)
    gaze_x = [f.get("gaze", {}).get("offset_x", 0) for f in seg_frames if f.get("gaze")]
    gaze_y = [f.get("gaze", {}).get("offset_y", 0) for f in seg_frames if f.get("gaze")]
    
    gaze_x_var = float(np.var(gaze_x)) if len(gaze_x) > 1 else 0.0
    gaze_y_var = float(np.var(gaze_y)) if len(gaze_y) > 1 else 0.0
    gaze_stability = gaze_x_var + gaze_y_var
    
    # Facial motion intensity (landmark movement)
    landmark_positions = []
    for f in seg_frames:
        landmarks = f.get("landmarks", [])
        if landmarks:
            positions = [(lm.get("x", 0), lm.get("y", 0)) for lm in landmarks]
            if positions:
                centroid = np.mean(positions, axis=0)
                landmark_positions.append(centroid)
    
    facial_motions = []
    if len(landmark_positions) > 1:
        for i in range(1, len(landmark_positions)):
            delta = np.linalg.norm(
                landmark_positions[i] - landmark_positions[i-1]
            )
            facial_motions.append(delta)
    
    facial_motion_intensity = float(np.mean(facial_motions)) if facial_motions else 0.0
    
    # Expression change rate (frame-to-frame landmark deltas)
    expression_change_rate = float(np.mean(facial_motions)) if facial_motions else 0.0
    
    return {
        "face_presence_ratio": round(face_presence_ratio, 4),
        "head_motion_mean": round(head_motion_mean, 4),
        "head_motion_variance": round(head_motion_variance, 4),
        "gaze_stability": round(gaze_stability, 6),
        "facial_motion_intensity": round(facial_motion_intensity, 6),
        "expression_change_rate": round(expression_change_rate, 6)
    }


def run(output_dir: str) -> dict:
    """Execute Stage 3: Behavioral Metrics Extraction."""
    output_path = Path(output_dir)
    
    # Load inputs
    with open(output_path / "speaking_segments.json") as f:
        segments_data = json.load(f)
    
    with open(output_path / "candidate_audio_raw.json") as f:
        audio_data = json.load(f)
    
    with open(output_path / "candidate_video_raw.json") as f:
        video_data = json.load(f)
    
    # Get speaking segments only
    speaking_segments = [
        s for s in segments_data.get("segments", [])
        if s.get("type") == "speaking"
    ]
    
    # Get audio features and video frames
    audio_features = audio_data.get("features", [])
    video_frames = video_data.get("extraction", {}).get("frames", [])
    
    # Compute metrics for each speaking segment
    segment_metrics = []
    
    for seg in speaking_segments:
        seg_id = seg.get("segment_id")
        seg_start = seg.get("start_time")
        seg_end = seg.get("end_time")
        
        audio_metrics = compute_audio_metrics(audio_features, seg_start, seg_end)
        video_metrics = compute_video_metrics(video_frames, seg_start, seg_end)
        
        segment_metrics.append({
            "segment_id": seg_id,
            "start_time": seg_start,
            "end_time": seg_end,
            "audio_metrics": audio_metrics,
            "video_metrics": video_metrics
        })
    
    # Build output
    output = {
        "dataset_id": segments_data.get("dataset_id", "2"),
        "segment_count": len(segment_metrics),
        "segments": segment_metrics
    }
    
    # Save output
    with open(output_path / "candidate_behavior_metrics.json", "w") as f:
        json.dump(output, f, indent=2)
    
    print(f"Stage 3 complete:")
    print(f"  Speaking segments processed: {len(segment_metrics)}")
    print(f"  Output: candidate_behavior_metrics.json")
    
    return output


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python metrics.py <output_dir>")
        sys.exit(1)
    
    output_dir = sys.argv[1]
    run(output_dir)
