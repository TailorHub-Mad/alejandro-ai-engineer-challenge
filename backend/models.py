"""One backend credential for OpenAI embeddings and chat."""
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from dotenv import load_dotenv

from .source import ROOT

load_dotenv(ROOT / ".env")
PROVIDERS = {
    "openai": ("https://api.openai.com/v1", "OPENAI_API_KEY", ""),
    "openrouter": ("https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "openai/"),
    "vercel": ("https://ai-gateway.vercel.sh/v1", "AI_GATEWAY_API_KEY", "openai/"),
}
EMBEDDING_MODEL = "text-embedding-3-small"
CHAT_MODEL = "gpt-6-luna"
CHAT_MODELS = ("gpt-6-luna", "gpt-6.2-sol", "gpt-6.2-astra")
MAX_COMPLETION_TOKENS = 2048
DIMENSIONS = 256
TIMEOUT = 25


class ModelError(Exception):
    """Safe to display. Upstream bodies and credentials stay out of diagnostics."""


class InvalidGeneration(ModelError):
    """The provider replied, but the generated content could not be validated."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Models:
    def __init__(self):
        self.provider = os.getenv("MODEL_PROVIDER", "openai").strip().lower()
        if self.provider not in PROVIDERS:
            raise ModelError("Set MODEL_PROVIDER to openai, openrouter, or vercel.")
        self.url, self.key_variable, self.prefix = PROVIDERS[self.provider]
        self.chat_model = os.getenv("CHAT_MODEL", CHAT_MODEL).strip()
        if self.chat_model not in CHAT_MODELS:
            raise ModelError("Set CHAT_MODEL to one of: " + ", ".join(CHAT_MODELS) + ".")
        self.usage = {"embedding_tokens": None, "prompt_tokens": None, "completion_tokens": None}
        self.chat_calls = 0
        self.question_embedding = None

    def post(self, path, payload):
        key = os.getenv(self.key_variable, "").strip()
        if not key:
            raise ModelError(f"Set {self.key_variable} on the backend and restart it.")
        request = Request(self.url + "/" + path, data=json.dumps(payload).encode(), headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json",
        })
        try:
            with build_opener(NoRedirect()).open(request, timeout=TIMEOUT) as response:
                return json.load(response)
        except HTTPError as exc:
            explanation = {
                401: "Check the backend API key.", 402: "Check the available model credit.",
                403: "Check the key's model permissions.", 429: "The rate limit was reached. Try again shortly.",
            }.get(exc.code, "Check the provider and try again.")
            raise ModelError(f"Model service returned HTTP {exc.code}. {explanation}") from None
        except TimeoutError:
            raise ModelError(f"The model service timed out after {TIMEOUT} seconds.") from None
        except (URLError, OSError, ValueError):
            raise ModelError("Could not read a response from the model service. Check connectivity and try again.") from None

    def embed(self, texts):
        response = self.post("embeddings", {
            "model": self.prefix + EMBEDDING_MODEL, "input": texts, "dimensions": DIMENSIONS,
        })
        try:
            rows = sorted(response["data"], key=lambda row: row["index"])
            if [row["index"] for row in rows] != list(range(len(texts))):
                raise ValueError
            usage = response.get("usage") or {}
            self.usage["embedding_tokens"] = token_count(usage, "total_tokens", "prompt_tokens")
            return [row["embedding"] for row in rows]
        except (KeyError, TypeError, ValueError):
            raise ModelError("The embedding service returned an incomplete batch.") from None

    def embed_question(self, question):
        self.question_embedding = self.embed([question])[0]
        return self.question_embedding

    def generate(self, messages):
        payload = {
            "model": self.prefix + self.chat_model, "messages": messages,
            "max_completion_tokens": MAX_COMPLETION_TOKENS, "response_format": {"type": "json_object"},
        }
        if self.provider == "openrouter":
            payload["reasoning"] = {"effort": "low"}
        else:
            payload["reasoning_effort"] = "low"
        response = self.post("chat/completions", payload)
        try:
            content = response["choices"][0]["message"]["content"]
            usage = response.get("usage") or {}
            for field in ("prompt_tokens", "completion_tokens"):
                count = token_count(usage, field)
                if self.chat_calls:
                    previous = self.usage[field]
                    count = previous + count if previous is not None and count is not None else None
                self.usage[field] = count
            self.chat_calls += 1
        except (IndexError, KeyError, TypeError):
            raise ModelError("The model returned an unreadable answer. Try again.") from None
        try:
            return json.loads(content)
        except (TypeError, ValueError):
            raise InvalidGeneration("The generated answer was incomplete or malformed.") from None


def token_count(usage, *fields):
    """Use only nonnegative token counts actually reported by the provider."""
    if isinstance(usage, dict):
        for field in fields:
            count = usage.get(field)
            if type(count) is int and count >= 0:
                return count
    return None
