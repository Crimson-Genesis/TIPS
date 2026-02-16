"""
Stage 4: Semantic Relevance Scoring
Token-aware, JSON-forced, live output
"""
import json
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import sys

MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"

# -------------------------------
# Load tokenizer & model
# -------------------------------
print("Loading tokenizer...", flush=True)
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)

# HARD CAP effective context window (CRITICAL)
EFFECTIVE_MAX_TOKENS = 8192
tokenizer.model_max_length = EFFECTIVE_MAX_TOKENS
print(f"Model max tokens (effective): {EFFECTIVE_MAX_TOKENS}", flush=True)

print("Loading model...", flush=True)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    device_map="auto",
    torch_dtype="auto"
)
print("Model ready", flush=True)

# -------------------------------
# Utilities
# -------------------------------
def count_tokens(text: str) -> int:
    """Count tokens in text."""
    return len(tokenizer.encode(text, add_special_tokens=False))

def truncate_answer_tail(answer: str, max_tokens: int) -> str:
    """Keep the LAST max_tokens of answer (tail-preserving truncation)."""
    ids = tokenizer.encode(answer, add_special_tokens=False)
    if len(ids) <= max_tokens:
        return answer
    truncated_ids = ids[-max_tokens:]
    return tokenizer.decode(truncated_ids, skip_special_tokens=True)

def extract_last_json(text: str):
    """
    Extract the LAST valid JSON object from model output.
    Robust against pre/postamble text.
    """
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
# LLM Scoring
# -------------------------------
def score_qa(question: str, answer: str, jd_text: str):
    """Score a single Q&A pair against the job description."""
    jd_tokens = count_tokens(jd_text)
    q_tokens = count_tokens(question)
    a_tokens = count_tokens(answer)
    
    RESERVED_TOKENS = 400  # prompt + JSON response safety buffer
    available_for_answer = EFFECTIVE_MAX_TOKENS - jd_tokens - q_tokens - RESERVED_TOKENS
    
    if available_for_answer < 100:
        available_for_answer = 100
    
    print(
        f"Tokens | JD={jd_tokens} Q={q_tokens} A={a_tokens} "
        f"AvailableForAnswer={available_for_answer}",
        flush=True
    )
    
    if a_tokens > available_for_answer:
        print(f"Truncating answer from {a_tokens} to {available_for_answer} tokens (tail-preserving)", flush=True)
        answer = truncate_answer_tail(answer, available_for_answer)
    
    prompt = f"""You are a semantic relevance evaluator.

Job Description:
{jd_text}

Interview Question:
{question}

Candidate Answer:
{answer}

Evaluate relevance STRICTLY based on semantic overlap with the job description:
- skills
- tools
- concepts
- responsibilities
- problem domains

Scoring rubric:
0.0–0.2 → no relevance
0.2–0.4 → weak relevance
0.4–0.6 → partial relevance
0.6–0.8 → strong relevance
0.8–1.0 → direct relevance

Rules:
- Use ONLY the provided content
- DO NOT infer emotion, confidence, intent, or style
- DO NOT hallucinate skills
- DO NOT default scores

Respond with ONLY valid JSON.
No text before or after JSON.

JSON format:
{{
  "score": float,
  "keywords": [string],
  "reason": string
}}""".strip()
    
    messages = [{"role": "user", "content": prompt}]
    chat = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )
    
    inputs = tokenizer(chat, return_tensors="pt").to(model.device)
    
    print("Running LLM...", flush=True)
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=300,
            do_sample=False,
            pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id
        )
    
    print("LLM finished", flush=True)
    
    decoded = tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    # Extract only the generated part (after the prompt)
    if chat in decoded:
        generated_only = decoded.split(chat)[-1].strip()
    else:
        generated_only = decoded
    
    result = extract_last_json(generated_only)
    
    if result is None:
        print("ERROR: Invalid JSON from LLM", flush=True)
        print("Generated output:", generated_only, flush=True)
        return {
            "score": 0.0,
            "keywords": [],
            "reason": "LLM output invalid JSON"
        }
    
    return result

# -------------------------------
# Runner
# -------------------------------
def run(output_dir: str, jd_path: str):
    """Execute Stage 4: Semantic Relevance Scoring."""
    output_dir = Path(output_dir)
    qa_path = output_dir / "qa_pairs.json"
    out_path = output_dir / "relevance_scores.json"
    
    # Load job description
    print(f"Loading job description from: {jd_path}", flush=True)
    with open(jd_path, "r") as f:
        jd_text = f.read().strip()
    
    print(f"JD length: {len(jd_text)} chars, {count_tokens(jd_text)} tokens", flush=True)
    
    # Load Q&A pairs
    print(f"Loading Q&A pairs from: {qa_path}", flush=True)
    with open(qa_path, "r") as f:
        qa_data = json.load(f)
    
    qa_pairs = qa_data.get("qa_pairs", [])
    print(f"Found {len(qa_pairs)} Q&A pairs", flush=True)
    
    # Clear output file
    out_path.write_text("")
    
    # Process each Q&A pair
    for idx, qa in enumerate(qa_pairs, start=1):
        qa_id = qa.get("question_id", f"Q{idx}")
        question = qa.get("question_text", "")
        answer = qa.get("answer", {}).get("text", "")
        
        print(f"\n{'='*60}", flush=True)
        print(f"[{idx}/{len(qa_pairs)}] {qa_id}", flush=True)
        print(f"Question: {question[:80]}...", flush=True)
        
        if not answer or answer.strip().lower() == "no answer":
            print("Skipping: No answer provided", flush=True)
            result = {
                "qa_id": qa_id,
                "question": question,
                "answer": answer,
                "relevance_score": 0.0,
                "matched_keywords": [],
                "justification": "No answer provided"
            }
        else:
            llm_result = score_qa(question, answer, jd_text)
            
            score = max(0.0, min(1.0, float(llm_result.get("score", 0.0))))
            keywords = llm_result.get("keywords", [])
            reason = llm_result.get("reason", "")
            
            if score > 0.3 and not keywords:
                print("WARNING: score > 0.3 but no keywords identified", flush=True)
            
            result = {
                "qa_id": qa_id,
                "question": question,
                "answer": answer,
                "relevance_score": round(score, 2),
                "matched_keywords": keywords,
                "justification": reason
            }
            
            print(f"Score: {score:.2f}", flush=True)
            print(f"Keywords: {', '.join(keywords)}", flush=True)
        
        # Append to output file (streaming)
        with open(out_path, "a") as f:
            f.write(json.dumps(result) + "\n")
            f.flush()
    
    print(f"\n{'='*60}", flush=True)
    print(f"Stage 4 complete: {len(qa_pairs)} QA pairs scored", flush=True)
    print(f"Output: {out_path}", flush=True)

# -------------------------------
# Entry point
# -------------------------------
if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python relevance.py <output_dir> <jd_path>")
        print("Example: python relevance.py output config/job_description.txt")
        sys.exit(1)
    
    run(sys.argv[1], sys.argv[2])
