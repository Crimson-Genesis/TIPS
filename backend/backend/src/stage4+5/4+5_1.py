"""
Stage 4+5: Combined Relevance Scoring + Incremental Verdict Aggregation (4-BIT QUANTIZED)
Single-pass LLM evaluation with progressive interview profiling
"""
import json
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
import torch
import sys
import time

MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"

# -------------------------------
# Load Model (4-BIT QUANTIZED)
# -------------------------------
print("Loading tokenizer...", flush=True)
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
tokenizer.model_max_length = 8192

print("Loading model (4-bit quantized)...", flush=True)
quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4"
)

model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    device_map="auto",
    quantization_config=quantization_config,
    torch_dtype=torch.float16
)
print("Model ready (4-bit quantized, ~2GB VRAM)", flush=True)

# -------------------------------
# Utilities
# -------------------------------
def count_tokens(text: str) -> int:
    return len(tokenizer.encode(text, add_special_tokens=False))

def truncate_answer_tail(answer: str, max_tokens: int) -> str:
    ids = tokenizer.encode(answer, add_special_tokens=False)
    if len(ids) <= max_tokens:
        return answer
    truncated_ids = ids[-max_tokens:]
    return tokenizer.decode(truncated_ids, skip_special_tokens=True)

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

def load_qa_pairs(qa_path: str) -> list:
    with open(qa_path, 'r') as f:
        data = json.load(f)
    return data.get("qa_pairs", [])

# -------------------------------
# Build QA History Summary
# -------------------------------
def build_qa_summary(qa_history: list) -> str:
    """Build concise summary of previous QAs."""
    if not qa_history:
        return "This is the first question."
    
    summary_lines = []
    for item in qa_history[-3:]:  # Last 3 QAs only to save tokens
        q = item['question'][:60]
        rel = item['relevance_score']
        verdict = item['incremental_verdict']
        summary_lines.append(f"Q: {q}\nRelevance: {rel:.2f}, Verdict: {verdict}")
    
    return "\n\n".join(summary_lines)

# -------------------------------
# Combined Scoring + Incremental Verdict
# -------------------------------
def score_and_assess(
    jd_text: str,
    question: str,
    answer: str,
    qa_history: list,
    checkpoint_num: int
):
    """
    Single LLM call to:
    1. Score relevance to JD
    2. Extract keywords
    3. Assess competency dimensions
    4. Give incremental verdict
    """
    start_time = time.time()
    
    # Token management
    jd_tokens = count_tokens(jd_text)
    q_tokens = count_tokens(question)
    a_tokens = count_tokens(answer)
    
    RESERVED_TOKENS = 600  # More room for combined output
    available_for_answer = 8192 - jd_tokens - q_tokens - RESERVED_TOKENS
    
    if available_for_answer < 100:
        available_for_answer = 100
    
    print(f"  Tokens | JD={jd_tokens} Q={q_tokens} A={a_tokens} Available={available_for_answer}", flush=True)
    
    if a_tokens > available_for_answer:
        print(f"  Truncating answer from {a_tokens} to {available_for_answer} tokens", flush=True)
        answer = truncate_answer_tail(answer, available_for_answer)
    
    # Build history summary
    history_summary = build_qa_summary(qa_history)
    
    prompt = f"""You are evaluating a Machine Learning Engineer interview progressively.

Job Description:
{jd_text}

Interview Progress: Question {checkpoint_num}

Previous Questions Summary:
{history_summary}

Current Question:
{question}

Current Answer:
{answer}

TASK 1: Score this answer's relevance to the job description
- Evaluate semantic overlap (skills, tools, concepts, responsibilities)
- Extract matched keywords
- Provide reasoning

Scoring rubric:
0.0–0.2 → no relevance
0.2–0.4 → weak relevance
0.4–0.6 → partial relevance
0.6–0.8 → strong relevance
0.8–1.0 → direct relevance

TASK 2: Assess candidate competency SO FAR (questions 1 to {checkpoint_num})
Based on CUMULATIVE evidence across all {checkpoint_num} questions:
- technical_depth: ML/AI technical knowledge (0.0-1.0)
- system_design: Architecture thinking (0.0-1.0)
- production_experience: Real-world deployment (0.0-1.0)
- communication_clarity: Explanation quality (0.0-1.0)
- problem_solving: Analytical approach (0.0-1.0)

Give incremental verdict: "strong_progress", "adequate_progress", "weak_progress", or "no_signal"

Rules:
- Base ALL scores on demonstrated evidence
- Lower scores = weak/missing evidence
- Higher scores = concrete examples + depth
- Use ONLY provided content, NO hallucination

Respond with ONLY valid JSON:
{{
  "relevance_score": float,
  "matched_keywords": [string],
  "relevance_reason": string,
  "technical_depth": float,
  "system_design": float,
  "production_experience": float,
  "communication_clarity": float,
  "problem_solving": float,
  "incremental_verdict": string,
  "assessment_reason": string
}}""".strip()
    
    messages = [{"role": "user", "content": prompt}]
    chat = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )
    
    inputs = tokenizer(chat, return_tensors="pt").to(model.device)
    
    print(f"  Running LLM (combined scoring + assessment)...", flush=True)
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=500,
            do_sample=False,
            pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id
        )
    
    elapsed = time.time() - start_time
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
            "relevance_score": 0.0,
            "matched_keywords": [],
            "relevance_reason": "LLM output invalid",
            "technical_depth": 0.0,
            "system_design": 0.0,
            "production_experience": 0.0,
            "communication_clarity": 0.0,
            "problem_solving": 0.0,
            "incremental_verdict": "no_signal",
            "assessment_reason": "LLM output invalid"
        }
    
    return result

# -------------------------------
# Final Verdict
# -------------------------------
def get_final_verdict(jd_text: str, timeline: list):
    """Ask LLM for final hiring verdict based on complete interview."""
    start_time = time.time()
    
    # Build comprehensive summary
    qa_summary = []
    for entry in timeline:
        q = entry['question'][:80]
        rel = entry['relevance_score']
        verdict = entry['incremental_verdict']
        scores = entry['competency_scores']
        qa_summary.append(
            f"Q: {q}\n"
            f"Relevance: {rel:.2f}, Verdict: {verdict}\n"
            f"Scores: Tech={scores['technical_depth']:.2f} Design={scores['system_design']:.2f} "
            f"Prod={scores['production_experience']:.2f}"
        )
    
    summary_text = "\n\n".join(qa_summary)
    
    # Final scores from last checkpoint
    final_checkpoint = timeline[-1]
    final_scores = final_checkpoint['competency_scores']
    
    prompt = f"""You are making a final hiring decision for a Machine Learning Engineer position.

Job Description:
{jd_text[:1000]}

Complete Interview Summary ({len(timeline)} questions):
{summary_text}

Final Cumulative Competency Scores:
- Technical Depth: {final_scores['technical_depth']:.2f}
- System Design: {final_scores['system_design']:.2f}
- Production Experience: {final_scores['production_experience']:.2f}
- Communication Clarity: {final_scores['communication_clarity']:.2f}
- Problem Solving: {final_scores['problem_solving']:.2f}

Based on the COMPLETE interview, make a hiring decision:

Verdict options:
- "STRONG_HIRE": Exceeds expectations, clear hire
- "HIRE": Meets requirements, would hire
- "BORDERLINE": Mixed signals, need more data
- "NO_HIRE": Does not meet requirements

Confidence levels: "HIGH", "MEDIUM", "LOW"

Provide:
1. Final verdict
2. Confidence level
3. Overall score (0.0-1.0)
4. Detailed reason (2-3 sentences)

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
    
    elapsed = time.time() - start_time
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
def run(output_dir: str, jd_path: str):
    """Execute combined Stage 4+5 with live output."""
    total_start = time.time()
    
    output_dir = Path(output_dir)
    qa_path = output_dir / "qa_pairs.json"
    
    # Two output files
    relevance_output = output_dir / "relevance_scores.json"
    timeline_output = output_dir / "candidate_score_timeline.json"
    
    print("Loading inputs...", flush=True)
    
    jd_text = load_jd(jd_path)
    qa_pairs = load_qa_pairs(qa_path)
    
    print(f"Job Description: {len(jd_text)} chars, {count_tokens(jd_text)} tokens", flush=True)
    print(f"Processing {len(qa_pairs)} QA pairs...", flush=True)
    
    # Clear output files
    relevance_output.write_text("")
    timeline_output.write_text("")
    
    timeline = []
    qa_history = []
    
    # Process each QA
    for i, qa in enumerate(qa_pairs, 1):
        qa_id = qa.get("question_id", f"Q{i}")
        question = qa.get("question_text", "")
        answer = qa.get("answer", {}).get("text", "")
        
        print(f"\n{'='*60}", flush=True)
        print(f"[{i}/{len(qa_pairs)}] {qa_id}", flush=True)
        print(f"Question: {question[:80]}...", flush=True)
        
        if not answer or answer.strip().lower() == "no answer":
            print("  Skipping: No answer", flush=True)
            
            # Write to relevance_scores.json
            rel_entry = {
                "qa_id": qa_id,
                "question": question,
                "answer": answer,
                "relevance_score": 0.0,
                "matched_keywords": [],
                "justification": "No answer provided"
            }
            with open(relevance_output, 'a') as f:
                f.write(json.dumps(rel_entry) + "\n")
                f.flush()
            
            # Write to timeline
            timeline_entry = {
                "checkpoint": qa_id,
                "question": question,
                "relevance_score": 0.0,
                "matched_keywords": [],
                "competency_scores": {
                    "technical_depth": 0.0,
                    "system_design": 0.0,
                    "production_experience": 0.0,
                    "communication_clarity": 0.0,
                    "problem_solving": 0.0
                },
                "incremental_verdict": "no_signal",
                "reason": "No answer provided"
            }
            timeline.append(timeline_entry)
            
            with open(timeline_output, 'a') as f:
                f.write(json.dumps({"checkpoint_entry": timeline_entry}) + "\n")
                f.flush()
            
            continue
        
        # COMBINED LLM CALL
        llm_result = score_and_assess(
            jd_text,
            question,
            answer,
            qa_history,
            checkpoint_num=i
        )
        
        # Extract results
        relevance_score = max(0.0, min(1.0, float(llm_result.get("relevance_score", 0.0))))
        keywords = llm_result.get("matched_keywords", [])
        relevance_reason = llm_result.get("relevance_reason", "")
        
        competency_scores = {
            "technical_depth": round(llm_result.get("technical_depth", 0.0), 3),
            "system_design": round(llm_result.get("system_design", 0.0), 3),
            "production_experience": round(llm_result.get("production_experience", 0.0), 3),
            "communication_clarity": round(llm_result.get("communication_clarity", 0.0), 3),
            "problem_solving": round(llm_result.get("problem_solving", 0.0), 3)
        }
        
        incremental_verdict = llm_result.get("incremental_verdict", "no_signal")
        assessment_reason = llm_result.get("assessment_reason", "")
        
        print(f"  Relevance: {relevance_score:.2f}", flush=True)
        print(f"  Keywords: {', '.join(keywords)}", flush=True)
        print(f"  Verdict: {incremental_verdict}", flush=True)
        print(f"  Scores: Tech={competency_scores['technical_depth']} "
              f"Design={competency_scores['system_design']} "
              f"Prod={competency_scores['production_experience']}", flush=True)
        
        # Write to relevance_scores.json (Stage 4 format)
        rel_entry = {
            "qa_id": qa_id,
            "question": question,
            "answer": answer,
            "relevance_score": round(relevance_score, 2),
            "matched_keywords": keywords,
            "justification": relevance_reason
        }
        with open(relevance_output, 'a') as f:
            f.write(json.dumps(rel_entry) + "\n")
            f.flush()
        
        # Write to timeline (Stage 5 format)
        timeline_entry = {
            "checkpoint": qa_id,
            "question": question,
            "relevance_score": round(relevance_score, 2),
            "matched_keywords": keywords,
            "competency_scores": competency_scores,
            "incremental_verdict": incremental_verdict,
            "reason": assessment_reason
        }
        timeline.append(timeline_entry)
        
        with open(timeline_output, 'a') as f:
            f.write(json.dumps({"checkpoint_entry": timeline_entry}) + "\n")
            f.flush()
        
        # Update history
        qa_history.append({
            "question": question,
            "relevance_score": relevance_score,
            "incremental_verdict": incremental_verdict
        })
    
    # Get final verdict
    print(f"\n{'='*60}", flush=True)
    print("Getting final hiring verdict...", flush=True)
    
    final_result = get_final_verdict(jd_text, timeline)
    
    final_verdict = {
        "verdict": final_result.get("verdict", "NO_HIRE"),
        "confidence": final_result.get("confidence", "LOW"),
        "overall_score": round(final_result.get("overall_score", 0.0), 3),
        "reason": final_result.get("reason", "")
    }
    
    # Write final verdict
    with open(timeline_output, 'a') as f:
        f.write(json.dumps({"final_verdict": final_verdict}) + "\n")
        f.flush()
    
    total_elapsed = time.time() - total_start
    
    print(f"\n{'='*60}", flush=True)
    print(f"Combined Stage 4+5 complete!", flush=True)
    print(f"Outputs:", flush=True)
    print(f"  - {relevance_output}", flush=True)
    print(f"  - {timeline_output}", flush=True)
    print(f"Final Verdict: {final_verdict['verdict']} ({final_verdict['confidence']} confidence)", flush=True)
    print(f"Overall Score: {final_verdict['overall_score']}", flush=True)
    print(f"Total time: {total_elapsed/60:.2f} minutes", flush=True)
    print(f"Average per Q&A: {total_elapsed/len(qa_pairs):.2f}s", flush=True)

# -------------------------------
# Entry Point
# -------------------------------
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python combined_scoring.py <output_dir> <jd_path>")
        print("Example: python combined_scoring.py output config/job_description.md")
        sys.exit(1)
    
    run(sys.argv[1], sys.argv[2])
