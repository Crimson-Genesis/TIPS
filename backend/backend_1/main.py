"""
Main Orchestration Script
Runs the complete interview analysis pipeline
(SEQUENTIAL STAGE 0 + PARALLEL 1A/1B/1C + SEQUENTIAL 2/3/4+5)
"""

import sys
import shutil
import uuid
import re
import argparse
import subprocess
import os
import signal
import json
from pathlib import Path


def run_stage_blocking(cmd, name):
    print("=" * 80)
    print(f"[START] {name}")
    print("=" * 80)

    proc = subprocess.Popen(
        cmd,
        preexec_fn=os.setsid,
    )

    try:
        proc.wait()
    finally:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass

    if proc.returncode != 0:
        raise RuntimeError(f"{name} failed")

    print(f"\n[COMPLETE] {name}\n")


def run_inline_stage(code, name, output_dir):
    print("=" * 80)
    print(f"[START] {name}")
    print("=" * 80)

    env = os.environ.copy()
    proc = subprocess.Popen(
        [sys.executable, "-c", code],
        preexec_fn=os.setsid,
        env=env,
    )

    try:
        proc.wait()
    finally:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass

    if proc.returncode != 0:
        raise RuntimeError(f"{name} failed")

    print(f"\n[COMPLETE] {name}\n")


def run_parallel_stages(commands_with_names, output_dir):
    print("=" * 80)
    stage_names = [name for _, name in commands_with_names]
    print(f"[START] PARALLEL: {', '.join(stage_names)}")
    print("=" * 80)

    procs = []
    for cmd, name in commands_with_names:
        proc = subprocess.Popen(
            cmd,
            preexec_fn=os.setsid,
        )
        procs.append((proc, name))
        print(f"Launched: {name}")

    print("\nWaiting for all parallel stages to complete...\n")

    for proc, name in procs:
        try:
            proc.wait()
        finally:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass

        if proc.returncode != 0:
            raise RuntimeError(f"{name} failed")
        print(f"Completed: {name}")

    print(f"\n[COMPLETE] PARALLEL: {', '.join(stage_names)}\n")


def get_next_run_number(results_dir: Path) -> int:
    if not results_dir.exists():
        return 1
    nums = []
    for d in results_dir.iterdir():
        if d.is_dir():
            try:
                nums.append(int(d.name.split("-")[0]))
            except:
                pass
    return max(nums) + 1 if nums else 1


def backup_output_dir(output_dir: Path, results_dir: Path):
    run_number = get_next_run_number(results_dir)
    run_uuid = str(uuid.uuid4())[:8]
    backup_path = results_dir / f"{run_number:03d}-{run_uuid}"

    if output_dir.exists() and any(output_dir.iterdir()):
        print(f"Backing up output to: {backup_path}")
        shutil.copytree(output_dir, backup_path)
    else:
        print("Output directory empty, no backup needed")

    return backup_path


def clean_output_dir(output_dir: Path):
    if output_dir.exists():
        for item in output_dir.iterdir():
            if item.is_file():
                item.unlink()
            else:
                shutil.rmtree(item)
    else:
        output_dir.mkdir(parents=True)


def run_pipeline(video, candidate_audio, interviewer_audio, jd):
    root = Path(__file__).parent
    output = root / "output"
    results = root / "results"
    temp = root / "temp_input"

    results.mkdir(exist_ok=True)

    print("=" * 80)
    print("INTERVIEW ANALYSIS PIPELINE")
    print("=" * 80)

    backup_output_dir(output, results)
    clean_output_dir(output)

    match = re.match(r"^(\d+)_", Path(video).name)
    dataset_id = match.group(1) if match else "unknown"

    temp.mkdir(exist_ok=True)

    for f in temp.iterdir():
        f.unlink()

    (temp / f"{dataset_id}_candidate_video.mp4").symlink_to(Path(video).resolve())
    (temp / f"{dataset_id}_candidate_audio.wav").symlink_to(Path(candidate_audio).resolve())
    (temp / f"{dataset_id}_interviewer_audio.wav").symlink_to(Path(interviewer_audio).resolve())

    py = sys.executable

    # ----------------------------
    # STAGE 0 — TIMEBASE (SEQUENTIAL)
    # ----------------------------
    run_stage_blocking(
        [py, "src/stage0_timebase/timebase.py", str(temp), str(output), dataset_id],
        "STAGE 0 — TIMEBASE"
    )

    # ----------------------------
    # STAGES 1A, 1B, 1C — PARALLEL
    # ----------------------------
    output_str = str(output)

    code_1a = f"""
import sys
from pathlib import Path
sys.path.insert(0, 'src')
from stage1_extraction import candidate_audio
import json
with open('{output_str}/timeline.json') as f:
    timeline = json.load(f)
candidate_audio.run('{candidate_audio}', '{output_str}', timeline)
"""

    code_1b = f"""
import sys
from pathlib import Path
sys.path.insert(0, 'src')
from stage1_extraction import interviewer_audio
interviewer_audio.run('{interviewer_audio}', '{output_str}')
"""

    code_1c = f"""
import sys
from pathlib import Path
sys.path.insert(0, 'src')
from stage1_extraction import candidate_video
import json
with open('{output_str}/timeline.json') as f:
    timeline = json.load(f)
candidate_video.run('{video}', '{output_str}', timeline)
"""

    commands_with_names = [
        ([py, "-c", code_1a], "STAGE 1A — CANDIDATE AUDIO"),
        ([py, "-c", code_1b], "STAGE 1B — INTERVIEWER AUDIO"),
        ([py, "-c", code_1c], "STAGE 1C — CANDIDATE VIDEO"),
    ]

    run_parallel_stages(commands_with_names, output)

    # ----------------------------
    # STAGE 2 — TEMPORAL GROUPING
    # ----------------------------
    run_stage_blocking(
        [py, "src/stage2_temporal/segmentation.py", str(output)],
        "STAGE 2 — TEMPORAL GROUPING"
    )

    # ----------------------------
    # STAGE 3 — BEHAVIOR METRICS
    # ----------------------------
    run_stage_blocking(
        [py, "src/stage3_behavior/metrics.py", str(output)],
        "STAGE 3 — BEHAVIOR METRICS"
    )

    # ----------------------------
    # STAGE 4+5 — SEMANTIC + VERDICT
    # ----------------------------
    run_stage_blocking(
        [py, "src/stage4+5/4+5.py", str(output), jd],
        "STAGE 4+5 — SCORING & VERDICT"
    )

    shutil.rmtree(temp)

    print("=" * 80)
    print("PIPELINE COMPLETE")
    print("=" * 80)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--candidate-audio", required=True)
    parser.add_argument("--interviewer-audio", required=True)
    parser.add_argument("--jd", required=True)
    args = parser.parse_args()

    run_pipeline(
        args.video,
        args.candidate_audio,
        args.interviewer_audio,
        args.jd
    )


if __name__ == "__main__":
    main()
