"""Optional System-1 decision layer (Laya local / Jev cloud / deterministic fallback).

The Samaj Drishti AI engine already has deterministic local implementations for
every decision, so this module is strictly additive: it lets callers ask typed
decision questions (choice / score / noul) and get back calibrated probabilities
from a real decision model when one is available.

 * Laya  - open-weight (Apache-2.0), runs in-process / in-browser via ONNX, fits
           on a phone. Used when the `laya` Python package is installed and
           LAYA_ENABLED is not "0". Never required.
 * Jev   - TypeSafe AI's hosted equivalent. Used when JEV_API_KEY is set and
           Laya is unavailable or raises.
 * local - deterministic uniform/heuristic fallback so the endpoint always
           returns a well-formed, HTTP-200 response (the dashboard degrades
           instead of breaking), matching the rest of app.py.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

_ROUTER = None
_ROUTER_TRIED = False


def _laya_available() -> bool:
    if os.environ.get("LAYA_ENABLED", "1") == "0":
        return False
    try:
        import laya  # noqa: F401
        return True
    except Exception:  # noqa: BLE001 - any import problem means "not available"
        return False


def _get_router():
    """Build the Laya Router once, lazily. Returns None if unavailable."""
    global _ROUTER, _ROUTER_TRIED
    if _ROUTER is not None:
        return _ROUTER
    if _ROUTER_TRIED:
        return None
    _ROUTER_TRIED = True
    try:
        from laya import Router  # type: ignore
        _ROUTER = Router(preload=True)
    except Exception as exc:  # noqa: BLE001 - never take the API down
        print(f"[laya] init failed, falling back: {exc}")
        _ROUTER = None
    return _ROUTER


def _jev_key() -> str:
    return (os.environ.get("JEV_API_KEY") or "").strip()


def _jev_url() -> str:
    return os.environ.get("JEV_API_URL", "https://api.typesafe.ai/v1/system_one")


def _jev_available() -> bool:
    return bool(_jev_key()) and os.environ.get("JEV_ENABLED", "1") != "0"


def _jev_predict(state, questions, timeout: int = 30):
    if not _jev_available():
        return None
    payload = json.dumps({"state": state, "questions": questions}).encode("utf-8")
    req = urllib.request.Request(
        _jev_url(),
        data=payload,
        headers={
            "Authorization": f"Bearer {_jev_key()}",
            "Content-Type": "application/json",
            "User-Agent": "samaj-drishti-ai-engine/1.0",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001 - never propagate
        print(f"[jev] call failed: {exc}")
        return None


def _local_fallback(state, questions):
    """Deterministic, schema-correct stand-in. No model, no network."""
    answers = {}
    for q in questions or []:
        if not isinstance(q, dict):
            continue
        qid = q.get("id") or q.get("name") or "q"
        qtype = q.get("type") or "noul"
        if qtype == "choice":
            opts = q.get("options") or q.get("choices") or []
            n = max(1, len(opts))
            answers[qid] = {
                "type": "choice",
                "choice": opts[0] if opts else None,
                "probabilities": {str(o): round(1.0 / n, 4) for o in opts},
            }
        elif qtype == "score":
            levels = q.get("levels") or q.get("options") or []
            n = max(1, len(levels))
            answers[qid] = {
                "type": "score",
                "expected": round((n - 1) / 2, 2) if n > 1 else 0,
                "probabilities": {str(l): round(1.0 / n, 4) for l in levels},
            }
        else:  # noul / yes-no
            answers[qid] = {"type": "noul", "p_true": 0.5, "p_false": 0.5}
    return {"answers": answers, "routing": {"model": "local-fallback", "reason": "no decision model available"}}


def decide(state, questions):
    """Answer typed decision questions. Always returns a dict with answers+routing."""
    if not questions:
        return {"answers": {}, "routing": {"model": "local-fallback", "reason": "no questions"}, "provider": "local-fallback"}

    router = _get_router() if _laya_available() else None
    if router is not None:
        try:
            result = router.predict(state, questions)
            if isinstance(result, dict):
                result.setdefault("provider", "laya-local")
                return result
        except Exception as exc:  # noqa: BLE001
            print(f"[laya] predict failed, trying Jev: {exc}")

    jev_result = _jev_predict(state, questions)
    if jev_result is not None:
        if isinstance(jev_result, dict):
            jev_result.setdefault("provider", "jev-cloud")
            return jev_result

    fallback = _local_fallback(state, questions)
    fallback["provider"] = "local-fallback"
    return fallback


def provider_label() -> str:
    if _laya_available() and _ROUTER is not None:
        return "laya-local"
    if _jev_available():
        return "jev-cloud"
    return "local-fallback"
