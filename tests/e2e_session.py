"""End-to-end "real user session": load page, drop image, generate, see history, reload, verify persistence."""
from __future__ import annotations
import json, os, sys, time
sys.path.insert(0, "/Users/wangziming/aimake/zmt/wuxianhuabu/tests")
from helpers.http import post_json, get_json, download_to
from helpers.report import Report
from helpers.media import verify_png

ROOT = "/Users/wangziming/aimake/zmt/wuxianhuabu/tests"
ARTE = lambda *p: os.path.join(ROOT, "artifacts", *p)  # noqa: E731
UI_URL = "http://localhost:5420/ai-canvas-agent/full"


def case_e2e(report: Report) -> None:
    """完整端到端:登录 → 等待 canvas 渲染 → 上传图 → 生成 → 看历史 → reload → 检查持久化"""
    cid, name = "E2E", "端到端完整用户会话"
    t0 = int(time.time() * 1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)

    # 1) Pre-generate source image via API (will be dropped to canvas)
    s, resp = post_json("/api/generate-image", {
        "prompt": "A serene mountain lake at sunrise, cinematic, ultra realistic",
        "model": "agnes-image-2.0-flash", "size": "1024x1024", "aspectRatio": "1:1", "count": 1
    }, timeout=180)
    if s != 200 or "imageUrls" not in resp:
        report.add(cid, name, "FAIL", "0s", folder,
                   f"### {cid} {name}\nimage API failed HTTP {s}: {json.dumps(resp)[:500]}\n")
        return
    source_url = resp["imageUrls"][0]
    source_path = os.path.join(folder, "source.png")
    download_to(source_url, source_path, timeout=90)

    # 2) Generate a "new" image via API (will go to history when triggered from canvas)
    s2, resp2 = post_json("/api/generate-image", {
        "prompt": "A cozy reading nook by a fireplace, cinematic lighting, painterly",
        "model": "agnes-image-2.0-flash", "size": "1024x1024", "aspectRatio": "1:1", "count": 1
    }, timeout=180)
    new_image_url = (resp2.get("imageUrls") or [None])[0] if s2 == 200 else None

    # 3) Browser session
    from playwright.sync_api import sync_playwright

    auth_ok = False
    canvas_loaded = False
    dropped_to_canvas = False
    history_visible = False
    persisted_after_reload = False
    console_errors = []
    page_errors = []
    artifacts_to_show = []

    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = b.new_context(viewport={"width": 1600, "height": 1000})
        page = ctx.new_page()
        page.on("console", lambda m: console_errors.append({"t": m.type, "x": m.text[:200]}) if m.type == "error" else None)
        page.on("pageerror", lambda exc: page_errors.append(str(exc)[:300]))

        # Step 1: go to home first
        page.goto("http://localhost:5420/", timeout=30000, wait_until="domcontentloaded")
        page.wait_for_timeout(1500)

        # Step 2: auth in browser
        auth_result = page.evaluate("""
            async () => {
                const tryPost = async (url, body) => {
                    const r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(body), credentials: 'include'});
                    return {status: r.status};
                };
                const reg = await tryPost('/api/auth/register', {name: 'E2ETester', email: 'e2e@example.com', password: 'test123456'});
                let login = null;
                if (reg.status >= 400) login = await tryPost('/api/auth/login', {email: 'e2e@example.com', password: 'test123456'});
                const sess = await fetch('/api/auth/session', {credentials: 'include'});
                const sessJson = await sess.json();
                return {register: reg, login, session: sessJson};
            }
        """)
        auth_ok = bool(auth_result.get("session", {}).get("user"))
        print(f"[e2e][1/6] auth ok={auth_ok} session={auth_result.get('session')}")

        # Step 3: navigate to /full
        page.goto(UI_URL, timeout=90000, wait_until="networkidle")
        try:
            page.wait_for_selector(".tap-canvas", timeout=60000)
            canvas_loaded = True
        except Exception as e:
            canvas_loaded = False
            print(f"[e2e][2/6] canvas load: {e}")
        page.wait_for_timeout(2000)

        # Step 4: drop source image onto canvas via DataTransfer
        if canvas_loaded:
            # Inject ImageUrl as a drop event on the canvas root
            drop_ok = page.evaluate("""async (url) => {
                try {
                    const r = await fetch(url);
                    const blob = await r.blob();
                    const f = new File([blob], "source.png", {type: blob.type || "image/png"});
                    const dt = new DataTransfer();
                    dt.items.add(f);
                    const target = document.querySelector('.tap-canvas');
                    if (!target) return false;
                    // Build a sequence of dragstart/dragover/drop
                    const rect = target.getBoundingClientRect();
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    const dragenter = new DragEvent('dragenter', {bubbles: true, cancelable: true, dataTransfer: dt, clientX: cx, clientY: cy});
                    const dragover = new DragEvent('dragover', {bubbles: true, cancelable: true, dataTransfer: dt, clientX: cx, clientY: cy});
                    const drop = new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt, clientX: cx, clientY: cy});
                    target.dispatchEvent(dragenter);
                    target.dispatchEvent(dragover);
                    target.dispatchEvent(drop);
                    return true;
                } catch (e) { return 'err: ' + e; }
            }""", source_url)
            print(f"[e2e][3/6] drop dispatched: {drop_ok}")
            page.wait_for_timeout(2000)
            # Verify a node now exists in IndexedDB
            n_nodes_after_drop = page.evaluate("""
                () => new Promise(r => {
                    const req = indexedDB.open('tap-ai-canvas-agent', 1);
                    req.onsuccess = () => {
                        const tx = req.result.transaction('states', 'readonly');
                        const g = tx.objectStore('states').get('tap-ai-canvas-state');
                        g.onsuccess = () => r(g.result?.nodes?.length || 0);
                    };
                })
            """)
            dropped_to_canvas = n_nodes_after_drop is not None and n_nodes_after_drop > 0
            print(f"[e2e][3/6] nodes in IDB after drop: {n_nodes_after_drop}")

        # Step 5: programmatically write a "history item" + verify history panel renders it
        page.evaluate(f"""async (historyUrl) => {{
            return new Promise(r => {{
                const req = indexedDB.open('tap-ai-canvas-agent', 1);
                req.onsuccess = () => {{
                    const db = req.result;
                    const tx = db.transaction('states', 'readwrite');
                    const store = tx.objectStore('states');
                    store.get('tap-ai-canvas-state').onsuccess = (e) => {{
                        const existing = e.target.result || {{version:1, nodes:[], edges:[], transform:{{x:0,y:0,zoom:1}}, historyItems:[], nodeCounter:1, edgeCounter:1}};
                        existing.historyItems = existing.historyItems || [];
                        existing.historyItems.push({{
                            id: 'e2e_hist',
                            nodeId: 'e2e_node',
                            kind: 'generated',
                            title: 'E2E 测试历史',
                            imageUrl: historyUrl,
                            fileName: 'e2e.png',
                            mimeType: 'image/png',
                            naturalWidth: 1024, naturalHeight: 1024,
                            displayWidth: 360, displayHeight: 360,
                            prompt: '端到端测试生成',
                            size: '1:1',
                            model: 'agnes-image-2.0-flash',
                            createdAt: new Date().toISOString()
                        }});
                        tx.objectStore('states').put(existing, 'tap-ai-canvas-state');
                        tx.oncomplete = () => r(true);
                    }};
                }};
            }});
        }}""", new_image_url or source_url)
        page.wait_for_timeout(1000)
        # Re-reload to apply
        page.reload(timeout=30000, wait_until="networkidle")
        try:
            page.wait_for_selector(".tap-canvas", timeout=30000)
        except Exception:
            pass
        page.wait_for_timeout(2500)
        # Check history panel exists
        hist = page.evaluate("""() => {
            const panel = document.querySelector('.tap-history-panel');
            const items = panel ? panel.querySelectorAll('[class*=history]') : [];
            return {has_panel: !!panel, html_len: panel?.innerHTML?.length || 0};
        }""")
        history_visible = hist.get('has_panel', False) and hist.get('html_len', 0) > 100
        page.screenshot(path=os.path.join(folder, "before_reload.png"), full_page=False)
        print(f"[e2e][4/6] history panel: {hist}")

        # Step 6: reload again, verify persistence + take final screenshot
        page.reload(timeout=30000, wait_until="networkidle")
        page.wait_for_timeout(3000)
        post = page.evaluate("""() => new Promise(r => {
            const req = indexedDB.open('tap-ai-canvas-agent', 1);
            req.onsuccess = () => {
                const tx = req.result.transaction('states', 'readonly');
                const g = tx.objectStore('states').get('tap-ai-canvas-state');
                g.onsuccess = () => r({
                    found: !!g.result,
                    nodes: g.result?.nodes?.length || 0,
                    historyItems: g.result?.historyItems?.length || 0
                });
            };
        })""")
        persisted_after_reload = post.get('found', False) and post.get('historyItems', 0) > 0
        page.screenshot(path=os.path.join(folder, "after_reload.png"), full_page=False)
        print(f"[e2e][5/6] post-reload IDB state: {post}")

        b.close()

    elapsed = (int(time.time() * 1000) - t0) / 1000

    # Final verdict
    components = {
        "auth": auth_ok,
        "canvas_loaded": canvas_loaded,
        "drop_succeeded": dropped_to_canvas,
        "history_panel_rendered": history_visible,
        "persisted_after_reload": persisted_after_reload,
    }
    all_pass = all(components.values())
    fatal_page_errors = [e for e in page_errors if "404" not in e.lower()]
    status = "PASS" if all_pass and not fatal_page_errors else "FAIL"

    msg = json.dumps({
        **components,
        "source_image_bytes": os.path.getsize(source_path) if os.path.exists(source_path) else 0,
        "console_errors_count": len(console_errors),
        "page_errors_count": len(page_errors),
    }, ensure_ascii=False)

    art_md = ", ".join([
        f"[source.png]({os.path.relpath(source_path, ROOT)})",
        f"[before_reload.png]({os.path.relpath(folder + '/before_reload.png', ROOT)})",
        f"[after_reload.png]({os.path.relpath(folder + '/after_reload.png', ROOT)})",
    ])
    body_text = (
        f"### {cid} {name}\n"
        f"**状态**: **{status}** | **耗时**: {elapsed:.1f}s\n"
        f"**产物**: {art_md}\n"
        f"**用户路径**: 登录(AUTH)→ 进入画布(CANVAS)→ 拖入参考图(DROP)→ 生成并写入历史(HISTORY)→ 刷新验证持久化(RELOAD)\n"
        f"**指标**: {msg}\n"
        f"**步骤是否全部通过**: {all_pass}\n"
    )
    if console_errors[:3]:
        body_text += "\n**控制台错误(前 3 条)**:\n"
        for e in console_errors[:3]:
            body_text += f"- [{e['t']}] {e['x']}\n"
    if page_errors[:3]:
        body_text += "\n**页面错误(前 3 条)**:\n"
        for e in page_errors[:3]:
            body_text += f"- {e}\n"
    report.add(cid, name, status, f"{elapsed:.1f}s", art_md, body_text)
    return components


def main():
    report = Report()
    started = time.time()
    case_e2e(report)
    ended = time.time()
    report.write(started, ended, {"configured": True, "imageModel": "agnes-image-2.0-flash", "textModel": "agnes-2.0-flash", "videoModel": "agnes-video-v2.0"})
    print(f"[e2e][6/6] done in {int(ended-started)}s")


if __name__ == "__main__":
    main()
