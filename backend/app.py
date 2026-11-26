from functools import lru_cache
import mimetypes
from time import perf_counter

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .answer import EvidenceValidationError, ask
from .evidence import QuoteNotFound, highlighted_pdf
from .index import Index
from .models import ModelError, Models
from .source import PDF, ROOT, SOURCE_URL, reviewed_pdf
from .trace import record_trace

app = FastAPI(title="Case study", docs_url=None, redoc_url=None, openapi_url=None)


class PreviousExchange(BaseModel):
    question: str = Field(min_length=1, max_length=1200, pattern=r"\S")
    answer: str = Field(min_length=1, max_length=3000, pattern=r"\S")


class Question(BaseModel):
    question: str = Field(min_length=1, max_length=1200)
    history: list[PreviousExchange] = Field(default_factory=list, max_length=4)


@app.get("/api/config")
def public_config():
    try:
        models = Models()
        return {"app": "taylor-case", "api_version": 2, "provider": models.provider, "chat_model": models.chat_model}
    except ModelError as exc:
        raise HTTPException(503, str(exc)) from None


@lru_cache(maxsize=1)
def load_index():
    try:
        return Index()
    except (OSError, ValueError, KeyError, TypeError, ModelError):
        raise HTTPException(503, "The index is unavailable. Run python -m backend.index and restart the server.") from None


@app.post("/api/ask")
def ask_question(body: Question):
    question = body.question.strip()
    if not question:
        raise HTTPException(422, "Enter a question.")
    started = perf_counter()
    try:
        models = Models()
        answer = ask(question, load_index(), models, [turn.model_dump() for turn in body.history])
    except EvidenceValidationError as exc:
        trace = record_trace(models, started, "rejected", exc.evidence, [])
        raise HTTPException(422, {"code": "invalid_model_evidence",
                                  "message": "The generated answer could not be verified against the source passages.",
                                  "evidence": exc.evidence, "trace": trace}) from None
    except ModelError as exc:
        raise HTTPException(502, str(exc)) from None
    answer["trace"] = record_trace(models, started, answer["status"], answer["evidence"], answer["claims"])
    return answer


@app.get("/source/A3")
def original_pdf():
    if not PDF.is_file():
        return RedirectResponse(SOURCE_URL)
    return FileResponse(PDF, media_type="application/pdf")


@app.get("/source/A3/passages/{passage_id}.pdf")
def cited_pdf(passage_id: str, quote: str):
    try:
        data = highlighted_pdf(reviewed_pdf(), passage_id, quote)
    except KeyError:
        raise HTTPException(404, "Unknown passage in the reviewed manual.") from None
    except QuoteNotFound as exc:
        raise HTTPException(422, str(exc)) from None
    except (OSError, ValueError):
        raise HTTPException(503, "The reviewed source PDF is unavailable.") from None
    return Response(data, media_type="application/pdf", headers={
        "Content-Disposition": f'inline; filename="{passage_id}.pdf"',
    })


mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("font/woff2", ".woff2")
app.mount("/", StaticFiles(directory=ROOT / "frontend", html=True), name="frontend")
