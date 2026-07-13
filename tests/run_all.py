"""wuxianhuabu AI 功能完整测试套件 — 主入口."""
from __future__ import annotations
import json, os, sys, time, traceback
from typing import Tuple, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers.http import post_json, get_json, delete_json, download_to, now_ms
from helpers.media import verify_png, verify_jpg, detect_image, verify_video
from helpers.report import Report

BASE = "http://localhost:5420"
ROOT = "/Users/wangziming/aimake/zmt/wuxianhuabu/tests"
def ARTE(*p): return os.path.join(ROOT, "artifacts", *p)
def REL(p: str) -> str: return os.path.relpath(p, ROOT)

DEFAULT_IMAGE_MODEL = "agnes-image-2.0-flash"
DEFAULT_TEXT_MODEL = "agnes-2.0-flash"
DEFAULT_VIDEO_MODEL = "agnes-video-v2.0"

VIDEO_MAX_WAIT_MS = 10 * 60 * 1000
VIDEO_POLL_BASE_MS = 5_000
VIDEO_POLL_MAX_MS = 30_000

LOCAL_ANNOTATION_PROMPT = "保留原图布局、构图、配色、角色身份和主要场景元素不变。仅在被红色笔迹圈出的区域中执行指定的修改，未被圈出的区域必须保持像素级一致，包括背景、人物衣着、道具、光照方向、色温、表情和整体风格。不添加新元素、不删除已有元素、不改变画幅比例。修改完成后，红色标注线应自然融合进最终画面中，不再以独立标注的形式出现。"

MOTION_TRANSFER_PROMPT = "Motion transfer workflow.\n[Figure-1] is the identity figure — its face, hair, body shape, outfit, art style, and color palette MUST be preserved exactly.\n[Figure-2] is the motion figure — only its body pose, gesture, and orientation should be referenced for action; ignore its identity, clothing, and background entirely.\nGenerate a new image where Figure-1 adopts Figure-2's pose and motion, keeping Figure-1's complete identity. Background should be a simple clean studio environment. No text, no logos, no watermark."

SIX_VIEW_PROMPT = "以参考图中的产品为唯一主体，生成一张 16:9 横向画幅产品六视图：正视图、侧视图、后视图、俯视图、后侧视图、顶视图。标准无透视变形，柔和电影光，轻微胶片颗粒，8K 超写实。保持产品材质、颜色、比例、细节与识别特征一致，不添加文字、标志、水印或 UI 元素。"

LIGHTING_CONTACT_SHEET_PROMPT = """Create a single 3x3 luxury fashion editorial lighting exploration contact sheet.
The final image must contain exactly nine separate panels arranged in a clean 3x3 grid.
The same subject must appear in all nine panels.
Maintain character continuity, facial features, hairstyle, styling logic, wardrobe logic, and product continuity.
The purpose of the contact sheet is to explore nine completely different luxury commercial lighting systems.
Each panel must use a distinctly different professional photography lighting setup.
Panel 1 - Luxury Beige Editorial: soft frontal beauty light, large octabox illumination, creamy beige gradient background, luxury fashion campaign atmosphere.
Panel 2 - High-Key Beauty Campaign: bright commercial beauty lighting, nearly shadowless illumination, white-to-sky-blue seamless background, glowing skin highlights, luxury cosmetics advertisement lighting.
Panel 3 - Deep Brown Silhouette Portrait: strong side lighting, controlled shadow falloff, deep brown gradient background, shoulder rim light, cinematic silhouette portrait.
Panel 6 - Premium Product Advertising Light: strong side illumination, sharp highlight edges, cool white background, realistic shadow projection, luxury consumer electronics advertisement lighting.
Panel 7 - Contemporary Blue Commercial Light: cool blue gradient background, soft directional lighting, glossy fabric reflections, premium technology campaign atmosphere.
Panel 8 - Luxury Eyewear Backlight: bright white background, strong side-backlight, clean contour lighting, premium eyewear advertising atmosphere.
Panel 9 - High-Contrast Beauty Close-Up: macro beauty lighting, extreme skin detail visibility, controlled specular highlights, sharp facial contours, luxury skincare campaign aesthetic, premium cosmetic photography.
Do not simply change background colors. Each panel must visibly demonstrate a unique professional photography lighting setup.
Luxury fashion editorial photography, commercial advertising portrait, realistic skin texture, premium retouching, ultra photorealistic, magazine-quality lighting study.
No text, no logos, no watermark, no UI elements. Nine clearly separated panels. Final aspect ratio must remain 16:9."""


def setup_env() -> dict:
    s, status = get_json("/api/ai-status")
    if s != 200:
        raise RuntimeError(f"dev server not reachable, ai-status HTTP {s}: {status}")
    _, models = get_json("/api/ai-models", timeout=60)
    return {
        "configured": bool(status.get("configured")),
        "baseUrl": status.get("baseUrl"),
        "imageModels": [m["id"] for m in models.get("imageModels", [])],
        "textModels": [m["id"] for m in models.get("textModels", [])],
        "videoModel": DEFAULT_VIDEO_MODEL,
        "imageModel": DEFAULT_IMAGE_MODEL,
        "textModel": DEFAULT_TEXT_MODEL,
    }


def save_url_to(url: str, dest: str) -> Tuple[bool, str]:
    code, size = download_to(url, dest, timeout=90)
    if code == 200 and size > 0:
        kind = detect_image(dest)
        if kind == "png":
            ok, msg = verify_png(dest)
        elif kind == "jpg":
            ok, msg = verify_jpg(dest)
        else:
            ok, msg = (size > 4096, f"{kind}, {size} bytes")
        return ok, msg
    return False, f"download failed HTTP {code} size {size}"


def report_section(report: Report, cid: str, name: str, status: str, elapsed: float, *, prompt: str = "", model: str = "", body: dict = None, resp: dict = None, artifacts: list = None, msg: str = "") -> None:
    duration_s = f"{elapsed:.1f}s"
    artifacts_str = ", ".join(f"[{os.path.basename(a)}]({REL(a)})" for a in (artifacts or [])) if artifacts else "n/a"
    body_md = ""
    if body is not None:
        body_md = f"\n**请求体**:\n```json\n{json.dumps(body, ensure_ascii=False, indent=2)[:1200]}\n```"
    resp_md = ""
    if resp is not None:
        s = json.dumps(resp, ensure_ascii=False, indent=2)
        resp_md = f"\n**响应**:\n```json\n{s[:1500]}\n```"
    artefact_md = ""
    if artifacts:
        for a in artifacts:
            sz = os.path.getsize(a) if os.path.exists(a) else 0
            artefact_md += f"\n**产物**: `{a}` ({sz} bytes)"
    prompt_md = f"\n**prompt**: `{prompt}`" if prompt else ""
    model_md = f"\n**model**: `{model}`" if model else ""
    msg_md = f"\n**指标**: {msg}" if msg else ""
    body_text = (
        f"### {cid} {name}\n**状态**: **{status}** | **耗时**: {duration_s}\n"
        f"**产物**: {artifacts_str}{artefact_md}{prompt_md}{model_md}{msg_md}{body_md}{resp_md}\n"
    )
    report.add(cid, name, status, duration_s, artifacts_str, body_text)


# ---------------------------------------------------------------------------
# F1: 文生图 单图
# ---------------------------------------------------------------------------
def case_f1(report: Report, env: dict) -> dict:
    cid, name = "F1", "文生图 单图"
    t0 = now_ms()
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    prompt = "一只柴犬坐在草地上，正面，自然光，电影质感，柔和色调"
    body = {"prompt": prompt, "model": env["imageModel"], "size": "1024x1024", "aspectRatio": "1:1", "count": 1}
    s, resp = post_json("/api/generate-image", body, timeout=180)
    elapsed = (now_ms() - t0) / 1000
    if s != 200 or "imageUrls" not in resp or not resp["imageUrls"]:
        report_section(report, cid, name, "FAIL", elapsed, body=body, resp=resp, msg=f"http {s}")
        return {}
    url = resp["imageUrls"][0]
    dest = os.path.join(folder, "image_0.png")
    ok, msg = save_url_to(url, dest)
    status = "PASS" if ok else "FAIL"
    report_section(report, cid, name, status, elapsed, prompt=prompt, model=env["imageModel"], body=body, resp={k: resp[k] for k in ("imageCount","referenceCount","model") if k in resp}, artifacts=[dest], msg=msg)
    return {"urls": resp["imageUrls"], "dest": dest}


# ---------------------------------------------------------------------------
# F2: 文生图 多张
# ---------------------------------------------------------------------------
def case_f2(report: Report, env: dict) -> dict:
    cid, name = "F2", "文生图 多张 (count=3, 9:16)"
    t0 = now_ms()
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    prompt = "三张不同风格的极简插画：第一张是日落山脉水彩，第二张是赛博朋克城市夜景，第三张是日式浮世绘海浪"
    body = {"prompt": prompt, "model": env["imageModel"], "size": "768x1024", "aspectRatio": "9:16", "count": 3}
    s, resp = post_json("/api/generate-image", body, timeout=240)
    elapsed = (now_ms() - t0) / 1000
    if s != 200 or "imageUrls" not in resp or len(resp["imageUrls"]) < 1:
        report_section(report, cid, name, "FAIL", elapsed, body=body, resp=resp, msg=f"http {s}")
        return {}
    dests = []
    ok_all = True
    for i, url in enumerate(resp["imageUrls"]):
        d = os.path.join(folder, f"image_{i}.png")
        ok, m = save_url_to(url, d)
        if ok: dests.append(d)
        else: ok_all = False
    status = "PASS" if ok_all and len(dests) == len(resp["imageUrls"]) else ("PARTIAL" if dests else "FAIL")
    report_section(report, cid, name, status, elapsed, prompt=prompt, model=env["imageModel"], body=body, resp={"imageCount": resp.get("imageCount")}, artifacts=dests, msg=f"{len(dests)} images downloaded")
    return {"urls": resp["imageUrls"], "dests": dests}


# ---------------------------------------------------------------------------
# F3: 图生图 多参考
# ---------------------------------------------------------------------------
def case_f3(report: Report, env: dict, ref_urls: list) -> dict:
    cid, name = "F3", "图生图 多参考"
    t0 = now_ms()
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    prompt = "把参考图1的森林氛围融入到参考图2的场景，但保留两者主要色调与材质"
    body = {"prompt": prompt, "model": env["imageModel"], "size": "1024x1024", "aspectRatio": "1:1", "count": 1, "sourceImageUrls": ref_urls}
    s, resp = post_json("/api/generate-image", body, timeout=180)
    elapsed = (now_ms() - t0) / 1000
    if s != 200 or "imageUrls" not in resp or not resp["imageUrls"]:
        report_section(report, cid, name, "FAIL", elapsed, body=body, resp=resp, msg=f"http {s}")
        return {}
    url = resp["imageUrls"][0]
    dest = os.path.join(folder, "image_0.png")
    ok, msg = save_url_to(url, dest)
    status = "PASS" if ok else "FAIL"
    report_section(report, cid, name, status, elapsed, prompt=prompt, body=body, resp={"referenceCount": resp.get("referenceCount"), "imageCount": resp.get("imageCount")}, artifacts=[dest] if ok else [], msg=msg)
    return {"urls": resp["imageUrls"]}


# ---------------------------------------------------------------------------
# F4: 图编辑 单参考
# ---------------------------------------------------------------------------
def case_f4(report: Report, env: dict, ref_url: str) -> dict:
    cid, name = "F4", "图编辑 单参考"
    t0 = now_ms()
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    prompt = "把背景改成夜晚的城市霓虹灯氛围，但柴犬保持完全一致"
    body = {"prompt": prompt, "model": env["imageModel"], "size": "1024x1024", "aspectRatio": "1:1", "count": 1, "sourceImageUrls": [ref_url]}
    s, resp = post_json("/api/generate-image", body, timeout=180)
    elapsed = (now_ms() - t0) / 1000
    if s != 200 or "imageUrls" not in resp or not resp["imageUrls"]:
        report_section(report, cid, name, "FAIL", elapsed, body=body, resp=resp, msg=f"http {s}")
        return {}
    url = resp["imageUrls"][0]
    dest = os.path.join(folder, "image_0.png")
    ok, msg = save_url_to(url, dest)
    status = "PASS" if ok else "FAIL"
    report_section(report, cid, name, status, elapsed, prompt=prompt, body=body, resp={"imageCount": resp.get("imageCount")}, artifacts=[dest] if ok else [], msg=msg)
    return {"urls": resp["imageUrls"]}


# ---------------------------------------------------------------------------
# F5: 局部编辑（用 LOCAL_ANNOTATION_PROMPT 等价物）
# ---------------------------------------------------------------------------
def case_f5(report: Report, env: dict, ref_url: str) -> dict:
    cid, name = "F5", "局部编辑（红色标注 inpaint 等价）"
    t0 = now_ms()
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    prompt = LOCAL_ANNOTATION_PROMPT + "\n具体圈选变更：在柴犬头上加一顶红色棒球帽。"
    body = {"prompt": prompt, "model": env["imageModel"], "size": "1024x1024", "aspectRatio": "1:1", "count": 1, "sourceImageUrls": [ref_url]}
    s, resp = post_json("/api/generate-image", body, timeout=180)
    elapsed = (now_ms() - t0) / 1000
    if s != 200 or "imageUrls" not in resp or not resp["imageUrls"]:
        report_section(report, cid, name, "FAIL", elapsed, body=body, resp=resp, msg=f"http {s}")
        return {}
    url = resp["imageUrls"][0]
    dest = os.path.join(folder, "image_0.png")
    ok, msg = save_url_to(url, dest)
    status = "PASS" if ok else "FAIL"
    report_section(report, cid, name, status, elapsed, prompt=prompt[:200]+"...", body=body, artifacts=[dest] if ok else [], msg=msg)
    return {"urls": resp["imageUrls"]}


# ---------------------------------------------------------------------------
# F6: Six view
# ---------------------------------------------------------------------------
def case_f6(report: Report, env: dict, ref_url: str) -> dict:
    cid, name = "F6", "工作流：six-view"
    t0 = now_ms()
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    body = {"prompt": SIX_VIEW_PROMPT, "model": env["imageModel"], "size": "1152x648", "aspectRatio": "16:9", "count": 1, "sourceImageUrls": [ref_url]}
    s, resp = post_json("/api/generate-image", body, timeout=180)
    elapsed = (now_ms() - t0) / 1000
    if s != 200 or "imageUrls" not in resp or not resp["imageUrls"]:
        report_section(report, cid, name, "FAIL", elapsed, body=body, resp=resp, msg=f"http {s}")
        return {}
    url = resp["imageUrls"][0]
    dest = os.path.join(folder, "image_0.png")
    ok, msg = save_url_to(url, dest)
    status = "PASS" if ok else "FAIL"
    report_section(report, cid, name, status, elapsed, prompt=SIX_VIEW_PROMPT[:200]+"...", body=body, artifacts=[dest] if ok else [], msg=msg)
    return {"urls": resp["imageUrls"]}


# ---------------------------------------------------------------------------
# F7: lighting-contact-sheet
# ---------------------------------------------------------------------------
def case_f7(report: Report, env: dict, ref_url: str) -> dict:
    cid, name = "F7", "工作流：lighting-contact-sheet 3×3 灯格"
    t0 = now_ms()
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    body = {"prompt": LIGHTING_CONTACT_SHEET_PROMPT, "model": env["imageModel"], "size": "1152x648", "aspectRatio": "16:9", "count": 1, "sourceImageUrls": [ref_url]}
    s, resp = post_json("/api/generate-image", body, timeout=240)
    elapsed = (now_ms() - t0) / 1000
    if s != 200 or "imageUrls" not in resp or not resp["imageUrls"]:
        report_section(report, cid, name, "FAIL", elapsed, body=body, resp=resp, msg=f"http {s}")
        return {}
    url = resp["imageUrls"][0]
    dest = os.path.join(folder, "image_0.png")
    ok, msg = save_url_to(url, dest)
    status = "PASS" if ok else "FAIL"
    report_section(report, cid, name, status, elapsed, prompt=LIGHTING_CONTACT_SHEET_PROMPT[:150]+"...", body=body, artifacts=[dest] if ok else [], msg=msg)
    return {"urls": resp["imageUrls"]}


# ---------------------------------------------------------------------------
# F8: motion-transfer
# ---------------------------------------------------------------------------
def case_f8(report: Report, env: dict, identity_url: str, motion_url: str) -> dict:
    cid, name = "F8", "工作流：motion-transfer"
    t0 = now_ms()
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    body = {"prompt": MOTION_TRANSFER_PROMPT, "model": env["imageModel"], "size": "1024x1024", "aspectRatio": "1:1", "count": 1, "sourceImageUrls": [identity_url, motion_url]}
    s, resp = post_json("/api/generate-image", body, timeout=180)
    elapsed = (now_ms() - t0) / 1000
    if s != 200 or "imageUrls" not in resp or not resp["imageUrls"]:
        report_section(report, cid, name, "FAIL", elapsed, body=body, resp=resp, msg=f"http {s}")
        return {}
    url = resp["imageUrls"][0]
    dest = os.path.join(folder, "image_0.png")
    ok, msg = save_url_to(url, dest)
    status = "PASS" if ok else "FAIL"
    report_section(report, cid, name, status, elapsed, prompt=MOTION_TRANSFER_PROMPT[:200]+"...", body=body, resp={"referenceCount": resp.get("referenceCount")}, artifacts=[dest] if ok else [], msg=msg)
    return {"urls": resp["imageUrls"]}


# ---------------------------------------------------------------------------
# F9: Agent Chat
# ---------------------------------------------------------------------------
def case_f9(report: Report, env: dict) -> dict:
    cid, name = "F9", "AI Agent 对话 → 生成 prompt + image"
    t0 = now_ms()
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    body = {
        "messages": [
            {"role": "user", "content": "帮我生成一盏未来感台灯，金属质感，放在黑暗中"},
        ],
        "model": env["textModel"],
        "autoGenerate": True,
    }
    s, resp = post_json("/api/agent-chat", body, timeout=120)
    elapsed = (now_ms() - t0) / 1000
    if s != 200:
        report_section(report, cid, name, "FAIL", elapsed, body=body, resp=resp, msg=f"http {s}")
        return {}
    action = resp.get("action")
    prompt = resp.get("prompt", "")
    message = resp.get("message", "")
    thinking = resp.get("thinking", [])
    # If action is generate_image, also fire the image gen to verify pipeline
    artefact = []
    msg = f"action={action}, prompt_len={len(prompt)}, thinking={len(thinking)}, msg_len={len(message)}"
    if action == "generate_image" and prompt:
        s2, resp2 = post_json("/api/generate-image", {"prompt": prompt, "model": env["imageModel"], "size": "1024x1024", "aspectRatio": "1:1", "count": 1}, timeout=180)
        if s2 == 200 and resp2.get("imageUrls"):
            url = resp2["imageUrls"][0]
            dest = os.path.join(folder, "image_0.png")
            ok, m = save_url_to(url, dest)
            if ok:
                artefact = [dest]
                msg += f", image ok ({m})"
    status = "PASS" if action == "generate_image" and prompt else ("PARTIAL" if prompt else "FAIL")
    report_section(report, cid, name, status, elapsed, prompt=prompt, body=body, resp={k: resp.get(k) for k in ("action","message","size","count","model") if k in resp}, artifacts=artefact, msg=msg)
    return {"action": action, "prompt": prompt, "message": message}


# ---------------------------------------------------------------------------
# F10: analyze-image-prompt
# ---------------------------------------------------------------------------
def case_f10(report: Report, env: dict, image_url: str) -> dict:
    cid, name = "F10", "反推提示词 analyze-image-prompt"
    t0 = now_ms()
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    body = {"imageUrl": image_url, "imageTitle": "柴犬草地肖像", "instruction": "请分析这张图片，生成一段能复现此效果的文生图提示词"}
    s, resp = post_json("/api/analyze-image-prompt", body, timeout=180)
    elapsed = (now_ms() - t0) / 1000
    if s != 200:
        report_section(report, cid, name, "FAIL", elapsed, body=body, resp=resp, msg=f"http {s}")
        return {}
    prompt = resp.get("prompt", "")
    status = "PASS" if (prompt and len(prompt) >= 20) else "FAIL"
    msg = f"prompt_len={len(prompt)}, model={resp.get('model')}"
    report_section(report, cid, name, status, elapsed, prompt=prompt[:300], body=body, resp={"prompt_preview": prompt[:200], "model": resp.get("model")}, msg=msg)
    return {"prompt": prompt}


# ---------------------------------------------------------------------------
# F11: 图片模型列举
# ---------------------------------------------------------------------------
def case_f11(report: Report, env: dict) -> dict:
    cid, name = "F11", "图片模型列举 /api/ai-models"
    t0 = now_ms()
    s, resp = get_json("/api/ai-models", timeout=60)
    elapsed = (now_ms() - t0) / 1000
    image_models = resp.get("imageModels", [])
    text_models = resp.get("textModels", [])
    target_image = "agnes-image-2.0-flash"
    target_text = "agnes-2.0-flash"
    ok = (target_image in [m["id"] for m in image_models]) and (target_text in [m["id"] for m in text_models])
    status = "PASS" if ok else "FAIL"
    msg = f"imageModels={len(image_models)}, textModels={len(text_models)}"
    report_section(report, cid, name, status, elapsed, body={"method":"GET","path":"/api/ai-models"}, resp={"imageModels": image_models, "textModels": text_models}, msg=msg)
    return {"imageModels": image_models, "textModels": text_models}


def main():
    env = setup_env()
    print(f"[setup] configured={env['configured']} baseUrl={env['baseUrl']}")
    print(f"[setup] imageModels={env['imageModels']}")
    print(f"[setup] textModels={env['textModels']}")

    report = Report()
    started = time.time()

    f1 = case_f1(report, env)
    print(f"[F1] {f1.get('dest')}")
    f1_url = (f1.get("urls") or [None])[0]

    f2 = case_f2(report, env)
    print(f"[F2] {len(f2.get('dests') or [])} images")
    f2_urls = f2.get("urls") or []

    # For F3 we need 2 reference URLs — use F1 + F2[0]
    ref_urls_f3 = [f1_url] + f2_urls[:1] if f1_url and f2_urls else []
    f3 = case_f3(report, env, ref_urls_f3) if ref_urls_f3 else {}
    print(f"[F3] {f3.get('urls')}")

    # For F4 we need single reference
    f4 = case_f4(report, env, f1_url) if f1_url else {}
    print(f"[F4] {f4.get('urls')}")

    # F5: local edit
    f5 = case_f5(report, env, f1_url) if f1_url else {}
    print(f"[F5] {f5.get('urls')}")

    # F6: six-view using F1
    f6 = case_f6(report, env, f1_url) if f1_url else {}
    print(f"[F6] {f6.get('urls')}")

    # F7: lighting grid using F1
    f7 = case_f7(report, env, f1_url) if f1_url else {}
    print(f"[F7] {f7.get('urls')}")

    # F8: motion transfer using F1 + F2 (identity + motion)
    if f1_url and f2_urls:
        f8 = case_f8(report, env, f1_url, f2_urls[1] if len(f2_urls) > 1 else f2_urls[0])
    else:
        f8 = {}
    print(f"[F8] {f8.get('urls')}")

    # F9: agent chat
    f9 = case_f9(report, env)
    print(f"[F9] action={f9.get('action')}")

    # F10: reverse prompt from F1 image
    f10 = case_f10(report, env, f1_url) if f1_url else {}
    print(f"[F10] prompt_len={(f10.get('prompt') or '').__len__()}")

    # F11: model listing
    f11 = case_f11(report, env)
    print(f"[F11] imageModels={len(f11.get('imageModels') or [])} textModels={len(f11.get('textModels') or [])}")

    ended = time.time()
    report.write(started, ended, env)
    print(f"\n[done] total {int(ended-started)}s")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[fatal] {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
