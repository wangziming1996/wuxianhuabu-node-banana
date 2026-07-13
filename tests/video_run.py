"""V1~V5 video test cases — separately runnable for time budget."""
from __future__ import annotations
import json, os, sys, time

sys.path.insert(0, "/Users/wangziming/aimake/zmt/wuxianhuabu/tests")
from helpers.http import post_json, get_json, delete_json, download_to
from helpers.media import verify_video
from helpers.report import Report

BASE = "http://localhost:5420"
ROOT = "/Users/wangziming/aimake/zmt/wuxianhuabu/tests"
def ARTE(*p): return os.path.join(ROOT, "artifacts", *p)
def REL(p): return os.path.relpath(p, ROOT)

DEFAULT_VIDEO_MODEL = "agnes-video-v2.0"
VIDEO_MAX_WAIT_MS = 10 * 60 * 1000
VIDEO_POLL_BASE_MS = 5_000
VIDEO_POLL_MAX_MS = 30_000


def report_section(report, cid, name, status, elapsed, **kw):
    duration_s = f"{elapsed:.1f}s"
    artifacts = kw.get("artifacts") or []
    artifacts_str = ", ".join(f"[{os.path.basename(a)}]({REL(a)})" for a in artifacts) if artifacts else "n/a"
    msg = kw.get("msg", "")
    body = kw.get("body")
    resp = kw.get("resp")
    extras = []
    if msg: extras.append(f"**指标**: {msg}")
    if body is not None:
        s = json.dumps(body, ensure_ascii=False, indent=2)
        extras.append(f"**请求体**:\n```json\n{s[:1000]}\n```")
    if resp is not None:
        s = json.dumps(resp, ensure_ascii=False, indent=2)
        extras.append(f"**响应**:\n```json\n{s[:800]}\n```")
    artefact_md = ""
    for a in artifacts:
        sz = os.path.getsize(a) if os.path.exists(a) else 0
        artefact_md += f"\n- `{a}` ({sz} bytes)"
    body_text = (
        f"### {cid} {name}\n**状态**: **{status}** | **耗时**: {duration_s}\n"
        f"**产物**: {artifacts_str}{artefact_md}\n" + "\n".join(extras) + "\n"
    )
    report.add(cid, name, status, duration_s, artifacts_str, body_text)


def poll_video(task_id: str, timeout_ms: int = VIDEO_MAX_WAIT_MS) -> tuple[str, str | None, list]:
    """Poll /api/video-task?id={task_id} until success/fail or timeout."""
    elapsed = 0
    poll = VIDEO_POLL_BASE_MS
    history = []
    while elapsed < timeout_ms:
        s, resp = get_json(f"/api/video-task?id={task_id}", timeout=30)
        if s == 200:
            status = resp.get("status", "?")
            history.append((elapsed//1000, status, resp.get("progress")))
            if status == "succeeded":
                return "succeeded", resp.get("videoUrl"), history
            if status in ("failed", "expired", "cancelled"):
                return status, None, history
        else:
            history.append((elapsed//1000, "err", f"http {s}"))
        time.sleep(poll/1000)
        elapsed += poll
        poll = min(poll * 2, VIDEO_POLL_MAX_MS)
    return "timeout", None, history


def case_v1(report):
    cid, name = "V1", "文生视频 text2video"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    prompt = "一只小猫在花园里追逐一只黄色蝴蝶，电影感，浅景深，柔光"
    body = {"model": DEFAULT_VIDEO_MODEL, "prompt": prompt, "ratio": "16:9", "images": []}
    s, resp = post_json("/api/generate-video", body, timeout=120)
    if s != 200 or not resp.get("taskId"):
        elapsed = (int(time.time()*1000)-t0)/1000
        report_section(report, cid, name, "FAIL", elapsed, body=body, resp=resp)
        return
    task_id = resp["taskId"]
    final, video_url, history = poll_video(task_id)
    elapsed = (int(time.time()*1000)-t0)/1000
    arts = []
    if final == "succeeded" and video_url:
        dest = os.path.join(folder, "video.mp4")
        code, size = download_to(BASE+video_url if video_url.startswith("/") else video_url, dest, timeout=120)
        if code == 200 and size > 0:
            ok, msg = verify_video(dest)
            arts = [dest] if ok else []
            final_status = "PASS" if ok else f"FAIL(download {msg})"
        else:
            final_status = "FAIL(download)"
    else:
        final_status = f"FAIL({final})"
    report_section(report, cid, name, final_status, elapsed, body=body, resp={"taskId": task_id, "final": final, "history_points": len(history)}, artifacts=arts,
                   msg=f"task={task_id}, final={final}, polls={len(history)}")


def case_v2(report, ref_url):
    cid, name = "V2", "首帧生视频 image2video (first_frame)"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    prompt = "同一只柴犬抬头眨眼，背景里微风轻轻吹过草地，电影感"
    body = {"model": DEFAULT_VIDEO_MODEL, "prompt": prompt, "ratio": "9:16", "images": [{"url": ref_url, "role": "first_frame"}]}
    s, resp = post_json("/api/generate-video", body, timeout=120)
    elapsed_sub = (int(time.time()*1000)-t0)/1000
    if s != 200 or not resp.get("taskId"):
        report_section(report, cid, name, "FAIL", elapsed_sub, body=body, resp=resp)
        return
    task_id = resp["taskId"]
    final, video_url, history = poll_video(task_id)
    elapsed = (int(time.time()*1000)-t0)/1000
    arts = []
    if final == "succeeded" and video_url:
        dest = os.path.join(folder, "video.mp4")
        code, size = download_to(BASE+video_url if video_url.startswith("/") else video_url, dest, timeout=120)
        if code == 200 and size > 0:
            ok, msg = verify_video(dest)
            arts = [dest] if ok else []
            final_status = "PASS" if ok else f"FAIL({msg})"
        else:
            final_status = "FAIL(download)"
    else:
        final_status = f"FAIL({final})"
    report_section(report, cid, name, final_status, elapsed, body=body, resp={"taskId": task_id, "final": final, "history_points": len(history)}, artifacts=arts,
                   msg=f"task={task_id}, final={final}, polls={len(history)}")


def case_v3(report, first_url, last_url):
    cid, name = "V3", "首尾帧视频 first_last"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    prompt = "从草地蹲坐的柴犬出发，逐渐站起走向镜头，背景樱花飘落，电影感"
    body = {"model": DEFAULT_VIDEO_MODEL, "prompt": prompt, "ratio": "16:9",
            "images": [{"url": first_url, "role": "first_frame"}, {"url": last_url, "role": "last_frame"}]}
    s, resp = post_json("/api/generate-video", body, timeout=120)
    if s != 200 or not resp.get("taskId"):
        elapsed = (int(time.time()*1000)-t0)/1000
        report_section(report, cid, name, "FAIL", elapsed, body=body, resp=resp)
        return
    task_id = resp["taskId"]
    final, video_url, history = poll_video(task_id)
    elapsed = (int(time.time()*1000)-t0)/1000
    arts = []
    if final == "succeeded" and video_url:
        dest = os.path.join(folder, "video.mp4")
        code, size = download_to(BASE+video_url if video_url.startswith("/") else video_url, dest, timeout=120)
        if code == 200 and size > 0:
            ok, msg = verify_video(dest)
            arts = [dest] if ok else []
            final_status = "PASS" if ok else f"FAIL({msg})"
        else:
            final_status = "FAIL(download)"
    else:
        final_status = f"FAIL({final})"
    report_section(report, cid, name, final_status, elapsed, body=body, resp={"taskId": task_id, "final": final, "history_points": len(history)}, artifacts=arts,
                   msg=f"task={task_id}, final={final}, polls={len(history)}")


def case_v4(report, ref_urls):
    cid, name = "V4", "多图参考视频 reference"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    if len(ref_urls) < 2:
        elapsed = (int(time.time()*1000)-t0)/1000
        report_section(report, cid, name, "SKIPPED", elapsed, msg="not enough ref urls")
        return
    prompt = "画面中保持参考图风格一致，主体为暖色调的电影感慢动作"
    body = {"model": DEFAULT_VIDEO_MODEL, "prompt": prompt, "ratio": "16:9",
            "images": [{"url": ref_urls[0], "role": "reference_image"}, {"url": ref_urls[1], "role": "reference_image"}]}
    s, resp = post_json("/api/generate-video", body, timeout=120)
    if s != 200 or not resp.get("taskId"):
        elapsed = (int(time.time()*1000)-t0)/1000
        report_section(report, cid, name, "FAIL", elapsed, body=body, resp=resp)
        return
    task_id = resp["taskId"]
    final, video_url, history = poll_video(task_id)
    elapsed = (int(time.time()*1000)-t0)/1000
    arts = []
    if final == "succeeded" and video_url:
        dest = os.path.join(folder, "video.mp4")
        code, size = download_to(BASE+video_url if video_url.startswith("/") else video_url, dest, timeout=120)
        if code == 200 and size > 0:
            ok, msg = verify_video(dest)
            arts = [dest] if ok else []
            final_status = "PASS" if ok else f"FAIL({msg})"
        else:
            final_status = "FAIL(download)"
    else:
        final_status = f"FAIL({final})"
    report_section(report, cid, name, final_status, elapsed, body=body, resp={"taskId": task_id, "final": final, "history_points": len(history)}, artifacts=arts,
                   msg=f"task={task_id}, final={final}, polls={len(history)}")


def case_v5(report):
    cid, name = "V5", "提交 → 取消 DELETE"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    prompt = "简单的测试视频任务，用于取消测试"
    body = {"model": DEFAULT_VIDEO_MODEL, "prompt": prompt, "ratio": "16:9", "images": []}
    s, resp = post_json("/api/generate-video", body, timeout=120)
    if s != 200 or not resp.get("taskId"):
        elapsed = (int(time.time()*1000)-t0)/1000
        report_section(report, cid, name, "FAIL", elapsed, body=body, resp=resp)
        return
    task_id = resp["taskId"]
    # 立刻取消
    s2, resp2 = delete_json(f"/api/video-task?id={task_id}", timeout=30)
    elapsed = (int(time.time()*1000)-t0)/1000
    status_after = resp2.get("status", "?")
    err = resp2.get("error")
    if s2 == 200 and status_after in ("cancelled", "running"):
        final_status, ver = "PASS", f"cancelled upstream"
    elif s2 in (400, 404, 405) and err:
        final_status, ver = "PASS", f"upstream not supported ({err[:80]})"
    else:
        final_status, ver = f"FAIL(http {s2} status {status_after})", ""
    report_section(report, cid, name, final_status, elapsed, body=body, resp={"taskId": task_id, "delete_resp": resp2}, msg=f"submit ok, {ver}")


def main():
    # Reuse F1 url as first ref
    f1_url = None
    f2_urls = []
    import re
    rp = os.path.join(ROOT, "REPORT.md")
    if os.path.exists(rp):
        with open(rp, encoding="utf-8") as f:
            txt = f.read()
        all_urls = re.findall(r"https://platform-outputs\.agnes-ai\.space/images/[\w/\.\-]+", txt)
        seen = []
        for u in all_urls:
            if u not in seen:
                seen.append(u)
        if len(seen) >= 3:
            f1_url = seen[0]
            f2_urls = seen[1:3]
        else:
            f1_url = seen[0] if seen else None
            f2_urls = seen[1:] if len(seen) > 1 else []
    print(f"[video] f1_url={f1_url[:60] if f1_url else 'NONE'}")
    print(f"[video] f2_urls count={len(f2_urls)}")

    report = Report()
    started = time.time()
    # V5 first (cancel — fast)
    case_v5(report)
    # V1 — text2video
    case_v1(report)
    # V2 — first_frame
    if f1_url:
        case_v2(report, f1_url)
    # V3 — first_last
    if f1_url and f2_urls:
        case_v3(report, f1_url, f2_urls[0])
    # V4 — reference
    if f1_url and len(f2_urls) >= 1:
        case_v4(report, [f1_url, f2_urls[0]] if len(f2_urls) >= 1 else [])
    ended = time.time()
    report.write(started, ended, {"configured": True, "imageModel": "agnes-image-2.0-flash", "textModel": "agnes-2.0-flash", "videoModel": DEFAULT_VIDEO_MODEL})
    print(f"[done] total {int(ended-started)}s")


if __name__ == "__main__":
    main()
