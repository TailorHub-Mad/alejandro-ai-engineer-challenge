"""Regenerate the browser's read-only snapshot. No API call or credential is needed.

Run from the repository root with the PoC's Python environment. For a new
recording, pass --embeddings FILE containing a six-passage, two-question
OpenAI embedding batch in the order used by eval/results.json. By default,
replay the historical full-step vectors from eval/fixtures/ranking-baseline.json.
"""
import argparse
import ast
import base64
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import re
import sys

import numpy as np
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.source import PDF, PDF_SHA256, SECTION_TITLE, SOURCE_URL, clean, extract_chunks

ASSET = ROOT / "frontend/atlas/assets/data.js"
PREFIX = "window.ATLAS_DATA = "
FILES = [
    "backend/source.py", "backend/index.py", "backend/models.py", "backend/answer.py",
    "backend/app.py", "backend/__main__.py", "backend/evidence.py", "backend/acquire.py", "backend/trace.py",
    "frontend/index.html", "frontend/app.js", "frontend/styles.css",
    "eval/run.py", "eval/rankings.py", "eval/cases.json", "eval/results.json",
    "tests/test_evidence.py", "tests/test_citation_pdf.py", "tests/test_rankings.py",
    "requirements.txt", ".env.example", ".gitignore", "README.md",
]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def constants(code, names):
    """Read simple source constants without importing the environment-aware client."""
    values = {}
    for statement in ast.parse(code).body:
        if isinstance(statement, ast.Assign):
            for name in statement.targets:
                if isinstance(name, ast.Name) and name.id in names:
                    values[name.id] = ast.literal_eval(statement.value)
    if values.keys() != set(names):
        raise ValueError(f"Unrecognised source configuration: {sorted(set(names) - values.keys())}")
    return values


def displayed_box(box, frame):
    x0, y0, x1, y1 = box
    left, top, right, bottom = frame
    if not left <= x0 < x1 <= right or not top <= y0 < y1 <= bottom:
        raise ValueError(f"Page selection is outside its displayed image: {box}")
    return [round(n, 7) for n in ((x0-left)/(right-left), (y0-top)/(bottom-top),
                                    (x1-x0)/(right-left), (y1-y0)/(bottom-top))]


def page_assets(chunks):
    pages = []
    with pdfplumber.open(PDF) as pdf:
        for page in pdf.pages[19:22]:
            outer, *nested = sorted(page.find_tables(), key=lambda table: table.bbox[0])
            # An excerpt of the body table keeps the small print legible and leaves
            # publisher headers, footers, and agency marks outside the image.
            x0, y0, x1, y1 = outer.bbox
            frame = (x0-7, y0-(40 if page.page_number == 20 else 2), x1+7, y1+7)
            cropped = page.crop(frame)
            image = cropped.to_image(resolution=168, antialias=True).original.convert("RGB")
            buffer = BytesIO()
            image.save(buffer, format="WEBP", lossless=True, method=4)
            steps = []
            for row in outer.rows[1:]:
                number_cell, action_cell = [box for box in row.cells if box]
                step = int(page.crop(number_cell).extract_text().strip().rstrip("."))
                decisions = []
                for table in nested:
                    if not row.bbox[1] <= table.bbox[1] < row.bbox[3]:
                        continue
                    for branch, cells in zip(table.rows[1:], table.extract()[1:], strict=True):
                        left, right = [box for box in branch.cells if box]
                        condition, action = [clean(s) for s in cells if s and s.strip()]
                        if f"If {condition} → {action}" not in chunks[step-1]["text"]:
                            raise ValueError(f"Step {step}: geometry and indexed decision disagree")
                        decisions.append({
                            "condition": condition, "action": action,
                            "box": displayed_box(branch.bbox, frame),
                            "conditionBox": displayed_box(left, frame),
                            "actionBox": displayed_box(right, frame),
                        })
                steps.append({
                    "step": step, "box": displayed_box(row.bbox, frame),
                    "numberBox": displayed_box(number_cell, frame),
                    "actionBox": displayed_box(action_cell, frame), "decisions": decisions,
                })
            pages.append({
                "page": page.page_number, "width": image.width, "height": image.height,
                "cropPdfPoints": [round(n, 4) for n in frame], "steps": steps,
                "image": "data:image/webp;base64," + base64.b64encode(buffer.getvalue()).decode("ascii"),
            })
    layout = [(item["step"], len(item["decisions"])) for page in pages for item in page["steps"]]
    if layout != [(1, 2), (2, 3), (3, 3), (4, 3), (5, 0), (6, 0)]:
        raise ValueError("Unexpected step or decision geometry")
    return pages


def query_vectors(capture_path, cases, document_vectors, recorded_questions):
    if capture_path:
        batch = sorted(read_json(capture_path)["data"], key=lambda item: item["index"])
        if [row["index"] for row in batch] != list(range(len(document_vectors) + len(cases))):
            raise ValueError("Embedding batch does not match the six passages and two questions")
        all_vectors = np.array([row["embedding"] for row in batch], dtype=np.float32)
        raw_document_vectors = all_vectors[:len(document_vectors)]
        normalised = raw_document_vectors / np.linalg.norm(raw_document_vectors, axis=1, keepdims=True)
        if not np.allclose(normalised, document_vectors, rtol=1e-5, atol=1e-7):
            raise ValueError("Captured document vectors differ from the archived full-step vectors")
        return all_vectors[len(document_vectors):].tolist()
    if [q["question"] for q in recorded_questions] != [c["question"] for c in cases]:
        raise ValueError("Evaluation questions changed. Supply fresh recorded embeddings.")
    return [q["embedding"] for q in recorded_questions]


def rank_and_verify(chunks, vectors, questions, cases):
    matrix = np.asarray(vectors, dtype=np.float32)
    queries = np.asarray(questions, dtype=np.float32)
    if matrix.shape != (6, 256) or queries.shape != (2, 256):
        raise ValueError("Expected six document vectors and two question vectors of 256 dimensions")
    matrix = matrix / np.linalg.norm(matrix, axis=1, keepdims=True)
    rankings = []
    for query, case in zip(queries, cases, strict=True):
        scores = matrix @ (query / np.linalg.norm(query))
        ranking = [{"id": chunks[i]["id"], "score": round(float(scores[i]), 5)}
                   for i in np.argsort(-scores, kind="stable")]
        if ranking[:len(case["retrieved"])] != case["retrieved"]:
            raise ValueError(f"Scores disagree with the recorded run for {case['id']}")
        rankings.append(ranking)
    return rankings


def build(capture_path):
    baseline = read_json(ROOT / "eval/fixtures/ranking-baseline.json")
    results = read_json(ROOT / "eval/results.json")
    for case in results["cases"]:
        case.pop("provider_run_id", None)
    chunks = extract_chunks()
    if baseline["edition_sha256"] != PDF_SHA256:
        raise ValueError("The archived vector edition differs from the displayed source")
    vectors = []
    for chunk, recorded in zip(chunks, baseline["documents"], strict=True):
        old_input = f"{SECTION_TITLE}. Step {chunk['step']}. " + " ".join(chunk["text"].split())
        if chunk["id"] != recorded["id"] or sha256(old_input.encode()).hexdigest() != recorded["input_sha256"]:
            raise ValueError("The archived embedding inputs differ from the displayed passages")
        vectors.append(recorded["embedding"])

    files = {name: (ROOT / name).read_text(encoding="utf-8-sig") for name in FILES
             if name != "eval/results.json"}
    files["eval/results.json"] = json.dumps(results, ensure_ascii=False, indent=2) + "\n"
    for line in files[".env.example"].splitlines():
        key, sep, value = line.partition("=")
        if sep and key.endswith("_KEY") and value.strip():
            raise ValueError("Only empty credentials may appear in the example configuration")
    settings = constants(files["backend/models.py"],
                         ["CHAT_MODEL", "MAX_COMPLETION_TOKENS", "EMBEDDING_MODEL", "DIMENSIONS", "TIMEOUT", "PROVIDERS"])
    answer = constants(files["backend/answer.py"], ["SYSTEM_PROMPT", "GAP_EXPLANATION"])
    top_k = constants(files["backend/index.py"], ["TOP_K"])["TOP_K"]
    questions = query_vectors(capture_path, results["cases"], vectors, baseline["questions"])
    rankings = rank_and_verify(chunks, vectors, questions, results["cases"])
    return {
        "schemaVersion": 1, "chunks": chunks, "vectors": vectors,
        "queryVectors": questions, "results": results, "rankings": rankings,
        "liveResults": current_evaluation(),
        "pages": page_assets(chunks), "files": files, "prompt": " ".join(answer["SYSTEM_PROMPT"].split()),
        "config": {"embeddingModel": settings["EMBEDDING_MODEL"], "chatModel": settings["CHAT_MODEL"],
                   "gapExplanation": answer["GAP_EXPLANATION"],
                   "dimensions": settings["DIMENSIONS"], "timeout": settings["TIMEOUT"], "topK": top_k,
                   "providers": {k: {"url": value[0], "keyVariable": value[1], "prefix": value[2]}
                                 for k, value in settings["PROVIDERS"].items()},
                   "maxOutputTokens": settings["MAX_COMPLETION_TOKENS"]},
        "source": {"title": "Inspecting empty bulk vessels for export", "id": "A3",
                   "edition": "DAFF IMLS-12-3065 v7.0", "publicationDate": "1 July 2026",
                   "accessed": "19 November 2026", "url": SOURCE_URL,
                   "sha256": PDF_SHA256, "attribution": "© Department of Agriculture, Fisheries and Forestry 2026.",
                   "adaptations": "Pages 20–22 cropped to the procedure tables. Text reflowed and bullet glyphs normalised.",
                   "license": "CC BY 4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
                   "copyrightUrl": "https://www.agriculture.gov.au/about/copyright"},
    }


def current_evaluation():
    path = ROOT / "eval/live-results.json"
    if not path.is_file():
        return None
    run = read_json(path)
    # Only the reviewer-visible fields are needed in the optional, offline site.
    cases = []
    for case in run["cases"]:
        item = {key: case[key] for key in ("question", "status", "claims", "cited_steps")}
        if "metrics" in case:
            values = {True: "yes", False: "no", None: "n/a"}
            item["review_note"] = " · ".join(f"{name} {values[case['metrics'][name]]}"
                                            for name in ("hit", "cited", "gap"))
        else:
            item["review_note"] = case.get("review_note", "")
        cases.append(item)
    k = run.get("top_k")
    if k is None and cases:
        k = run["cases"][0].get("trace", {}).get("k")
    return {"date": run["date"], "top_k": k, "cases": cases}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--embeddings", type=Path, help="Recorded batch JSON from the embeddings endpoint")
    options = parser.parse_args()
    snapshot = build(options.embeddings)
    # Escape HTML delimiters so the asset is also safe to inline in the offline copy.
    payload = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"), allow_nan=False).replace("<", "\\u003c")
    if re.search(r"(?:sk-(?:or-v1-|proj-)?|vck_)[a-zA-Z0-9_-]{24,}", payload):
        raise ValueError("A secret-like string was found in the public snapshot")
    ASSET.parent.mkdir(parents=True, exist_ok=True)
    ASSET.write_text(PREFIX + payload + ";\n", encoding="utf-8")
    print(f"Wrote {ASSET.relative_to(ROOT)} ({ASSET.stat().st_size:,} bytes)")
