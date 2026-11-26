from io import BytesIO
import os
import unittest
from unittest.mock import patch

from backend.models import ModelError, Models
from eval import run


class ChatModelTests(unittest.TestCase):
    def test_default_is_luna_and_only_three_models_can_be_configured(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(Models().chat_model, "gpt-6-luna")
        for invalid in ("gpt-4.1-mini", "gpt-6.1-sol", "unknown", "openai/gpt-6-luna", ""):
            with (self.subTest(invalid=invalid), patch.dict(os.environ, {"CHAT_MODEL": invalid}),
                  patch.object(Models, "post") as outbound):
                with self.assertRaises(ModelError):
                    Models().generate([])
                outbound.assert_not_called()

    def test_every_provider_routes_only_the_selected_model_and_budgets_reasoning(self):
        reply = {"choices": [{"message": {"content": "{}"}}]}
        for provider, prefix in (("openai", ""), ("openrouter", "openai/"), ("vercel", "openai/")):
            for model in ("gpt-6-luna", "gpt-6.2-sol", "gpt-6.2-astra"):
                with (self.subTest(provider=provider, model=model),
                      patch.dict(os.environ, {"MODEL_PROVIDER": provider, "CHAT_MODEL": model}),
                      patch.object(Models, "post", return_value=reply) as outbound):
                    Models().generate([])
                endpoint, payload = outbound.call_args.args
                self.assertEqual(endpoint, "chat/completions")
                self.assertEqual(payload["model"], prefix + model)
                self.assertEqual(payload["max_completion_tokens"], 2048)
                self.assertNotIn("max_tokens", payload)
                self.assertNotIn("temperature", payload)
                if provider == "openrouter":
                    self.assertEqual(payload["reasoning"], {"effort": "low"})
                else:
                    self.assertEqual(payload["reasoning_effort"], "low")

    def test_http_evaluation_refuses_a_legacy_server_before_submitting_a_question(self):
        for config in (b'{"chat_model":"gpt-4.1-mini"}', b'{}', b'null', b'<html>old backend</html>'):
            with (self.subTest(config=config),
                  patch("sys.argv", ["eval/run.py", "--base-url", "http://127.0.0.1:8000"]),
                  patch.object(run, "urlopen", return_value=BytesIO(config)) as http,
                  patch.object(run, "request_answer") as submit):
                with self.assertRaisesRegex(SystemExit, "model configuration"):
                    run.main()
                http.assert_called_once_with("http://127.0.0.1:8000/api/config", timeout=10)
                submit.assert_not_called()
