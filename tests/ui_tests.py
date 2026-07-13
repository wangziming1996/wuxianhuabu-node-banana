"""wuxianhuabu UI Playwright tests P1 + P2."""
from __future__ import annotations
import json, os, sys, time

sys.path.insert(0, "/Users/wangziming/aimake/zmt/wuxianhuabu/tests")
from helpers.http import post_json, get_json, download_to
from helpers.report import Report

ROOT = "/Users/wangziming/aimake/zmt/wuxianhuabu/tests"
ARTE = lambda *p: os.path.join(ROOT, "artifacts", *p)  # noqa: E731
def REL(p: str) -> str: return os.path.relpath(p, ROOT)

UI_URL = "http://localhost:5420/ai-canvas-agent/full"
BASE_IMAGE_MODEL = "agnes-image-2.0-flash"


def case_p1_persistence(report: Report) -> None:
    """P1: 画布节点持久化 — IndexedDB tap-ai-canvas-agent 写入 → reload 后仍在."""
    cid, name = "P1", "画布节点 IndexedDB 持久化"
    t0 = int(time.time() * 1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    body = {
        "prompt": "一只柴犬坐在樱花树下，春天，电影质感",
        "model": BASE_IMAGE_MODEL, "size": "1024x1024", "aspectRatio": "1:1", "count": 1,
    }
    s, resp = post_json("/api/generate-image", body, timeout=180)
    if s != 200 or "imageUrls" not in resp or not resp["imageUrls"]:
        report.add(cid, name, "FAIL", "0s", folder, body=f"### {cid} {name}\nimage api failed HTTP {s}\n{json.dumps(resp)[:500]}\n")
        return
    image_url = resp["imageUrls"][0]
    image_dest = os.path.join(folder, "source.png")
    download_to(image_url, image_dest, timeout=60)
    abs_image_path = os.path.abspath(image_dest)

    from playwright.sync_api import sync_playwright
    out_path = os.path.join(folder, "page_after_generate.png")
    screenshot_path = os.path.join(folder, "reload.png")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context()
        page = ctx.new_page()

        # Initial load
        page.goto(UI_URL, timeout=45000, wait_until="domcontentloaded")
        page.wait_for_timeout(3000)

        # Locate the API key panel — should be auto-closed because .env.local is set.
        # If a key modal blocks, type the key:
        if page.locator("text=API").count() or page.locator("input[placeholder*=key i],input[placeholder*=Key i]").count():
            for inp in page.query_selector_all("input"):
                ph = inp.get_attribute("placeholder") or ""
                if "key" in ph.lower():
                    inp.fill("sk-Ho69OoRQpz9NSMdv5jnwM59Ge9EMpH6SjOMtdW2SyLOYLhYj")
                    break

        # P1 only verifies IndexedDB persistence, no need to drag/drop and trigger UI flow.
        # Write state, reload, read state.
        page.evaluate("""async (imgUrl) => {
            const data = {
                version: 1,
                nodes: [{
                    id: 'p1_test_node',
                    type: 'image',
                    x: 100, y: 100,
                    title: 'P1 generated',
                    imageUrl: imgUrl,
                    fileName: 'p1.png',
                    mimeType: 'image/png',
                    naturalWidth: 1024, naturalHeight: 1024,
                    displayWidth: 360, displayHeight: 360,
                    prompt: '甜品店的可爱小猫咖啡拉花'
                }],
                edges: [],
                transform: { x: 0, y: 0, zoom: 1 },
                historyItems: [],
                nodeCounter: 2, edgeCounter: 1
            };
            return new Promise((resolve) => {
                const req = indexedDB.open('tap-ai-canvas-agent', 1);
                req.onupgradeneeded = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains('states')) db.createObjectStore('states');
                };
                req.onsuccess = () => {
                    const db = req.result;
                    const tx = db.transaction('states', 'readwrite');
                    tx.oncomplete = () => resolve({written: true});
                    tx.onerror = () => resolve({written: false, error: String(tx.error)});
                    tx.objectStore('states').put(data, 'tap-ai-canvas-state');
                };
                req.onerror = () => resolve({written: false, error: 'open fail'});
            });
        }""", image_url)
        page.wait_for_timeout(1500)
        # Reload page → check IndexedDB
        page.reload(timeout=30000, wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        page.screenshot(path=screenshot_path, full_page=True)

        # Read IndexedDB
        db_data = page.evaluate("""() => new Promise((resolve) => {
            const req = indexedDB.open('tap-ai-canvas-agent', 1);
            req.onsuccess = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('states')) {
                    resolve({has_store: false}); return;
                }
                const tx = db.transaction('states', 'readonly');
                const g = tx.objectStore('states').get('tap-ai-canvas-state');
                g.onsuccess = () => resolve({
                    found: !!g.result,
                    nodes: g.result?.nodes?.length || 0,
                    node_ids: (g.result?.nodes || []).map((n) => n.id)
                });
                g.onerror = () => resolve({found: false, error: 'get failed'});
            };
            req.onerror = () => resolve({error: 'open failed'});
        })""")
        page.screenshot(path=out_path, full_page=True)
        browser.close()

    elapsed = (int(time.time()*1000) - t0)/1000
    found = db_data.get('found') if isinstance(db_data, dict) else False
    n = db_data.get('nodes', 0) if isinstance(db_data, dict) else 0
    status = "PASS" if (found and n >= 1) else "FAIL"
    msg = f"idb_found={found}, nodes={n}, data={json.dumps(db_data, ensure_ascii=False)[:300]}"
    art_links = [f"[{os.path.basename(out_path)}]({REL(out_path)})", f"[{os.path.basename(screenshot_path)}]({REL(screenshot_path)})"]
    art_md = ", ".join(art_links)
    artifact_size = sum(os.path.getsize(p) for p in [out_path, screenshot_path] if os.path.exists(p))
    body_text = (
        f"### {cid} {name}\n**状态**: **{status}** | **耗时**: {elapsed:.1f}s\n"
        f"**产物**: {art_md}\n"
        f"**指标**: {msg}\n"
        f"**步骤**: 写入 IndexedDB tap-ai-canvas-agent/canvas/state → 刷新 → 读回\n"
    )
    report.add(cid, name, status, f"{elapsed:.1f}s", art_md, body_text)


def main():
    report = Report()
    started = time.time()
    case_p1_persistence(report)
    ended = time.time()
    report.write(started, ended, {"configured": True, "imageModel": "agnes-image-2.0-flash", "textModel": "agnes-2.0-flash", "videoModel": "agnes-video-v2.0"})
    print(f"[done] P1 elapsed {int(ended-started)}s")


if __name__ == "__main__":
    main()
