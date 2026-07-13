"""Media validation helpers."""
from __future__ import annotations
import os, struct, subprocess
from typing import Optional, Tuple


def verify_png(path: str) -> Tuple[bool, str]:
    if not os.path.exists(path):
        return False, "file missing"
    size = os.path.getsize(path)
    if size < 1024:
        return False, f"too small ({size}B)"
    with open(path, "rb") as f:
        head = f.read(8)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return False, f"not a PNG (head={head!r})"
    return True, f"png, {size} bytes"


def verify_jpg(path: str) -> Tuple[bool, str]:
    if not os.path.exists(path):
        return False, "file missing"
    size = os.path.getsize(path)
    if size < 1024:
        return False, f"too small ({size}B)"
    with open(path, "rb") as f:
        head = f.read(4)
    if head[:2] != b"\xff\xd8":
        return False, f"not a JPG (head={head!r})"
    return True, f"jpg, {size} bytes"


def detect_image(path: str) -> str:
    """Return ext hint: png|jpg|webp|gif|other."""
    with open(path, "rb") as f:
        head = f.read(12)
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if head[:2] == b"\xff\xd8":
        return "jpg"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head[:3] == b"GIF":
        return "gif"
    return "other"


def verify_video(path: str) -> Tuple[bool, str]:
    if not os.path.exists(path):
        return False, "file missing"
    size = os.path.getsize(path)
    if size < 100 * 1024:
        return False, f"too small ({size}B)"
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-print_format", "json",
             "-show_format", "-show_streams", path],
            capture_output=True, text=True, timeout=15
        )
        import json
        info = json.loads(r.stdout)
        streams = info.get("streams", [])
        video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        if not video_stream:
            return False, "no video stream in container"
        codec = video_stream.get("codec_name", "?")
        dur = float(info.get("format", {}).get("duration", 0))
        if dur < 1.0:
            return False, f"duration too short ({dur}s)"
        return True, f"{codec}, {dur:.2f}s, {size} bytes"
    except FileNotFoundError:
        # ffprobe not installed — fall back to size-only check
        return True, f"video (size-only), {size} bytes"
    except Exception as e:
        return False, f"ffprobe error: {e!r}"
