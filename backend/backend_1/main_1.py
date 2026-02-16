"""
Main Orchestration Script
Runs the complete interview analysis pipeline
"""
import sys
import json
import shutil
import uuid
import re
from pathlib import Path
from datetime import datetime
import argparse

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Import stage modules properly
from stage0_timebase import timebase
from stage1_extraction import candidate_audio, candidate_video, interviewer_audio
from stage2_temporal import segmentation
from stage3_behavior import metrics


def get_next_run_number(results_dir: Path) -> int:
    """Get the next run number by checking existing result directories."""
    if not results_dir.exists():
        return 1
    
    existing = [d.name for d in results_dir.iterdir() if d.is_dir()]
    if not existing:
        return 1
    
    numbers = []
    for dirname in existing:
        try:
            num = int(dirname.split('-')[0])
            numbers.append(num)
        except:
            continue
    
    return max(numbers) + 1 if numbers else 1


def backup_output_dir(output_dir: Path, results_dir: Path) -> Path:
    """Create a backup of the output directory."""
    run_number = get_next_run_number(results_dir)
    run_uuid = str(uuid.uuid4())[:8]
    
    backup_name = f"{run_number:03d}-{run_uuid}"
    backup_path = results_dir / backup_name
    
    if output_dir.exists() and any(output_dir.iterdir()):
        print(f"Backing up output to: {backup_path}")
        shutil.copytree(output_dir, backup_path)
    else:
        print("Output directory empty, no backup needed")
    
    return backup_path


def clean_output_dir(output_dir: Path):
    """Remove all files from output directory."""
    if output_dir.exists():
        print(f"Cleaning output directory: {output_dir}")
        for item in output_dir.iterdir():
            if item.is_file():
                item.unlink()
            elif item.is_dir():
                shutil.rmtree(item)
    else:
        output_dir.mkdir(parents=True, exist_ok=True)
        print(f"Created output directory: {output_dir}")


def run_pipeline(candidate_video_path: str, candidate_audio_path: str, interviewer_audio_path: str, jd_path: str):
    """Run the complete interview analysis pipeline."""
    
    # Setup directories
    project_root = Path(__file__).parent
    output_dir = project_root / "output"
    results_dir = project_root / "results"
    
    results_dir.mkdir(parents=True, exist_ok=True)
    
    print("="*80)
    print("INTERVIEW ANALYSIS PIPELINE")
    print("="*80)
    print(f"Job Description: {jd_path}")
    print(f"Candidate Video: {candidate_video_path}")
    print(f"Candidate Audio: {candidate_audio_path}")
    print(f"Interviewer Audio: {interviewer_audio_path}")
    print("="*80)
    
    # Step 1: Backup existing output
    print("\n[STEP 1] Backing up previous output...")
    backup_path = backup_output_dir(output_dir, results_dir)
    
    # Step 2: Clean output directory
    print("\n[STEP 2] Cleaning output directory...")
    clean_output_dir(output_dir)
    
    # Step 3: Run Stage 0 - Timebase (uses the provided file paths directly)
    print("\n[STAGE 0] Extracting canonical timebase...")
    
    # Extract dataset_id from filename
    video_name = Path(candidate_video_path).name
    match = re.match(r'^(\d+)_', video_name)
    dataset_id = match.group(1) if match else "unknown"
    
    # Create symlinks in a temp location for stage 0
    temp_dir = project_root / "temp_input"
    temp_dir.mkdir(exist_ok=True)
    
    # Create properly named symlinks
    temp_video = temp_dir / f"{dataset_id}_candidate_video.mp4"
    temp_cand_audio = temp_dir / f"{dataset_id}_candidate_audio.wav"
    temp_int_audio = temp_dir / f"{dataset_id}_interviewer_audio.wav"
    
    # Remove old symlinks if they exist
    for f in [temp_video, temp_cand_audio, temp_int_audio]:
        if f.exists() or f.is_symlink():
            f.unlink()
    
    # Create new symlinks
    temp_video.symlink_to(Path(candidate_video_path).resolve())
    temp_cand_audio.symlink_to(Path(candidate_audio_path).resolve())
    temp_int_audio.symlink_to(Path(interviewer_audio_path).resolve())
    
    timeline = timebase.run(str(temp_dir), str(output_dir), dataset_id)
    print(f"  Duration: {timeline['video']['duration_sec']:.2f}s")
    print(f"  FPS: {timeline['video']['fps']:.2f}")
    
    # Step 4: Run Stage 1A - Candidate Audio (DIRECT PATH)
    print("\n[STAGE 1A] Processing candidate audio...")
    candidate_audio.run(candidate_audio_path, str(output_dir), timeline)
    
    # Step 5: Run Stage 1B - Interviewer Audio (DIRECT PATH)
    print("\n[STAGE 1B] Processing interviewer audio...")
    interviewer_audio.run(interviewer_audio_path, str(output_dir))
    
    # Step 6: Run Stage 1C - Candidate Video (DIRECT PATH)
    print("\n[STAGE 1C] Processing candidate video...")
    candidate_video.run(candidate_video_path, str(output_dir), timeline)
    
    # Step 7: Run Stage 2 - Temporal Segmentation
    print("\n[STAGE 2] Building temporal segments and Q&A pairs...")
    segmentation.run(str(output_dir))
    
    # Step 8: Run Stage 3 - Behavioral Metrics
    print("\n[STAGE 3] Computing behavioral metrics...")
    metrics.run(str(output_dir))
    
    # Step 9: Run Stage 4+5 - Combined Scoring & Verdict
    print("\n[STAGE 4+5] Running LLM-driven scoring and verdict...")
    # Import combined scoring dynamically
    combined_scoring_path = project_root / "src" / "stage4+5" / "4+5.py"
    spec = __import__('importlib.util').util.spec_from_file_location("combined_scoring", combined_scoring_path)
    combined_scoring = __import__('importlib.util').util.module_from_spec(spec)
    spec.loader.exec_module(combined_scoring)
    combined_scoring.run(str(output_dir), jd_path)
    
    # Cleanup temp directory
    shutil.rmtree(temp_dir)
    
    # Summary
    print("\n" + "="*80)
    print("PIPELINE COMPLETE!")
    print("="*80)
    print(f"Results saved to: {output_dir}")
    if backup_path and backup_path.exists():
        print(f"Previous results backed up to: {backup_path}")
    print("\nOutput files:")
    for file in sorted(output_dir.glob("*.json")):
        print(f"  - {file.name}")
    print("="*80)


def main():
    parser = argparse.ArgumentParser(
        description="Run complete interview analysis pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Example:
  python main.py \\
    --video ./trans/1_candidate_video.mp4 \\
    --candidate-audio ./trans/1_candidate_audio.wav \\
    --interviewer-audio ./trans/1_interviewer_audio.wav \\
    --jd ./jd/system_architect.md
        """
    )
    
    parser.add_argument(
        "--video",
        required=True,
        help="Path to candidate video file (.mp4)"
    )
    parser.add_argument(
        "--candidate-audio",
        required=True,
        help="Path to candidate audio file (.wav)"
    )
    parser.add_argument(
        "--interviewer-audio",
        required=True,
        help="Path to interviewer audio file (.wav)"
    )
    parser.add_argument(
        "--jd",
        required=True,
        help="Path to job description file (.md or .txt)"
    )
    
    args = parser.parse_args()
    
    # Validate input files exist
    for path_arg, path_val in [
        ("video", args.video),
        ("candidate-audio", args.candidate_audio),
        ("interviewer-audio", args.interviewer_audio),
        ("jd", args.jd)
    ]:
        if not Path(path_val).exists():
            print(f"ERROR: {path_arg} file not found: {path_val}")
            sys.exit(1)
    
    # Run pipeline
    try:
        run_pipeline(
            args.video,
            args.candidate_audio,
            args.interviewer_audio,
            args.jd
        )
    except Exception as e:
        print(f"\n{'='*80}")
        print("PIPELINE FAILED!")
        print(f"{'='*80}")
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
