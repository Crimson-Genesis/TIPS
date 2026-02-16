"""
Stage 5: JD-Conditioned Incremental Verdict Aggregation
"""
import json
from pathlib import Path


def parse_jd_axes(jd_path: str) -> dict:
    """Parse job description to extract competency axes."""
    with open(jd_path, 'r') as f:
        jd_text = f.read()
    
    jd_lower = jd_text.lower()
    
    axes = {
        "technical_depth": 0.25,
        "system_design": 0.25,
        "production_experience": 0.20,
        "communication_clarity": 0.15,
        "problem_solving": 0.15
    }
    
    return {"axes": axes, "jd_text": jd_text[:500]}


def load_relevance_scores(scores_path: str) -> list:
    """Load relevance scores from Stage 4."""
    scores = []
    with open(scores_path, 'r') as f:
        for line in f:
            if line.strip():
                scores.append(json.loads(line))
    return scores


def load_behavioral_metrics(metrics_path: str) -> list:
    """Load behavioral metrics from Stage 3."""
    with open(metrics_path, 'r') as f:
        data = json.load(f)
    return data.get("segments", [])


def assign_axis_scores(relevance_score: float, keywords: list) -> dict:
    """Assign scores to axes based on relevance and keywords."""
    keywords_lower = [k.lower() for k in keywords]
    keywords_text = " ".join(keywords_lower)
    
    technical_keywords = ["machine learning", "python", "model", "algorithm", "deep learning", "neural", "tensorflow", "pytorch"]
    system_keywords = ["system", "architecture", "design", "scale", "distributed", "pipeline", "infrastructure"]
    production_keywords = ["production", "deployment", "monitoring", "latency", "serving", "real-time", "batch"]
    communication_keywords = ["explain", "describe", "communicate", "team", "stakeholder"]
    problem_solving_keywords = ["problem", "solution", "debug", "issue", "challenge", "optimize"]
    
    scores = {}
    
    scores["technical_depth"] = relevance_score * (1.0 + 0.1 * sum(1 for k in technical_keywords if k in keywords_text))
    scores["system_design"] = relevance_score * (1.0 + 0.1 * sum(1 for k in system_keywords if k in keywords_text))
    scores["production_experience"] = relevance_score * (1.0 + 0.1 * sum(1 for k in production_keywords if k in keywords_text))
    scores["communication_clarity"] = min(1.0, relevance_score * 1.2)
    scores["problem_solving"] = relevance_score * (1.0 + 0.1 * sum(1 for k in problem_solving_keywords if k in keywords_text))
    
    for key in scores:
        scores[key] = min(1.0, scores[key])
    
    return scores


def compute_checkpoint_score(axis_scores: dict, weights: dict) -> float:
    """Compute weighted overall score."""
    total = 0.0
    for axis, score in axis_scores.items():
        total += score * weights.get(axis, 0.2)
    return total


def get_verdict(score: float) -> str:
    """Determine verdict based on score."""
    if score >= 0.75:
        return "strong_fit"
    elif score >= 0.55:
        return "borderline"
    elif score >= 0.35:
        return "weak_fit"
    else:
        return "no_signal"


def get_final_verdict(score: float) -> tuple:
    """Determine final verdict and confidence."""
    if score >= 0.65:
        return ("FIT", "HIGH")
    elif score >= 0.50:
        return ("FIT", "MEDIUM")
    elif score >= 0.40:
        return ("NOT_FIT", "MEDIUM")
    else:
        return ("NOT_FIT", "LOW")


def run():
    """Execute Stage 5."""
    
    output_dir = Path("/run/media/nico/nova/projects/micro_project_mca_3_sem/backend/backend/output")
    jd_path = "/run/media/nico/nova/projects/micro_project_mca_3_sem/backend/jd/machine_leaning_engineer.md"
    
    relevance_path = output_dir / "relevance_scores.json"
    metrics_path = output_dir / "candidate_behavior_metrics.json"
    output_path = output_dir / "candidate_score_timeline.json"
    
    print("Loading inputs...", flush=True)
    
    jd_data = parse_jd_axes(jd_path)
    weights = jd_data["axes"]
    
    relevance_scores = load_relevance_scores(relevance_path)
    behavioral_metrics = load_behavioral_metrics(metrics_path)
    
    print(f"Processing {len(relevance_scores)} QA pairs...", flush=True)
    
    timeline = []
    cumulative_scores = {axis: [] for axis in weights}
    
    for i, rs in enumerate(relevance_scores):
        qa_id = rs.get("qa_id", f"Q{i+1}")
        
        relevance = rs.get("relevance_score", 0.0)
        keywords = rs.get("matched_keywords", [])
        
        axis_scores = assign_axis_scores(relevance, keywords)
        
        for axis, score in axis_scores.items():
            cumulative_scores[axis].append(score)
        
        checkpoint_scores = {}
        for axis in weights:
            if cumulative_scores[axis]:
                checkpoint_scores[axis] = sum(cumulative_scores[axis]) / len(cumulative_scores[axis])
            else:
                checkpoint_scores[axis] = 0.0
        
        overall_score = compute_checkpoint_score(checkpoint_scores, weights)
        verdict = get_verdict(overall_score)
        
        timeline.append({
            "checkpoint": qa_id,
            "time_sec": 0.0,
            "scores": {k: round(v, 3) for k, v in checkpoint_scores.items()},
            "overall_score": round(overall_score, 3),
            "verdict": verdict
        })
    
    final_score = timeline[-1]["overall_score"] if timeline else 0.0
    final_verdict, confidence = get_final_verdict(final_score)
    
    reason = f"Based on cumulative score of {final_score:.2f} across {len(timeline)} questions"
    
    output = {
        "dataset_id": "2",
        "timeline": timeline,
        "final_verdict": {
            "overall_score": round(final_score, 3),
            "verdict": final_verdict,
            "confidence": confidence,
            "reason": reason
        }
    }
    
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"Stage 5 complete: {output_path}", flush=True)
    print(f"Final verdict: {final_verdict} ({confidence})", flush=True)


if __name__ == "__main__":
    run()
