import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException

from backend.app import Question, ask_question
from backend.index import TOP_K
from backend.source import PDF_SHA256


class AnswerTraceTests(unittest.TestCase):
    def test_accepted_gap_and_rejected_answers_each_get_one_metadata_record(self):
        row = {"id": "A3-8.1-04", "page": 22, "section": "8.1", "step": 4,
               "text": "Check the entire tank top."}
        claim = {"text": "Check the tank top.", "citations": [{"id": row["id"], "quote": "Check the entire tank top."}]}
        models = Mock(provider="openrouter", prefix="openai/", chat_model="gpt-6.2-sol", question_embedding=[1.0],
                      usage={"embedding_tokens": 10, "prompt_tokens": 20, "completion_tokens": 30})
        models.embed_question.return_value = models.question_embedding
        models.generate.side_effect = [
            {"status": "answered", "claims": [claim]}, {"status": "evidence_gap", "claims": []},
            {"claims": "malformed model envelope"},
        ]
        index = Mock()
        index.retrieve.return_value = [row]
        question = Question(question="Private reviewer question")
        with TemporaryDirectory() as temp:
            log = Path(temp) / "logs" / "answers.jsonl"
            with (patch("backend.app.Models", return_value=models), patch("backend.app.load_index", return_value=index),
                  patch("backend.trace.LOG", log)):
                answer = ask_question(question)
                gap = ask_question(question)
                with self.assertRaises(HTTPException) as failure:
                    ask_question(question)
            raw = log.read_text(encoding="utf-8")
        self.assertEqual(failure.exception.status_code, 422)
        self.assertEqual(failure.exception.detail["code"], "invalid_model_evidence")
        traces = [json.loads(line) for line in raw.splitlines()]
        for saved, shown in zip(traces, [answer["trace"], gap["trace"], failure.exception.detail["trace"]], strict=True):
            self.assertEqual(saved, {**shown, "embedding_model": "text-embedding-3-small", "question_embedding": [1.0]})
            self.assertNotIn("question_embedding", shown)
        self.assertEqual([t["status"] for t in traces], ["answered", "evidence_gap", "rejected"])
        self.assertEqual([t["cited_ids"] for t in traces], [[row["id"]], [], []])
        self.assertNotIn(question.question, raw)
        self.assertNotIn("tank top", raw)
        self.assertNotIn("Unsupported fact", raw)
        for trace in traces:
            self.assertEqual(trace["retrieved_ids"], [row["id"]])
            self.assertEqual((trace["model"], trace["k"], trace["edition_hash"]),
                             ("openai/gpt-6.2-sol", TOP_K, PDF_SHA256))
            self.assertGreaterEqual(trace["latency_ms"], 0)
            self.assertEqual(trace["tokens"], models.usage)
