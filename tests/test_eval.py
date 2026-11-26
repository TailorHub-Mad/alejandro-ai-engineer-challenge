import json
import tempfile
import unittest
from contextlib import redirect_stdout
from io import BytesIO, StringIO
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from backend.answer import GAP_EXPLANATION, UNVERIFIED_EXPLANATION
from backend.index import TOP_K
from backend.models import ModelError
from eval import run


class EvaluationTests(unittest.TestCase):
    def sample_answer(self):
        return {"status": "answered", "claims": [{"text": "A supported fact.",
                                                  "citations": [{"id": "step-1", "quote": "Text for step 1."}]}],
                "evidence": [{"id": f"step-{n}", "page": 20, "section": "8.1", "step": n,
                              "score": 0.7, "text": f"Text for step {n}."} for n in (3, 1, 4, 2)]}

    def test_score_record_keeps_retrieved_and_cited_steps_separate(self):
        case = run.record_case({"id": "residue-location", "expected_outcome": "answered",
                                "expected_steps": [4]}, self.sample_answer())
        self.assertEqual(TOP_K, 4)
        self.assertTrue(case["step_4_retrieved"])
        self.assertFalse(case["step_4_cited"])
        self.assertEqual(case["cited_steps"], [1])
        self.assertTrue(case["metrics"]["hit"])
        self.assertFalse(case["metrics"]["cited"])
        self.assertEqual(case["metrics"]["missing_cited_steps"], [4])
        self.assertTrue(case["metrics"]["quotes_exact"])

    def test_partial_requires_a_gap_notice_and_supported_facts(self):
        case = {"id": "partial", "expected_outcome": "partial", "expected_steps": [1]}
        answer = self.sample_answer()
        answer["status"] = "evidence_gap"
        answer["claims"].insert(0, {"text": GAP_EXPLANATION, "citations": []})
        self.assertTrue(run.record_case(case, answer)["metrics"]["outcome_matches"])
        answer["claims"][1]["citations"][0]["quote"] = "wrong source text"
        self.assertFalse(run.record_case(case, answer)["metrics"]["quotes_exact"])
        answer["claims"].pop()
        self.assertFalse(run.record_case(case, answer)["metrics"]["outcome_matches"])
        case.update(expected_outcome="certification", expected_steps=[])
        metrics = run.record_case(case, answer)["metrics"]
        self.assertTrue(metrics["outcome_matches"])
        self.assertIsNone(metrics["hit"])
        self.assertIsNone(metrics["quotes_exact"])

    def test_generation_rejection_keeps_retrieval_and_is_not_scored_as_a_gap(self):
        case = {"id": "reject", "question": "Q?", "expected_outcome": "answered", "expected_steps": [4]}
        error = HTTPException(422, {"code": "invalid_model_evidence",
                                    "evidence": self.sample_answer()["evidence"], "trace": {}})
        with patch.object(run, "request_answer", side_effect=error):
            record = run.evaluate_case(case, None)
        self.assertEqual(record["status"], "rejected")
        self.assertTrue(record["metrics"]["hit"])
        self.assertFalse(record["metrics"]["cited"])
        self.assertIsNone(record["metrics"]["gap"])
        self.assertFalse(record["metrics"]["outcome_matches"])

    def test_unverified_answer_is_neither_a_fact_nor_a_successful_gap(self):
        case = {"id": "prior", "question": "Q?", "expected_outcome": "unanswerable", "expected_steps": []}
        answer = self.sample_answer()
        answer.update(status="evidence_gap", removed_claims=1,
                      claims=[{"text": UNVERIFIED_EXPLANATION, "citations": []}])
        record = run.record_case(case, answer)
        self.assertIsNone(record["metrics"]["gap"])
        self.assertIsNone(record["metrics"]["quotes_exact"])
        self.assertEqual(record["metrics"]["fact_count"], 0)
        self.assertFalse(record["metrics"]["passed"])
        history = run.resolve_history({"history": [{"case_id": "prior"}]}, {"prior": record})
        self.assertEqual(history, [{"question": "Q?", "answer": "(no verified answer)"}])

    def test_follow_up_uses_actual_previous_answer_and_fresh_control_has_empty_history(self):
        cases = {c["id"]: c for c in json.loads((run.DIRECTORY / "cases.json").read_text(encoding="utf-8"))}
        parent = cases["bilge-wells-tank-top"]
        completed = {parent["id"]: run.record_case(parent, self.sample_answer())}
        expected = [{"question": parent["question"], "answer": "A supported fact."}]
        answer = {**self.sample_answer(), "history_turns": 1}
        with patch.object(run, "request_answer", return_value=answer) as ask:
            child = run.evaluate_case(cases["bilge-damage-follow-up"], None, completed)
            ask.assert_called_once_with(child["question"], None, expected)
            self.assertEqual(child["history"], expected)
            self.assertIn("A supported fact.", child["retrieval_query"])
            fresh = run.evaluate_case(cases["damage-without-history"], None, completed)
            ask.assert_called_with(child["question"], None, [])
            self.assertEqual(fresh["retrieval_query"], child["question"])
        completed[parent["id"]]["claims"] = []
        self.assertEqual(run.resolve_history(cases["bilge-damage-follow-up"], completed)[0]["answer"],
                         "(no verified answer)")

    def test_http_request_includes_fixed_history_and_allows_verification_retry(self):
        exchange = {"question": "A question?", "answer": "A verified answer."}
        history = run.resolve_history({"history": [exchange]}, {})
        with patch.object(run, "urlopen", return_value=BytesIO(b'{"status":"answered"}')) as http:
            run.request_answer("Then what?", "http://localhost:8080", history)
        self.assertEqual(json.loads(http.call_args.args[0].data), {"question": "Then what?", "history": [exchange]})
        self.assertEqual(http.call_args.kwargs["timeout"], 90)

    def test_warning_grade_needs_both_steps_correct_quote_and_warning_in_the_answer(self):
        case = next(c for c in json.loads((run.DIRECTORY / "cases.json").read_text(encoding="utf-8"))
                    if c["id"] == "manhole-clarification")
        example = self.sample_answer()
        warning = "do not enter the void space"
        example["evidence"][0]["text"] += " " + warning
        claim = {"text": "Do not enter the void space when inspecting manhole covers.",
                 "citations": [{"id": "step-3", "quote": warning}, {"id": "step-4", "quote": "Text for step 4."}]}
        example["claims"] = [claim]
        self.assertTrue(run.record_case(case, example)["metrics"]["passed"])
        claim["text"] = "Do not touch the manhole cover before entering the void space."
        self.assertFalse(run.record_case(case, example)["metrics"]["passed"])
        claim["text"] = "Don\u2019t enter the void space."
        self.assertTrue(run.record_case(case, example)["metrics"]["passed"])
        claim["citations"].pop()
        self.assertFalse(run.record_case(case, example)["metrics"]["passed"])
        claim["citations"][0]["quote"] = "Text for step 3."
        self.assertTrue(run.record_case(case, example)["metrics"]["missing_details"])

    def test_broad_case_checks_claim_limit_and_narrowing_suggestion(self):
        case = next(c for c in json.loads((run.DIRECTORY / "cases.json").read_text(encoding="utf-8"))
                    if c["id"] == "broad-inspection")
        sample = self.sample_answer()
        self.assertFalse(run.record_case(case, sample)["metrics"]["passed"])
        sample["suggestion"] = "Ask about a specific step or area."
        self.assertTrue(run.record_case(case, sample)["metrics"]["passed"])
        sample["claims"] *= 4
        self.assertFalse(run.record_case(case, sample)["metrics"]["passed"])

    def test_error_in_second_case_preserves_existing_run(self):
        with tempfile.TemporaryDirectory() as temp:
            previous = Path(temp) / "results.json"
            previous.write_text("previous completed run", encoding="utf-8")
            with (patch.object(run, "OUTPUT", previous), patch("sys.argv", ["eval/run.py"]),
                  patch.object(run, "Models"), redirect_stdout(StringIO()),
                  patch.object(run, "request_answer", side_effect=[self.sample_answer(), ModelError("Timeout.")])):
                with self.assertRaisesRegex(SystemExit, "residue-weight"):
                    run.main()
            self.assertEqual(previous.read_text(encoding="utf-8"), "previous completed run")
