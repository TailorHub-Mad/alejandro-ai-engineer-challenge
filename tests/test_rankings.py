import json
from contextlib import redirect_stdout
from hashlib import sha256
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock, patch

from backend.answer import retrieval_question
from backend.index import EMBEDDING_FORMAT, TOP_K, Index, StaleIndex, build, unit_vectors
from backend.models import DIMENSIONS, EMBEDDING_MODEL
from backend.source import PDF_SHA256, SECTION_TITLE
from eval.rankings import BASELINE, COMPARISON, DIRECTORY, compare_rankings, ranked_ids


class RankingTests(unittest.TestCase):
    def setUp(self):
        self.baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
        self.documents = self.baseline["documents"]
        self.vectors = unit_vectors([d["embedding"] for d in self.documents], len(self.documents))

    def test_recorded_question_rankings_and_step_four_in_top_k(self):
        cases = json.loads((DIRECTORY / "results.json").read_text(encoding="utf-8"))["cases"]
        self.assertEqual((self.baseline["embedding_model"], self.baseline["dimensions"], self.baseline["edition_sha256"]),
                         (EMBEDDING_MODEL, DIMENSIONS, PDF_SHA256))
        for case, query in zip(cases, self.baseline["questions"], strict=True):
            with self.subTest(case=case["id"]):
                self.assertEqual((query["id"], query["question"]), (case["id"], case["question"]))
                ranking = ranked_ids(self.documents, self.vectors, query["embedding"])
                self.assertEqual(ranking[:len(case["retrieved"])], case["retrieved"])
                if case["id"] == "residue-location":
                    self.assertIn("A3-8.1-04", [row["id"] for row in ranking[:TOP_K]])
                    self.assertEqual(ranking[2]["id"], "A3-8.1-04")

    @unittest.skipUnless(COMPARISON.is_file(), "Procedure-only vectors have not been captured; run python -m eval.run --rebuild")
    def test_every_rebuilt_ranking_replays_from_its_saved_question_embedding(self):
        run = json.loads(COMPARISON.read_text(encoding="utf-8"))
        cases = json.loads((DIRECTORY / "cases.json").read_text(encoding="utf-8"))
        self.assertEqual((run["embedding_format"], run["edition_sha256"], run["top_k"]),
                         (EMBEDDING_FORMAT, PDF_SHA256, TOP_K))
        self.assertEqual((run["embedding_model"], run["dimensions"]), (EMBEDDING_MODEL, DIMENSIONS))
        docs = run["documents"]
        vectors = unit_vectors([d["embedding"] for d in docs], len(docs))
        self.assertEqual([d["id"] for d in docs], [d["id"] for d in self.documents])
        cases_by_id = {case["id"]: case for case in cases}
        for query in run["questions"]:
            with self.subTest(case=query["id"]):
                case = cases_by_id[query["id"]]
                self.assertEqual((query["id"], query["question"]), (case["id"], case["question"]))
                if "retrieval_query" in query:
                    self.assertEqual(query["retrieval_query"], retrieval_question(case["question"], query["history"]))
                    self.assertEqual(len(query["history"]), len(case.get("history", [])))
                for field, chunks, matrix in [("before", self.documents, self.vectors), ("after", docs, vectors)]:
                    ranked = ranked_ids(chunks, matrix, query["embedding"])
                    for computed, recorded in zip(ranked, query[field], strict=True):
                        self.assertEqual(computed["id"], recorded["id"])
                        self.assertAlmostEqual(computed["score"], recorded["score"], places=4)
                if case["id"] == "residue-location":
                    self.assertIn("A3-8.1-04", [r["id"] for r in query["after"][:TOP_K]])

    def test_index_embeds_procedure_and_retains_decision_text_as_evidence(self):
        chunk = {"id": "A3-8.1-01", "step": 1, "text": "Check the hold. If dark use a torch.\n\nIf clear → continue."}
        provider = Mock()
        provider.embed.return_value = [[1.0] * DIMENSIONS]
        with TemporaryDirectory() as temp, patch("backend.index.extract_chunks", return_value=[chunk]):
            path = Path(temp) / "index.json"
            build(provider, path)
            provider.embed.assert_called_once_with([f"{SECTION_TITLE}. Step 1. Check the hold. If dark use a torch."])
            self.assertEqual(Index(path).retrieve([1.0] * DIMENSIONS)[0]["text"], chunk["text"])
            data = json.loads(path.read_text(encoding="utf-8"))
            del data["embedding_format"]
            path.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaises(StaleIndex):
                Index(path)

    def test_saved_comparison_embeds_and_records_resolved_thread_history(self):
        question = "What if there is damage there?"
        history = [{"question": "Where are the bilge wells?", "answer": "On the tank top."}]
        cases = [{"id": "follow", "question": question, "history": history},
                 {"id": "fresh", "question": question, "history": []}]
        chunk = {"id": "step-3", "step": 3, "text": "Inspect the tank top."}
        source = f"{SECTION_TITLE}. Step 3. {chunk['text']}".encode()
        vectors = unit_vectors([[1.] * DIMENSIONS], 1)
        archived = {"id": chunk["id"], "input_sha256": sha256(source).hexdigest(),
                    "embedding": vectors[0].tolist()}
        baseline = {**self.baseline, "documents": [archived]}
        model = Mock(provider="openrouter")
        model.embed.return_value = [archived["embedding"], archived["embedding"]]
        with TemporaryDirectory() as temp:
            fixture, output = Path(temp) / "baseline.json", Path(temp) / "comparison.json"
            fixture.write_text(json.dumps(baseline), encoding="utf-8")
            with (patch("eval.rankings.BASELINE", fixture), patch("eval.rankings.COMPARISON", output),
                  patch("eval.rankings.Index", return_value=Mock(chunks=[chunk], vectors=vectors)),
                  redirect_stdout(StringIO())):
                compare_rankings(model, cases)
            captures = json.loads(output.read_text(encoding="utf-8"))["questions"]
        inputs = [retrieval_question(question, history), question]
        model.embed.assert_called_once_with(inputs)
        self.assertEqual([row["retrieval_query"] for row in captures], inputs)
        self.assertEqual([row["history"] for row in captures], [history, []])
