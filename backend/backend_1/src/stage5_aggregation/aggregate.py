"""
Stage 5: LLM-Driven Incremental Verdict Aggregation
Progressive interview profiling with LLM judgments at each checkpoint
"""
import json
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import sys

MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"

# -------------------------------
# Load Model
# -------------------------------
print("Loading tokenizer...", flush=True)
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
tokenizer.model_max_length = 8192

print("Loading model (full precision)...", flush=True)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    device_map="auto",
    torch_dtype=torch.float16
)
print("Model ready", flush=True)

# -------------------------------
# Utilities
# -------------------------------
def extract_last_json(text: str):
    """Extract the LAST valid JSON object from model output."""
    start = -1
    depth = 0
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start != -1:
                candidate = text[start:i + 1]
                try:
                    return json.loads(candidate)
                except Exception:
                    start = -1
                    depth = 0
    return None

# -------------------------------
# Load Data
# -------------------------------
def load_jd(jd_path: str) -> str:
    with open(jd_path, 'r') as f:
        return f.read().strip()

def load_relevance_scores(scores_path: str) -> list:
    scores = []
    with open(scores_path, 'r') as f:
        for line in f:
            if line.strip():
                scores.append(json.loads(line))
    return scores

def load_qa_pairs(qa_path: str) -> list:
    with open(qa_path, 'r') as f:
        data = json.load(f)
    return data.get("qa_pairs", [])

# -------------------------------
# LLM Incremental Judgment
# -------------------------------
def build_qa_summary(qa_history: list) -> str:
    """Build concise summary of QA history for context."""
    if not qa_history:
        return "No previous questions."
    
    summary_lines = []
    for item in qa_history[-5:]:  # Last 5 QAs only
        q = item['question'][:80]
        a = item['answer'][:100]
        rel = item['relevance']
        summary_lines.append(f"Q: {q}\nA: {a}\nRelevance: {rel:.2f}")
    
    return "\n\n".join(summary_lines)

def get_incremental_verdict(
    jd_text: str,
    qa_history: list,
    current_qa: dict,
    relevance_data: dict
):
    """
    Ask LLM for incremental verdict based on interview progress.
    
    Returns incremental assessment after each question.
    """
    import time
    start = time.time()
    
    history_summary = build_qa_summary(qa_history)
    current_q = current_qa['question_text']
    current_a = current_qa['answer']['text']
    current_rel = relevance_data['relevance_score']
    current_keywords = ', '.join(relevance_data['matched_keywords'])
    
    checkpoint_num = len(qa_history) + 1
    total_questions = checkpoint_num  # We know this after each question
    
    prompt = f"""You are an interview evaluator tracking candidate performance progressively.

Job Description:
{jd_text[:1000]}

Interview Progress: Question {checkpoint_num}

Previous Questions Summary:
{history_summary}

Current Question:
{current_q}

Current Answer:
{current_a}

Current Answer Relevance: {current_rel:.2f}
Keywords Matched: {current_keywords}

Based on the interview SO FAR (questions 1 to {checkpoint_num}), evaluate the candidate across these dimensions:
- technical_depth: ML/AI technical knowledge
- system_design: Architecture and scalability thinking
- production_experience: Real-world deployment knowledge
- communication_clarity: Explanation quality
- problem_solving: Analytical approach

Provide:
1. Score (0.0-1.0) for each dimension based on evidence SO FAR
2. Incremental verdict: "strong_progress", "adequate_progress", "weak_progress", or "no_signal"
3. Brief reason (1-2 sentences)

Rules:
- Base scores ONLY on demonstrated evidence in answers
- Lower scores if evidence is weak or missing
- Higher scores require concrete examples and depth
- Consider CUMULATIVE performance across all questions asked so far

Respond with ONLY valid JSON:
{{
  "technical_depth": float,
  "system_design": float,
  "production_experience": float,
  "communication_clarity": float,
  "problem_solving": float,
  "incremental_verdict": string,
  "reason": string
}}""".strip()
    
    messages = [{"role": "user", "content": prompt}]
    chat = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )
    
    inputs = tokenizer(chat, return_tensors="pt").to(model.device)
    
    print(f"  Running LLM for checkpoint {checkpoint_num}...", flush=True)
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=400,
            do_sample=False,
            pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id
        )
    
    elapsed = time.time() - start
    print(f"  LLM finished in {elapsed:.2f}s", flush=True)
    
    decoded = tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    if chat in decoded:
        generated_only = decoded.split(chat)[-1].strip()
    else:
        generated_only = decoded
    
    result = extract_last_json(generated_only)
    
    if result is None:
        print("  ERROR: Invalid JSON from LLM", flush=True)
        print("  Generated:", generated_only[:200], flush=True)
        return {
            "technical_depth": 0.0,
            "system_design": 0.0,
            "production_experience": 0.0,
            "communication_clarity": 0.0,
            "problem_solving": 0.0,
            "incremental_verdict": "no_signal",
            "reason": "LLM output invalid"
        }
    
    return result

# -------------------------------
# Final Verdict
# -------------------------------
def get_final_verdict(jd_text: str, timeline: list, all_qa: list):
    """
    Ask LLM for final hiring verdict based on complete interview.
    """
    import time
    start = time.time()
    
    # Build comprehensive summary
    qa_summary = []
    for i, (tl, qa) in enumerate(zip(timeline, all_qa), 1):
        q = qa['question_text'][:80]
        a = qa['answer']['text'][:150]
        scores = tl['scores']
        verdict = tl['incremental_verdict']
        qa_summary.append(
            f"Q{i}: {q}\n"
            f"A: {a}\n"
            f"Checkpoint Verdict: {verdict}\n"
            f"Scores: Tech={scores['technical_depth']:.2f} Design={scores['system_design']:.2f} "
            f"Prod={scores['production_experience']:.2f}"
        )
    
    summary_text = "\n\n".join(qa_summary)
    
    # Final scores from last checkpoint
    final_checkpoint = timeline[-1]
    final_scores = final_checkpoint['scores']
    
    prompt = f"""You are making a final hiring decision for a Machine Learning Engineer position.

Job Description:
{jd_text[:1000]}

Complete Interview Summary ({len(timeline)} questions):
{summary_text}

Final Cumulative Scores:
- Technical Depth: {final_scores['technical_depth']:.2f}
- System Design: {final_scores['system_design']:.2f}
- Production Experience: {final_scores['production_experience']:.2f}
- Communication Clarity: {final_scores['communication_clarity']:.2f}
- Problem Solving: {final_scores['problem_solving']:.2f}

Based on the COMPLETE interview, make a hiring decision:

Verdict options:
- "STRONG_HIRE": Exceeds expectations, clear hire
- "HIRE": Meets requirements, would hire
- "BORDERLINE": Mixed signals, could go either way
- "NO_HIRE": Does not meet requirements

Confidence levels: "HIGH", "MEDIUM", "LOW"

Provide:
1. Final verdict (STRONG_HIRE/HIRE/BORDERLINE/NO_HIRE)
2. Confidence (HIGH/MEDIUM/LOW)
3. Overall score (0.0-1.0)
4. Detailed reason (2-3 sentences explaining decision)

Respond with ONLY valid JSON:
{{
  "verdict": string,
  "confidence": string,
  "overall_score": float,
  "reason": string
}}""".strip()
    
    messages = [{"role": "user", "content": prompt}]
    chat = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )
    
    inputs = tokenizer(chat, return_tensors="pt").to(model.device)
    
    print("\nRunning final verdict LLM...", flush=True)
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=400,
            do_sample=False,
            pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id
        )
    
    elapsed = time.time() - start
    print(f"Final verdict LLM finished in {elapsed:.2f}s", flush=True)
    
    decoded = tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    if chat in decoded:
        generated_only = decoded.split(chat)[-1].strip()
    else:
        generated_only = decoded
    
    result = extract_last_json(generated_only)
    
    if result is None:
        print("ERROR: Invalid JSON from final verdict LLM", flush=True)
        print("Generated:", generated_only[:200], flush=True)
        return {
            "verdict": "NO_HIRE",
            "confidence": "LOW",
            "overall_score": 0.0,
            "reason": "LLM output invalid"
        }
    
    return result

# -------------------------------
# Runner
# -------------------------------

# Replace the run() function with this:

def run(output_dir: str, jd_path: str):
    """Execute Stage 5 with LLM-driven verdicts (LIVE OUTPUT)."""
    import time
    total_start = time.time()
    
    output_dir = Path(output_dir)
    
    relevance_path = output_dir / "relevance_scores.json"
    qa_path = output_dir / "qa_pairs.json"
    output_path = output_dir / "candidate_score_timeline.json"
    
    print("Loading inputs...", flush=True)
    
    jd_text = load_jd(jd_path)
    relevance_scores = load_relevance_scores(relevance_path)
    qa_pairs = load_qa_pairs(qa_path)
    
    print(f"Job Description: {len(jd_text)} chars", flush=True)
    print(f"Processing {len(relevance_scores)} QA pairs...", flush=True)
    
    # CLEAR OUTPUT FILE
    output_path.write_text("")
    
    timeline = []
    qa_history = []
    
    # Process each QA incrementally
    for i, (rel_score, qa_pair) in enumerate(zip(relevance_scores, qa_pairs), 1):
        qa_id = rel_score.get("qa_id", f"Q{i}")
        
        print(f"\n{'='*60}", flush=True)
        print(f"Checkpoint {i}/{len(relevance_scores)}: {qa_id}", flush=True)
        
        # Skip if no answer
        if not qa_pair['answer']['text'] or qa_pair['answer']['text'].lower() == "no answer":
            print("  Skipping: No answer", flush=True)
            checkpoint_entry = {
                "checkpoint": qa_id,
                "question": qa_pair['question_text'],
                "scores": {
                    "technical_depth": 0.0,
                    "system_design": 0.0,
                    "production_experience": 0.0,
                    "communication_clarity": 0.0,
                    "problem_solving": 0.0
                },
                "incremental_verdict": "no_signal",
                "reason": "No answer provided"
            }
            timeline.append(checkpoint_entry)
            
            # WRITE CHECKPOINT IMMEDIATELY
            with open(output_path, 'a') as f:
                f.write(json.dumps({"checkpoint_entry": checkpoint_entry}) + "\n")
                f.flush()
            
            continue
        
        # Get LLM incremental verdict
        llm_result = get_incremental_verdict(
            jd_text,
            qa_history,
            qa_pair,
            rel_score
        )
        
        scores = {
            "technical_depth": round(llm_result.get("technical_depth", 0.0), 3),
            "system_design": round(llm_result.get("system_design", 0.0), 3),
            "production_experience": round(llm_result.get("production_experience", 0.0), 3),
            "communication_clarity": round(llm_result.get("communication_clarity", 0.0), 3),
            "problem_solving": round(llm_result.get("problem_solving", 0.0), 3)
        }
        
        verdict = llm_result.get("incremental_verdict", "no_signal")
        reason = llm_result.get("reason", "")
        
        print(f"  Verdict: {verdict}", flush=True)
        print(f"  Scores: Tech={scores['technical_depth']} Design={scores['system_design']} "
              f"Prod={scores['production_experience']}", flush=True)
        
        checkpoint_entry = {
            "checkpoint": qa_id,
            "question": qa_pair['question_text'],
            "scores": scores,
            "incremental_verdict": verdict,
            "reason": reason
        }
        
        timeline.append(checkpoint_entry)
        
        # WRITE CHECKPOINT IMMEDIATELY (LIVE)
        with open(output_path, 'a') as f:
            f.write(json.dumps({"checkpoint_entry": checkpoint_entry}) + "\n")
            f.flush()
        
        # Update history
        qa_history.append({
            "question": qa_pair['question_text'],
            "answer": qa_pair['answer']['text'],
            "relevance": rel_score['relevance_score']
        })
    
    # Get final verdict from LLM
    print(f"\n{'='*60}", flush=True)
    print("Getting final hiring verdict...", flush=True)
    
    final_result = get_final_verdict(jd_text, timeline, qa_pairs)
    
    final_verdict = {
        "verdict": final_result.get("verdict", "NO_HIRE"),
        "confidence": final_result.get("confidence", "LOW"),
        "overall_score": round(final_result.get("overall_score", 0.0), 3),
        "reason": final_result.get("reason", "")
    }
    
    # WRITE FINAL VERDICT
    with open(output_path, 'a') as f:
        f.write(json.dumps({"final_verdict": final_verdict}) + "\n")
        f.flush()
    
    total_elapsed = time.time() - total_start
    
    print(f"\n{'='*60}", flush=True)
    print(f"Stage 5 complete: {output_path}", flush=True)
    print(f"Final Verdict: {final_verdict['verdict']} ({final_verdict['confidence']} confidence)", flush=True)
    print(f"Overall Score: {final_verdict['overall_score']}", flush=True)
    print(f"Total time: {total_elapsed/60:.2f} minutes", flush=True)

# -------------------------------
# Entry Point
# -------------------------------
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python aggregation.py <output_dir> <jd_path>")
        print("Example: python aggregation.py output config/job_description.md")
        sys.exit(1)
    
    run(sys.argv[1], sys.argv[2])
