"""Optional LLM client (Groq free tier).

The AI engine works fully without an LLM: every endpoint has a deterministic
local implementation. When GROQ_API_KEY is present the engine additionally uses a
real language model for the executive narrative.

Implementation notes:
  * standard library only (urllib) - no extra dependency
  * these Groq models are "reasoning" models, so max_tokens must be generous or
    the response content comes back empty
  * never raises, never logs the key
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-oss-20b"
# Reasoning models consume completion tokens before producing content.
DEFAULT_MAX_TOKENS = 900


def _model() -> str:
    return os.environ.get("GROQ_MODEL", DEFAULT_MODEL)


def _api_key() -> str:
    return (os.environ.get("GROQ_API_KEY") or "").strip()


def available() -> bool:
    """True when an API key is configured."""
    return bool(_api_key())


def provider_label() -> str:
    """Human readable provider, e.g. 'groq:openai/gpt-oss-20b'."""
    return f"groq:{_model()}" if available() else "local-fallback"


def generate(
    prompt: str,
    system: str | None = None,
    max_tokens: int | None = None,
    temperature: float = 0.3,
    timeout: int = 45,
) -> str | None:
    """Call the chat completions API. Returns the text, or None on any failure."""
    key = _api_key()
    if not key or not prompt:
        return None

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = json.dumps(
        {
            "model": _model(),
            "messages": messages,
            "max_tokens": max_tokens or DEFAULT_MAX_TOKENS,
            "temperature": temperature,
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        GROQ_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            # The provider sits behind an edge WAF that rejects the default
            # "Python-urllib/x.y" agent with HTTP 403 (error code 1010), so a
            # normal, descriptive User-Agent is required.
            "User-Agent": os.environ.get("GROQ_USER_AGENT", "samaj-drishti-ai-engine/1.0"),
            "Accept": "application/json",
        },
        method="POST",
    )

    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                body = json.loads(response.read().decode("utf-8"))
            choices = body.get("choices") or []
            if not choices:
                return None
            message = choices[0].get("message") or {}
            text = (message.get("content") or "").strip()
            return text or None
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(1.5 * (attempt + 1))
                continue
            detail = ""
            try:
                detail = exc.read().decode(errors="replace")[:200]
            except Exception:  # noqa: BLE001
                pass
            print(f"[llm] HTTP {exc.code} from provider {detail}")
            return None
        except Exception as exc:  # noqa: BLE001 - never propagate
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
                continue
            print(f"[llm] call failed: {exc}")
            return None

    return None
