import json
import unittest
from unittest.mock import Mock, patch

from pydantic import ValidationError

from backend.answer import EvidenceValidationError, GAP_EXPLANATION, UNVERIFIED_EXPLANATION, ask
from backend.app import Question, ask_question
from backend.models import InvalidGeneration, Models
from backend.source import extract_chunks
from eval import run


class EvidenceTests(unittest.TestCase):
    fact = {"text": "Inspect void spaces.",
            "citations": [{"id": "A3-8.1-01", "quote": "inspect void spaces"}]}

    def test_pdf_table_keeps_damage_and_residue_actions_separate(self):
        chunks = extract_chunks()
        self.assertEqual([row["page"] for row in chunks], [20, 20, 21, 22, 22, 22])
        damage, residue = chunks[1]["text"].split("\n\n")[1:3]
        self.assertIn("structural damage", damage)
        self.assertIn("demonstrate", damage)
        self.assertNotIn("in piles", damage)
        self.assertIn("residue or contamination", residue)
        self.assertIn("in piles", residue)
        self.assertNotIn("demonstrate", residue)

    def answer_with(self, model_result, *, question="Question?", models=None):
        models = models or Mock()
        models.embed_question.return_value = [1]
        models.generate.return_value = model_result
        index = Mock()
        index.retrieve.return_value = [
            {"id": "A3-8.1-01", "page": 20, "section": "8.1", "step": 1,
             "text": "Enter and inspect void spaces.\n\nIf clear → record inspection findings"},
            {"id": "A3-8.1-02", "page": 20, "section": "8.1", "step": 2, "text": "Inspect the ladder."},
        ]
        return ask(question, index, models)

    def test_gap_with_no_claims_gets_a_visible_explanation(self):
        answer = self.answer_with({"status": "evidence_gap", "claims": []})
        self.assertEqual(answer["status"], "evidence_gap")
        self.assertEqual(answer["claims"], [{"text": GAP_EXPLANATION, "citations": []}])

    def test_metadata_supports_only_the_cited_label_and_value(self):
        citation = {"id": "A3-8.1-01", "quote": "inspect void spaces"}
        for text, accepted in [
            ("Step 1 on page 20 in section 8.1: inspect void spaces.", True),
            ("The previous step is 1.", True),
            ("Step 2: inspect void spaces.", False),  # Retrieved, but not cited.
            ("Page 1: inspect void spaces.", False),
            ("Section 8.2: inspect void spaces.", False),
            ("Inspect 20 void spaces.", False),
        ]:
            with self.subTest(text=text):
                claim = {"text": text, "citations": [citation]}
                answer = self.answer_with({"status": "answered", "claims": [claim]})
                self.assertEqual(answer["status"], "answered" if accepted else "evidence_gap")
                self.assertEqual(answer["removed_claims"], int(not accepted))

    def test_all_claims_removed_gets_a_verification_notice(self):
        claims = [{"text": text, "citations": []} for text in ("First claim.", "Second claim.")]
        for status in ("answered", "evidence_gap"):
            with self.subTest(status=status):
                models = Mock()
                answer = self.answer_with({"status": status, "claims": claims}, models=models)
                self.assertEqual(models.generate.call_count, 2)
                self.assertEqual(answer["removed_claims"], 2)
                self.assertEqual(answer["claims"], [{"text": "Could not verify an answer.", "citations": []}])

    def test_every_model_claim_requires_a_retrieved_citation(self):
        for status in ("answered", "evidence_gap"):
            for citations in ([], ["A3-8.1-01"], [{"id": "A3-8.1-99", "quote": "inspect void spaces"}],
                              [*self.fact["citations"], {"id": "A3-8.1-02", "quote": "inspect void spaces"}]):
                with self.subTest(status=status, citations=citations):
                    reply = self.answer_with({"status": status, "claims": [self.fact, {"text": "Claim.", "citations": citations}]})
                    self.assertEqual(reply["removed_claims"], 1)
                    self.assertIn(self.fact, reply["claims"])
                    self.assertFalse(any(claim["text"] == "Claim." for claim in reply["claims"]))

    def test_quotes_must_be_exact_and_highlightable_in_the_cited_cell(self):
        for quote in ("", " ", "Inspect void spaces", "inspect  void spaces", "inspect…spaces",
                      "If clear", "clear → record", "spaces.\n\nIf clear", None):
            with self.subTest(quote=quote):
                citation = {"id": "A3-8.1-01", "quote": quote}
                reply = self.answer_with({"status": "answered", "claims": [{"text": "Inspect void spaces.", "citations": [citation]}]})
                self.assertEqual(reply["removed_claims"], 1)
                self.assertEqual(reply["status"], "evidence_gap")
        citations = [{"id": "A3-8.1-01", "quote": quote} for quote in ("clear", "record inspection findings")]
        fact = {"text": "Record the findings when clear.", "citations": citations}
        self.assertEqual(self.answer_with({"status": "answered", "claims": [fact]})["claims"], [fact])

    def test_partial_answer_preserves_cited_facts_after_one_gap_explanation(self):
        fact = self.fact
        answer = self.answer_with({"status": "evidence_gap", "claims": [fact]})
        self.assertEqual(answer["claims"], [{"text": GAP_EXPLANATION, "citations": []}, fact])
        self.assertEqual(self.answer_with({"status": "answered", "claims": [fact]})["claims"], [fact])

    def test_repeated_claims_share_distinct_quotes_without_losing_different_claims(self):
        first_quote = {"id": "A3-8.1-01", "quote": "inspect void spaces"}
        second_quote = {"id": "A3-8.1-01", "quote": "Enter and inspect void spaces"}
        third_quote = {"id": "A3-8.1-02", "quote": "Inspect the ladder."}
        claims = [
            {"text": "Inspect.", "citations": [first_quote, first_quote]},
            {"text": "Inspect the ladder.", "citations": [third_quote]},
            {"text": "INSPECT!", "citations": [first_quote, second_quote]},
            {"text": "Inspect", "citations": [third_quote]},
        ]
        answer = self.answer_with({"status": "answered", "claims": claims})
        self.assertEqual(answer["claims"], [
            {"text": "Inspect.", "citations": [first_quote, second_quote, third_quote]}, claims[1]])
        claims[-1]["citations"][0] = {"id": "A3-8.1-02", "quote": "absent"}
        answer = self.answer_with({"status": "answered", "claims": claims})
        self.assertEqual(answer["removed_claims"], 1)
        self.assertEqual(answer["claims"][0]["citations"], [first_quote, second_quote])

    def test_follow_up_uses_only_explicit_request_history_and_retrieves_fresh_evidence(self):
        history = [
            {"question": "Where are residue piles collected?", "answer": "On the tank top."},
            {"question": "Who checks them?", "answer": "The authorised officer."},
        ]
        follow_up = "What are they looking for?"
        models, index = Mock(), Mock()
        models.embed_question.return_value = [1]
        index.retrieve.return_value = [
            {"id": "A3-8.1-04", "page": 22, "step": 4, "text": "inspect for evidence of infestation"}
        ]
        models.generate.return_value = {"status": "answered", "claims": [
            {"text": "Evidence of infestation.", "citations": [{"id": "A3-8.1-04", "quote": "evidence of infestation"}]}
        ]}
        with (patch("backend.app.Models", return_value=models),
              patch("backend.app.load_index", return_value=index), patch("backend.app.record_trace", return_value={})):
            linked = ask_question(Question(question=follow_up, history=history))
            self.assertEqual(linked["history_turns"], 2)
            retrieval_text = models.embed_question.call_args.args[0]
            self.assertTrue(retrieval_text.startswith(f"Current question: {follow_up}"))
            self.assertLess(retrieval_text.index("Who checks them?"), retrieval_text.index("Where are residue piles"))
            self.assertIn("tank top", retrieval_text)
            index.retrieve.assert_called_once_with([1])
            payload = json.loads(models.generate.call_args.args[0][-1]["content"])
            self.assertEqual((payload["question"], payload["history"]), (follow_up, history))
            self.assertEqual(payload["passages"][0]["id"], "A3-8.1-04")
            fresh = ask_question(Question(question=follow_up))
            self.assertEqual(fresh["history_turns"], 0)
            self.assertEqual(models.embed_question.call_args.args, (follow_up,))
            self.assertNotIn("history", json.loads(models.generate.call_args.args[0][-1]["content"]))
        models.generate.return_value["claims"][0]["citations"][0]["quote"] = history[-1]["answer"]
        self.assertEqual(ask(follow_up, index, models, history)["removed_claims"], 1)

    def test_follow_up_history_is_bounded_and_rejects_blank_turns(self):
        turn = {"question": "What?", "answer": "An answer."}
        self.assertEqual(len(Question(question="Why?", history=[turn] * 4).history), 4)
        for history in ([turn] * 5, [{**turn, "answer": "a" * 3001}], [{**turn, "question": "  "}]):
            with self.subTest(history_length=len(history)), self.assertRaises(ValidationError):
                Question(question="Why?", history=history)

    def test_model_cannot_duplicate_the_application_gap_explanation(self):
        for citations in ([], self.fact["citations"]):
            with self.subTest(citations=citations):
                reply = self.answer_with({"status": "evidence_gap", "claims": [{"text": GAP_EXPLANATION, "citations": citations}]})
                self.assertEqual(reply["claims"], [{"text": UNVERIFIED_EXPLANATION, "citations": []}])
                self.assertEqual(reply["removed_claims"], 1)

    def test_retry_identifies_the_bad_quote_and_preserves_untouched_claims(self):
        incorrect = {"text": "Inspect the ladder.", "citations": [{"id": "A3-8.1-02", "quote": "bogus wording"}]}
        repaired = {"text": "Inspect the ladder.", "citations": [{"id": "A3-8.1-02", "quote": "Inspect the ladder."}]}
        models = Mock()
        models.generate.side_effect = [{"status": "answered", "claims": [self.fact, incorrect]},
                                       {"status": "answered", "claims": [repaired]}]
        answer = self.answer_with(None, models=models)
        self.assertEqual(answer["claims"], [self.fact, repaired])
        self.assertEqual(answer["removed_claims"], 0)
        models.embed_question.assert_called_once()
        self.assertEqual(models.generate.call_count, 2)
        problem = json.loads(models.generate.call_args.args[0][-1]["content"])["failed_claims"][0]
        self.assertIn("bogus wording", problem["reason"])
        self.assertIn("A3-8.1-02", problem["reason"])

    def test_damaged_areas_cannot_be_inferred_from_the_high_areas_quote(self):
        models, index = Mock(), Mock()
        index.retrieve.return_value = [extract_chunks()[2]]
        citations = [{"id": "A3-8.1-03", "quote": "located in high or inaccessible areas of the hold"}]
        models.generate.return_value = {"status": "answered", "claims": [
            {"text": "Located in high or inaccessible areas of the hold.", "citations": citations},
            {"text": "Located in damaged areas of the hold.", "citations": citations},
        ]}
        reply = ask("What areas?", index, models)
        self.assertEqual(models.generate.call_count, 2)
        self.assertEqual(reply["removed_claims"], 1)
        self.assertEqual([claim["text"] for claim in reply["claims"]], ["Located in high or inaccessible areas of the hold."])

    def test_repeated_quote_has_actionable_feedback_and_a_unique_repair(self):
        models, index = Mock(), Mock()
        index.retrieve.return_value = [extract_chunks()[2]]
        def finding(quote):
            return {"text": "Record inspection findings.", "citations": [{"id": "A3-8.1-03", "quote": quote}]}
        fixed = finding("record inspection findings • continue to Step 4")
        models.generate.side_effect = [{"status": "answered", "claims": [finding("record inspection findings")]},
                                       {"status": "answered", "claims": [fixed]}]
        self.assertEqual(ask("What is recorded?", index, models)["claims"], [fixed])
        self.assertIn("longer, unique quote", models.generate.call_args.args[0][-1]["content"])

    def test_claim_cannot_reverse_the_void_space_warning(self):
        models, index = Mock(), Mock()
        index.retrieve.return_value = [extract_chunks()[2]]
        cite = [{"id": "A3-8.1-03", "quote": "do not enter the void space"}]
        models.generate.return_value = {"status": "answered", "claims": [{"text": "Enter the void space.", "citations": cite}]}
        reply = ask("What about manhole covers?", index, models)
        self.assertEqual(reply["removed_claims"], 1)
        self.assertEqual(reply["status"], "evidence_gap")

    def test_broad_question_has_three_verified_claims_and_a_separate_suggestion(self):
        excerpts = [(1, "Enter the hold through the hatch entrance using the ladder"),
                    (4, "Inspect all high structures that are visible from the tank top."),
                    (5, "Climb up the straight ladder and repeat inspection activities outlined at Step 2"),
                    (6, "Determine the next vessel inspection task.")]
        claims = [{"text": quote, "citations": [{"id": f"A3-8.1-{step:02}", "quote": quote}]}
                  for step, quote in excerpts]
        models, index = Mock(), Mock()
        models.generate.return_value = {"status": "answered", "claims": claims}
        index.retrieve.return_value = extract_chunks()
        reply = ask("What should I look out for?", index, models)
        self.assertEqual(reply["claims"], claims[:3])
        self.assertIn("specific step or area", reply["suggestion"])
        self.assertEqual(reply["removed_claims"], 0)
        specific = ask("What should I look out for around the ladder?", index, models)
        self.assertIsNone(specific["suggestion"])
        self.assertEqual(specific["claims"], claims)

    def test_overview_retries_five_word_claim_and_accepts_six(self):
        citation = [{"id": "A3-8.1-01", "quote": "Enter and inspect void spaces"}]
        short = {"text": "Inspect the void spaces there.", "citations": citation}
        revised = {"text": "Enter and inspect the void spaces.", "citations": citation}
        for question, flagged in (("What should I look out for?", False), ("Walk me through it.", True)):
            with self.subTest(question=question):
                models = Mock()
                result = {"status": "answered", "broad": flagged, "claims": [short]}
                models.generate.side_effect = [result, {"claims": [revised]}]
                reply = self.answer_with(None, question=question, models=models)
                self.assertEqual(reply["claims"], [revised])
                self.assertEqual(reply["removed_claims"], 0)
                retry = json.loads(models.generate.call_args.args[0][-1]["content"])
                self.assertIn("at least six words", retry["failed_claims"][0]["reason"])
                self.assertEqual(self.answer_with(result, question=question)["removed_claims"], 1)
        specific = self.answer_with({"status": "answered", "claims": [short]}, question="Which spaces?")
        self.assertEqual(specific["claims"], [short])

    def test_malformed_top_level_response_still_fails_validation(self):
        with self.assertRaises(EvidenceValidationError):
            self.answer_with({"claims": "bad"})

    def test_usage_contains_only_reported_token_counts_for_this_call(self):
        models = Models()
        embedding = {"data": [{"index": 0, "embedding": [1]}], "usage": {"prompt_tokens": 7}}
        chat = {"choices": [{"message": {"content": "{}"}}],
                "usage": {"prompt_tokens": 19, "completion_tokens": 0}}
        with patch.object(models, "post", side_effect=[embedding, chat]):
            self.assertEqual(models.embed_question("query"), [1])
            self.assertEqual(models.question_embedding, [1])
            models.generate([])
        self.assertEqual(models.usage, {"embedding_tokens": 7, "prompt_tokens": 19, "completion_tokens": 0})
        with patch.object(models, "post", return_value={**chat, "usage": {"prompt_tokens": "invalid"}}):
            models.generate([])
        self.assertIsNone(models.usage["prompt_tokens"])
        self.assertIsNone(models.usage["completion_tokens"])

    def test_token_usage_totals_both_generations_in_a_repair(self):
        models = Models()
        reply = {"choices": [{"message": {"content": "{}"}}],
                 "usage": {"prompt_tokens": 13, "completion_tokens": 3}}
        with patch.object(models, "post", return_value=reply):
            models.generate([])
            models.generate([])
        self.assertEqual(models.usage["prompt_tokens"], 26)
        self.assertEqual(models.usage["completion_tokens"], 6)

    def test_truncated_content_is_rejected_and_keeps_provider_usage(self):
        models = Models()
        reply = {"choices": [{"message": {"content": '{"claims": ['}, "finish_reason": "length"}],
                 "usage": {"completion_tokens": 450}}
        with patch.object(models, "post", return_value=reply), self.assertRaises(InvalidGeneration):
            models.generate([])
        self.assertEqual(models.usage["completion_tokens"], 450)


class LadderFollowUpTests(unittest.TestCase):
    def test_f2_replays_lunas_departure_only_answer_against_the_retrieved_destination(self):
        cases = {case["id"]: case for case in json.loads((run.DIRECTORY / "cases.json").read_text(encoding="utf-8"))}
        case = cases["ladder-next-step"]
        # Luna's live reply cited the conditional instruction in step 2 only.
        departure = {"text": "If clear, continue to Step 3.", "citations": [
            {"id": "A3-8.1-02", "quote": "clear"}, {"id": "A3-8.1-02", "quote": "continue to Step 3."}]}
        models, index = Mock(), Mock()
        models.generate.return_value = {"status": "answered", "claims": [departure]}
        steps = extract_chunks()
        index.retrieve.return_value = [dict(steps[n - 1], score=0.5) for n in (2, 5, 3, 1)]
        history = [{"question": cases["ladder-descent"]["question"], "answer": "Inspect the ladder hand railing."}]
        answer = ask(case["question"], index, models, history)
        record = run.record_case(case, answer)
        self.assertTrue(record["metrics"]["passed"])
        self.assertEqual(record["cited_steps"], [2, 3])
        self.assertEqual(len(answer["claims"]), 1)
        self.assertTrue(answer["claims"][0]["text"].startswith("If clear, continue to Step 3."))
        self.assertIn("On arrival on the tank top", answer["claims"][0]["text"])
        models.generate.assert_called_once()
        self.assertEqual(ask("What if the ladder is clear?", index, models)["claims"], [departure])
        index.retrieve.return_value = [steps[1]]
        self.assertEqual(ask(case["question"], index, models, history)["claims"], [departure])

    def test_f2_accepts_next_step_from_cited_metadata_and_grades_the_follow_up(self):
        cases = {case["id"]: case for case in json.loads((run.DIRECTORY / "cases.json").read_text(encoding="utf-8"))}
        ladder_quote = "the ladder hand railing, the base of the ladder and behind the ladder"
        tank_top_quote = ("On arrival on the tank top, perform a full 360-degree, thorough visual inspection "
                          "of the perimeter of the hold and all visible high structures.")
        parent_claim = {"text": "The ladder hand railing and the base of the ladder.",
                        "citations": [{"id": "A3-8.1-02", "quote": ladder_quote}]}
        next_claim = {"text": f"The next step is Step 3: {tank_top_quote}",
                      "citations": [{"id": "A3-8.1-03", "quote": tank_top_quote}]}
        replies = [{"status": "answered", "claims": [claim]} for claim in (parent_claim, next_claim, next_claim)]
        with (patch("backend.app.Models") as model, patch("backend.app.load_index") as index,
              patch("backend.app.record_trace", return_value={})):
            index.return_value.retrieve.return_value = [dict(row, score=0.5) for row in extract_chunks()[:4]]
            model.return_value.generate.side_effect = replies
            parent = run.evaluate_case(cases["ladder-descent"], None)
            follow_up = run.evaluate_case(cases["ladder-next-step"], None, {parent["id"]: parent})
        self.assertTrue(parent["metrics"]["passed"])
        self.assertEqual(follow_up["history"], [{"question": parent["question"], "answer": parent_claim["text"]}])
        self.assertEqual(follow_up["status"], "answered")
        self.assertEqual(follow_up["claims"], [next_claim])
        self.assertEqual(follow_up["cited_steps"], [3])
        self.assertTrue(follow_up["metrics"]["passed"])
        self.assertEqual(model.return_value.generate.call_count, 2)
