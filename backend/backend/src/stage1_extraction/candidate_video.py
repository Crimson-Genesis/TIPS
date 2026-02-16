"""
Stage 1C: Candidate Video Feature Extraction (DIRECT PATH VERSION)
"""
import json
from pathlib import Path
import cv2
import numpy as np

def extract_video_features(video_path: str, fps: float, frame_sample_interval: int = 10) -> list:
    """Extract features from video every N frames."""
    
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")
    
    video_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / video_fps
    
    frame_features = []
    frame_idx = 0
    sampled_idx = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        if frame_idx % frame_sample_interval == 0:
            timestamp = frame_idx / video_fps
            
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            faces = face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30)
            )
            
            feature = {
                "frame_idx": frame_idx,
                "timestamp_sec": round(timestamp, 3),
                "face_detected": len(faces) > 0,
                "face_bbox": None,
                "head_pose": None,
                "gaze": None,
                "landmarks": []
            }
            
            if len(faces) > 0:
                x, y, w, h = faces[0]
                h_frame, w_frame = gray.shape
                
                feature["face_bbox"] = {
                    "x": int(x),
                    "y": int(y),
                    "width": int(w),
                    "height": int(h),
                    "x_normalized": round(x / w_frame, 4),
                    "y_normalized": round(y / h_frame, 4),
                    "width_normalized": round(w / w_frame, 4),
                    "height_normalized": round(h / h_frame, 4)
                }
                
                face_center_x = x + w / 2
                face_center_y = y + h / 2
                frame_center_x = w_frame / 2
                frame_center_y = h_frame / 2
                
                yaw = (face_center_x - frame_center_x) / frame_center_x * 45
                pitch = (face_center_y - frame_center_y) / frame_center_y * 45
                
                face_aspect = w / h if h > 0 else 1
                roll = 0
                
                feature["head_pose"] = {
                    "yaw": round(yaw, 2),
                    "pitch": round(pitch, 2),
                    "roll": round(roll, 2),
                    "face_aspect_ratio": round(face_aspect, 4)
                }
                
                gaze_offset_x = (face_center_x - frame_center_x) / frame_center_x
                gaze_offset_y = (face_center_y - frame_center_y) / frame_center_y
                feature["gaze"] = {
                    "offset_x": round(gaze_offset_x, 4),
                    "offset_y": round(gaze_offset_y, 4)
                }
                
                feature["landmarks"] = [
                    {"id": "face_center", "x": round(face_center_x / w_frame, 4), "y": round(face_center_y / h_frame, 4)},
                    {"id": "top", "x": round((x + w/2) / w_frame, 4), "y": round(y / h_frame, 4)},
                    {"id": "bottom", "x": round((x + w/2) / w_frame, 4), "y": round((y + h) / h_frame, 4)},
                    {"id": "left", "x": round(x / w_frame, 4), "y": round((y + h/2) / h_frame, 4)},
                    {"id": "right", "x": round((x + w) / w_frame, 4), "y": round((y + h/2) / h_frame, 4)}
                ]
            
            frame_features.append(feature)
            sampled_idx += 1
        
        frame_idx += 1
    
    cap.release()
    
    return {
        "total_frames": total_frames,
        "video_fps": video_fps,
        "duration_sec": round(duration, 3),
        "sampled_frames": sampled_idx,
        "sample_interval": frame_sample_interval,
        "frames": frame_features
    }

def run(candidate_video_path: str, output_dir: str, timeline: dict) -> dict:
    """Execute Stage 1C: Candidate Video Feature Extraction (DIRECT PATH)."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    candidate_video = Path(candidate_video_path)
    
    if not candidate_video.exists():
        raise FileNotFoundError(f"Candidate video not found: {candidate_video}")
    
    print(f"Processing: {candidate_video}")
    
    fps = timeline.get("video", {}).get("fps", 24.0)
    
    print(f"Extracting features at every 10th frame (video FPS: {fps})...")
    features = extract_video_features(str(candidate_video), fps, frame_sample_interval=10)
    
    output = {
        "dataset_id": candidate_video.stem.split('_')[0],  # Extract from filename
        "source_file": str(candidate_video),
        "video_fps": fps,
        "extraction": features
    }
    
    output_file = output_path / "candidate_video_raw.json"
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"Stage 1C complete: {output_file}")
    print(f"  Total frames: {features['total_frames']}")
    print(f"  Sampled frames: {features['sampled_frames']}")
    return output
