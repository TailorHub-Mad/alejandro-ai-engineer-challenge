"""Atomically replace one local, human-inspectable index. Six rows fit in memory."""
import json
import os
import tempfile
from pathlib import Path

import numpy as np

from .models import DIMENSIONS, EMBEDDING_MODEL, ModelError, Models
from .source import PDF_SHA256, ROOT, SECTION_TITLE, extract_chunks

STORE = ROOT / "data/store/index.json"
TOP_K = 4
EMBEDDING_FORMAT = "procedure-only-v1"


class StaleIndex(ValueError):
    """The saved document vectors need rebuilding for the current source or input format."""


def unit_vectors(values, count):
    try:
        matrix = np.asarray(values, dtype=np.float32)
        lengths = np.linalg.norm(matrix, axis=1, keepdims=True)
        if matrix.shape != (count, DIMENSIONS) or not np.all(np.isfinite(lengths) & (lengths > 0)):
            raise ValueError
        return matrix / lengths
    except (TypeError, ValueError, IndexError, np.exceptions.AxisError):
        raise ModelError("Invalid embedding dimensions or values. Check the model and rebuild the index.") from None


def embedding_text(chunk):
    # Extraction separates the procedure from its nested If/Then table by a blank line.
    procedure, _, _ = chunk["text"].partition("\n\n")
    return f"{SECTION_TITLE}. Step {chunk['step']}. {' '.join(procedure.split())}"


def rank_passages(chunks, vectors, question_vector, k):
    query = unit_vectors([question_vector], 1)[0]
    scores = vectors @ query
    order = np.argsort(-scores, kind="stable")[:k]
    return [dict(chunks[i], score=round(float(scores[i]), 5)) for i in order]


def build(models, path=STORE):
    chunks = extract_chunks()
    vectors = unit_vectors(models.embed([embedding_text(c) for c in chunks]), len(chunks))
    document = {"edition": "DAFF IMLS-12-3065 v7.0", "embedding_model": EMBEDDING_MODEL,
                "dimensions": DIMENSIONS, "embedding_format": EMBEDDING_FORMAT,
                "edition_sha256": PDF_SHA256, "chunks": chunks, "vectors": vectors.tolist()}
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as tmp:
        temp_path = Path(tmp.name)
    try:
        temp_path.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)
    return len(chunks)


class Index:
    def __init__(self, path=STORE):
        data = json.loads(path.read_text(encoding="utf-8"))
        if (data.get("embedding_model"), data.get("dimensions"), data.get("edition_sha256"),
            data.get("embedding_format")) != (EMBEDDING_MODEL, DIMENSIONS, PDF_SHA256, EMBEDDING_FORMAT):
            raise StaleIndex("The source or embedding inputs changed. Rebuild the index.")
        self.chunks = data["chunks"]
        if not self.chunks or len({chunk["id"] for chunk in self.chunks}) != len(self.chunks):
            raise ValueError("Invalid index. Rebuild the index.")
        self.vectors = unit_vectors(data["vectors"], len(self.chunks))

    def retrieve(self, question_vector):
        return rank_passages(self.chunks, self.vectors, question_vector, TOP_K)


if __name__ == "__main__":
    try:
        print(f"Indexed {build(Models())} steps in {STORE}")
    except (OSError, ValueError, ModelError) as exc:
        raise SystemExit(str(exc)) from None
