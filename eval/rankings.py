"""Compare full-step and procedure-only retrieval on the same saved question embeddings."""
from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

from backend.answer import retrieval_question
from backend.index import EMBEDDING_FORMAT, TOP_K, Index, build, embedding_text, rank_passages, unit_vectors
from backend.models import DIMENSIONS, EMBEDDING_MODEL, ModelError, Models
from backend.source import PDF_SHA256, SECTION_TITLE

DIRECTORY = Path(__file__).resolve().parent
BASELINE = DIRECTORY / "fixtures" / "ranking-baseline.json"
COMPARISON = DIRECTORY / "ranking-comparison.json"


def ranked_ids(documents, matrix, query):
    """All six ranks are recorded so changes below the retrieval cutoff remain visible."""
    chunks = [{"id": row["id"]} for row in documents]
    return rank_passages(chunks, matrix, query, len(chunks))


def compare_rankings(models, cases):
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    if (baseline["edition_sha256"], baseline["embedding_model"], baseline["dimensions"]) != (
            PDF_SHA256, EMBEDDING_MODEL, DIMENSIONS):
        raise ValueError("The ranking baseline belongs to a different source or embedding model.")

    index = Index()
    documents = []
    for chunk, vector, archived in zip(index.chunks, index.vectors, baseline["documents"], strict=True):
        old_input = f"{SECTION_TITLE}. Step {chunk['step']}. " + " ".join(chunk["text"].split())
        if chunk["id"] != archived["id"] or sha256(old_input.encode()).hexdigest() != archived["input_sha256"]:
            raise ValueError("The baseline embedding inputs differ from the current source.")
        documents.append({"id": chunk["id"], "step": chunk["step"],
                          "input_sha256": sha256(embedding_text(chunk).encode()).hexdigest(),
                          "embedding": vector.tolist()})

    questions = [retrieval_question(case["question"], case["history"]) for case in cases]
    queries = unit_vectors(models.embed(questions), len(questions))
    previous = baseline["documents"]
    previous_vectors = unit_vectors([doc["embedding"] for doc in previous], len(previous))
    comparison = []
    for case, query_text, query in zip(cases, questions, queries, strict=True):
        before = ranked_ids(previous, previous_vectors, query)
        after = ranked_ids(documents, index.vectors, query)
        comparison.append({"id": case["id"], "question": case["question"], "history": case["history"],
                           "retrieval_query": query_text, "embedding": query.tolist(),
                           "before": before, "after": after})
        print(f"{case['id']}: {[r['id'] for r in before[:TOP_K]]} -> {[r['id'] for r in after[:TOP_K]]}")

    report = {"recorded_at": datetime.now(timezone.utc).isoformat(), "provider": models.provider,
              "embedding_model": EMBEDDING_MODEL, "dimensions": DIMENSIONS, "top_k": TOP_K,
              "edition_sha256": PDF_SHA256, "baseline_format": baseline["embedding_format"],
              "embedding_format": EMBEDDING_FORMAT, "documents": documents, "questions": comparison}
    with NamedTemporaryFile(dir=COMPARISON.parent, delete=False) as stream:
        temp = Path(stream.name)
    try:
        temp.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        os.replace(temp, COMPARISON)
    finally:
        temp.unlink(missing_ok=True)
    print(f"Saved inputs and ranked results to {COMPARISON}")


if __name__ == "__main__":
    try:
        results = DIRECTORY / "live-results.json"
        if not results.exists():
            raise ValueError("Run python -m eval.run --rebuild to capture the live thread histories first.")
        cases = json.loads((DIRECTORY / "cases.json").read_text(encoding="utf-8"))
        recorded = json.loads(results.read_text(encoding="utf-8"))["cases"]
        if ([(c["id"], c["question"]) for c in cases] != [(r["id"], r["question"]) for r in recorded]
                or any("history" not in r or "retrieval_query" not in r for r in recorded)):
            raise ValueError("The saved run predates these cases. Run python -m eval.run --rebuild.")
        models = Models()
        build(models)
        compare_rankings(models, recorded)
    except (ModelError, OSError, ValueError) as exc:
        raise SystemExit(str(exc)) from None
