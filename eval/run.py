"""Run the real-key case suite and record retrieval, citation and gap outcomes."""
import argparse
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

if not __package__:  # Also support python eval/run.py from the repository.
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException

from backend.answer import GAP_EXPLANATION, retrieval_question
from backend.app import Question, ask_question, load_index
from backend.index import TOP_K
from backend.models import CHAT_MODELS, DIMENSIONS, EMBEDDING_MODEL, ModelError, Models
from backend.source import quote_cells, quote_occurrences

DIRECTORY = Path(__file__).resolve().parent
OUTPUT = DIRECTORY / "live-results.json"


def all_claims_removed(answer):
    return answer.get("removed_claims", 0) > 0 and not any(claim["citations"] for claim in answer["claims"])


def resolve_history(case, completed):
    """A case can supply a fixed exchange or reference an earlier answer in this run."""
    history = []
    for turn in case.get("history", []):
        if "case_id" in turn:
            previous = completed.get(turn["case_id"])
            if previous is None:
                raise ValueError(f"Missing earlier evaluation case: {turn['case_id']}")
            claims = [] if all_claims_removed(previous) else previous["claims"]
            answer = "\n".join(claim["text"] for claim in claims) or "(no verified answer)"
            history.append({"question": previous["question"], "answer": answer[:3000]})
        else:
            history.append({"question": turn["question"], "answer": turn["answer"]})
    return history


def request_answer(question, base_url, history=None):
    payload = {"question": question, "history": history or []}
    if not base_url:
        return ask_question(Question(**payload))
    req = Request(base_url.rstrip("/") + "/api/ask",
                  data=json.dumps(payload).encode(),
                  headers={"Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=90) as response:
            return json.load(response)
    except HTTPError as exc:
        if exc.code == 422:
            detail = json.load(exc).get("detail")
            if isinstance(detail, dict) and detail.get("code") == "invalid_model_evidence":
                raise HTTPException(422, detail) from None
        raise


def record_case(case, answer):
    """A hit is any expected step; missing step lists expose multi-step coverage."""
    evidence = answer["evidence"]
    claims = answer["claims"]
    status = answer["status"]
    by_id = {row["id"]: row for row in evidence}
    cited_steps = set()
    gap_notices = 0
    quote_counts = []
    supported = []
    unverified = all_claims_removed(answer)
    facts_and_gaps = [] if unverified else claims
    for claim in facts_and_gaps:
        if claim["text"] == GAP_EXPLANATION and claim["citations"] == []:
            gap_notices += 1
            continue
        if not claim["citations"]:
            quote_counts.append(0)
        for citation in claim["citations"]:
            row = by_id.get(citation["id"])
            quote = citation["quote"]
            count = quote_occurrences(quote_cells(row["text"]), quote) if row else 0
            quote_counts.append(count)
            if count == 1:
                supported.append((row["step"], quote, claim["text"]))
            if row:
                cited_steps.add(row["step"])
    required = set(case["expected_steps"])
    acceptable = required or set(case.get("allowed_steps", []))
    retrieved_steps = {row["step"] for row in evidence}
    expects_gap = case["expected_outcome"] != "answered"
    expects_facts = case["expected_outcome"] in {"answered", "partial"}
    gap = None if status == "rejected" or unverified else status == "evidence_gap"
    fact_count = len(facts_and_gaps) - gap_notices
    has_facts = fact_count > 0
    expected_status = case.get("expected_status", "evidence_gap" if expects_gap else "answered")
    outcome_matches = (not unverified and status == expected_status and gap_notices == int(expects_gap)
                       and (case["expected_outcome"] == "ambiguous" or has_facts == expects_facts))
    missing_details = [check["label"] for check in case.get("checks", []) if not any(
        step == check["step"] and check["quote_contains"].casefold() in quote.casefold()
        and re.search(check["claim_pattern"], text.replace("\u2019", "'"), flags=re.IGNORECASE)
        for step, quote, text in supported)]
    within_limit = fact_count <= case.get("max_claims", fact_count)
    suggestion = answer.get("suggestion")
    has_narrowing = bool(isinstance(suggestion, str) and re.search(
        r"\b(?:narrow\w*|specific|step|area)\b", suggestion, flags=re.IGNORECASE))
    all_cited = required <= cited_steps and (not acceptable or bool(acceptable & cited_steps))
    record = {**case, "status": status, "claims": claims,
              "retrieved": [{k: row[k] for k in ("id", "page", "section", "step", "score", "text")}
                            for row in evidence], "cited_steps": sorted(cited_steps),
              "removed_claims": answer.get("removed_claims", 0), "suggestion": suggestion,
              "metrics": {
                  "hit": bool(acceptable & retrieved_steps) if acceptable else None,
                  "cited": bool(acceptable & cited_steps) if acceptable else None,
                  "missing_retrieved_steps": sorted(required - retrieved_steps),
                  "missing_cited_steps": sorted(required - cited_steps),
                  "gap": gap, "outcome_matches": outcome_matches,
                  "quotes_exact": all(quote_counts) if quote_counts else None,
                  "quotes_unique": all(n == 1 for n in quote_counts) if quote_counts else None,
                  "max_similarity": max((row["score"] for row in evidence), default=None),
                  "missing_details": missing_details, "fact_count": fact_count,
                  "has_narrowing_suggestion": has_narrowing,
                  "passed": (outcome_matches and all_cited and all(n == 1 for n in quote_counts) and not missing_details
                             and within_limit and (not case.get("expect_suggestion") or has_narrowing)),
              }}
    if "trace" in answer:
        record["trace"] = answer["trace"]
    if case["id"] == "residue-location":
        record["step_4_retrieved"] = 4 in retrieved_steps
        record["step_4_cited"] = 4 in cited_steps
    return record


def evaluate_case(case, base_url, completed=None):
    history = resolve_history(case, completed or {})
    try:
        answer = request_answer(case["question"], base_url, history)
        if history and answer.get("history_turns") != len(history):
            raise ValueError("The backend did not consume the expected evaluation history.")
    except HTTPException as exc:
        detail = exc.detail
        if exc.status_code != 422 or not isinstance(detail, dict) or detail.get("code") != "invalid_model_evidence":
            raise
        answer = {"status": "rejected", "claims": [], "evidence": detail["evidence"], "trace": detail["trace"]}
    record = record_case(case, answer)
    record["history"] = history
    record["retrieval_query"] = retrieval_question(case["question"], history)
    return record


def save_results(run, path):
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                     delete=False) as stream:
        temp_path = Path(stream.name)
    try:
        temp_path.write_text(json.dumps(run, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rebuild", action="store_true", help="Re-embed the six source steps first.")
    parser.add_argument("--base-url", help="Exercise a running local API over HTTP, e.g. http://127.0.0.1:8000.")
    args = parser.parse_args()
    if args.rebuild and args.base_url:
        parser.error("Rebuild in-process, or restart the HTTP server after a separate index build.")
    if args.base_url:
        url = urlparse(args.base_url)
        if url.scheme != "http" or url.hostname not in {"localhost", "127.0.0.1", "::1"} or url.username or url.password:
            parser.error("--base-url must be a local HTTP address.")

    cases = json.loads((DIRECTORY / "cases.json").read_text(encoding="utf-8"))
    run = {"date": datetime.now(timezone.utc).isoformat(),
           "method": "Local HTTP API" if args.base_url else "Local FastAPI question handler in process",
           "rebuilt_index": args.rebuild, "cases": []}
    stage = "model configuration"
    try:
        if args.base_url:
            with urlopen(args.base_url.rstrip("/") + "/api/config", timeout=10) as response:
                config = json.load(response)
            model = config.get("chat_model") if isinstance(config, dict) else None
            if model not in CHAT_MODELS:
                raise ValueError("The running backend has an unapproved chat model. Check its configuration and restart.")
            run["chat"] = model
        else:
            models = Models()
            run.update(provider=models.provider, chat=models.prefix + models.chat_model,
                       embedding=models.prefix + EMBEDDING_MODEL, dimensions=DIMENSIONS, top_k=TOP_K)
            if args.rebuild:
                stage = "index rebuild"
                from backend.index import build
                build(models)
                load_index.cache_clear()
        completed = {}
        for case in cases:
            stage = case["id"]
            record = evaluate_case(case, args.base_url, completed)
            if not args.base_url and len(record["retrieved"]) != TOP_K:
                raise ValueError("Unexpected retrieval count for the six-step collection.")
            run["cases"].append(record)
            completed[case["id"]] = record
            print(f"{case['id']}: {record['status']} {json.dumps(record['metrics'])}")
        if args.rebuild:
            stage = "contextual ranking comparison"
            from eval.rankings import compare_rankings
            compare_rankings(models, run["cases"])
        save_results(run, OUTPUT)
    except HTTPException as exc:
        raise SystemExit(f"{stage}: HTTP {exc.status_code}: {exc.detail} No new results saved.") from None
    except HTTPError as exc:
        raise SystemExit(f"{stage}: local API returned HTTP {exc.code}. No new results saved.") from None
    except (URLError, TimeoutError):
        raise SystemExit(f"{stage}: local API unavailable. No new results saved.") from None
    except (ModelError, ValueError, OSError) as exc:
        raise SystemExit(f"{stage}: {exc} No new results saved.") from None
    print(f"Saved {len(run['cases'])} completed cases to {OUTPUT}")


if __name__ == "__main__":
    main()
