"""HTTP/JSON helpers for wuxianhuabu /api/* proxy endpoints."""
from __future__ import annotations
import json, time, urllib.request, urllib.error, ssl, socket
from typing import Tuple, Optional

DEFAULT_BASE = "http://localhost:5420"
DEFAULT_TIMEOUT = 240
_ctx = ssl.create_default_context()


def _request(method: str, url: str, body: Optional[dict] = None, timeout: int = DEFAULT_TIMEOUT) -> Tuple[int, dict]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if data else {},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_ctx) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            status = resp.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace") if e.fp else ""
        status = e.code
    except (urllib.error.URLError, socket.timeout) as e:
        return 0, {"error": f"transport: {e!r}"}
    try:
        return status, json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return status, {"_raw": raw[:2000]}


def get_json(path: str, base: str = DEFAULT_BASE, timeout: int = 30) -> Tuple[int, dict]:
    return _request("GET", base + path, timeout=timeout)


def post_json(path: str, body: dict, base: str = DEFAULT_BASE, timeout: int = DEFAULT_TIMEOUT) -> Tuple[int, dict]:
    return _request("POST", base + path, body=body, timeout=timeout)


def delete_json(path: str, base: str = DEFAULT_BASE, timeout: int = 30) -> Tuple[int, dict]:
    return _request("DELETE", base + path, timeout=timeout)


def download_to(url: str, dest: str, timeout: int = 60) -> Tuple[int, int]:
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_ctx) as resp:
            data = resp.read()
            with open(dest, "wb") as f:
                f.write(data)
            return resp.status, len(data)
    except Exception:
        return 0, 0


def now_ms() -> int:
    return int(time.time() * 1000)
