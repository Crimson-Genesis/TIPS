# Backend ML Pipeline

## Setup

```bash
cd backend
pip install -r requirements.txt
```

## Running the Pipeline

```bash
# Run with default JD (product_manager)
python run_pipeline.py --input-dir ../trans/2 --jd ../jd/product_manager.md

# Or run with system_architect JD
python run_pipeline.py --input-dir ../trans/2 --jd ../jd/system_architect.md
```

## Input Files

- `trans/2_candidate_audio.wav` - Candidate audio
- `trans/2_candidate_video.mp4` - Candidate video
- `trans/2_interviewer_audio.wav` - Interviewer audio

## Output

All pipeline artifacts are saved to `output/` directory.
