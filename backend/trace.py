"""Local metadata for one answer; requests and source text stay out of the log."""
from datetime import datetime, timezone
import json
import logging
from threading import Lock
from time import perf_counter

from .index import TOP_K
from .models import EMBEDDING_MODEL
from .source import PDF_SHA256, ROOT

LOG = ROOT / "data" / "logs" / "answers.jsonl"
_log_lock = Lock()


def record_trace(models, started, status, evidence, claims):
    cited = dict.fromkeys(ref["id"] for claim in claims for ref in claim["citations"])
    trace = {
        "time": datetime.now(timezone.utc).isoformat(), "status": status,
        "provider": models.provider, "model": models.prefix + models.chat_model, "k": TOP_K,
        "retrieved_ids": [row["id"] for row in evidence], "cited_ids": list(cited),
        "edition_hash": PDF_SHA256, "latency_ms": round((perf_counter() - started) * 1000),
        "tokens": dict(models.usage),
    }
    try:
        with _log_lock:
            LOG.parent.mkdir(parents=True, exist_ok=True)
            with LOG.open("a", encoding="utf-8") as stream:
                record = {**trace, "embedding_model": EMBEDDING_MODEL, "question_embedding": models.question_embedding}
                stream.write(json.dumps(record, separators=(",", ":")) + "\n")
    except OSError:
        logging.getLogger(__name__).warning("Could not append to the local answer trace.")
    return trace
