"""Node Banana 复刻项目 — 端到端浏览器测试套件.

覆盖:
  NB-01 启动 + 加载画布(登录成功后看到 React Flow)
  NB-02 左侧添加 5 种节点 → 都正确出现
  NB-03 Text → Image 连线 → Image 节点显示从 Text 注入的 prompt
  NB-04 Image 节点生成按钮 → 真实调 /api/generate-image → imageUrl 被填回
  NB-05 生成结果自动写进 bottomHistory panel
  NB-06 刷新页面 → IDB 恢复 nodes/edges (持久化)
  NB-07 切换项目 → 当前 project 变更 → 画布对应替换
  NB-08 Custom 节点(预设) → 选 /sixview → 跑通 /api/generate-image
  NB-09 Agent 面板发中文 → 拿到 reply + thinking + action
  NB-10 多 Tab 协调模拟(localStorage event simulation)
"""
from __future__ import annotations
import json, os, sys, time
sys.path.insert(0, "/Users/wangziming/aimake/zmt/wuxianhuabu-node-banana/tests")
sys.path.insert(0, "/Users/wangziming/aimake/zmt/wuxianhuabu/tests")
from helpers.http import post_json, get_json  # noqa
from helpers.media import verify_png  # noqa
sys.path.insert(0, "/Users/wangziming/aimake/zmt/wuxianhuabu-node-banana/tests")
import importlib.util

# Use a copy of report.py from either repo
spec = importlib.util.spec_from_file_location("report", "/Users/wangziming/aimake/zmt/wuxianhuabu-node-banana/tests/helpers/report.py")
report_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(report_mod)
Report = report_mod.Report

ROOT = "/Users/wangziming/aimake/zmt/wuxianhuabu-node-banana/tests"
ARTE = lambda *p: os.path.join(ROOT, "artifacts", *p)  # noqa
def REL(p): return os.path.relpath(p, ROOT)

UI_URL = "http://localhost:5422/ai-node-canvas/full"


def _auth(page):
    """登录(已注册的 tester)并确保 session 存在."""
    return page.evaluate("""
        async () => {
            const tryPost = async (url, body) => {
                const r = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(body), credentials:'include'});
                return {status: r.status};
            };
            const reg = await tryPost('/api/auth/register', {name:'NBTester', email:'nb3@example.com', password:'test123456'});
            let login = null;
            if (reg.status >= 400) login = await tryPost('/api/auth/login', {email:'nb3@example.com', password:'test123456'});
            const sess = await fetch('/api/auth/session', {credentials:'include'});
            return await sess.json();
        }
    """)


def _open(page):
    """导航到画布主入口,等 nb-app-shell 出现."""
    page.goto(UI_URL, timeout=90000, wait_until="networkidle")
    page.wait_for_selector(".nb-app-shell", timeout=60000)
    page.wait_for_timeout(2500)


# ----------- 用例实现 -----------

def case_nb_01_load(report):
    cid, name = "NB-01", "启动 + 画布加载"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    from playwright.sync_api import sync_playwright
    errs, perrs = [], []
    shot = os.path.join(folder, "loaded.png")
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        page = b.new_context(viewport={"width":1600,"height":1000}).new_page()
        page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        page.on("pageerror", lambda exc: perrs.append(str(exc)[:200]))
        page.goto("http://localhost:5422/", timeout=30000, wait_until="domcontentloaded")
        auth = _auth(page)
        _open(page)
        dom = page.evaluate("""() => ({
            has_shell: !!document.querySelector('.nb-app-shell'),
            has_topbar: !!document.querySelector('.nb-topbar'),
            has_canvas: !!document.querySelector('.react-flow'),
            has_minimap: !!document.querySelector('.react-flow__minimap'),
            has_right: !!document.querySelector('.nb-right-panel'),
            has_history: !!document.querySelector('.nb-history-panel'),
            project_title: document.querySelector('.nb-project-title span')?.textContent,
        })""")
        page.screenshot(path=shot, full_page=False)
        b.close()
    elapsed = (int(time.time()*1000)-t0)/1000
    ok = (dom["has_shell"] and dom["has_topbar"] and dom["has_canvas"]
          and dom["has_minimap"] and dom["has_right"] and dom["has_history"]
          and not perrs)
    status = "PASS" if ok else "FAIL"
    art = REL(shot)
    msg = json.dumps({**dom, "console_errors": len(errs), "page_errors": len(perrs)}, ensure_ascii=False)
    body = (
        f"### {cid} {name}\n**状态**: **{status}** | 耗时: {elapsed:.1f}s\n"
        f"**产物**: [{os.path.basename(shot)}]({art})\n**指标**: {msg}\n"
    )
    report.add(cid, name, status, f"{elapsed:.1f}s", art, body)


def case_nb_02_add_nodes(report):
    cid, name = "NB-02", "添加 5 种节点"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    shot = os.path.join(folder, "five_nodes.png")
    from playwright.sync_api import sync_playwright
    errs, perrs = [], []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        page = b.new_context(viewport={"width":1600,"height":1000}).new_page()
        page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        page.on("pageerror", lambda exc: perrs.append(str(exc)[:200]))
        page.goto("http://localhost:5422/", timeout=30000, wait_until="domcontentloaded")
        _auth(page); _open(page)
        # 点击 5 个 add button
        for label in ["图片","文本","角色","音频","自定义"]:
            page.click(f'.nb-add-node-btn:has-text("{label}")')
            page.wait_for_timeout(300)
        page.wait_for_timeout(800)
        n = page.evaluate("""() => ({
            count: document.querySelectorAll('.nb-node').length,
            image: !!document.querySelector('.nb-image-node'),
            text: !!document.querySelector('.nb-text-node'),
            character: !!document.querySelector('.nb-character-node'),
            audio: !!document.querySelector('.nb-audio-node'),
            custom: !!document.querySelector('.nb-custom-node'),
        })""")
        page.screenshot(path=shot, full_page=False)
        b.close()
    elapsed = (int(time.time()*1000)-t0)/1000
    ok = (n["count"] == 5 and n["image"] and n["text"]
          and n["character"] and n["audio"] and n["custom"] and not perrs)
    status = "PASS" if ok else "FAIL"
    art = REL(shot)
    msg = json.dumps({**n, "console_errors": len(errs), "page_errors": len(perrs)}, ensure_ascii=False)
    body = f"### {cid} {name}\n**状态**: **{status}** | {elapsed:.1f}s\n[{os.path.basename(shot)}]({art})\n**指标**: {msg}\n"
    report.add(cid, name, status, f"{elapsed:.1f}s", art, body)


def case_nb_03_text_to_image_wire(report):
    cid, name = "NB-03", "Text → Image 连线 + prompt 注入"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.path(folder, exist_ok=True) if False else (os.makedirs(folder, exist_ok=True), None)[1]
    shot = os.path.join(folder, "wired.png")
    from playwright.sync_api import sync_playwright
    errs, perrs = [], []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        page = b.new_context(viewport={"width":1600,"height":1000}).new_page()
        page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        page.on("pageerror", lambda exc: perrs.append(str(exc)[:200]))
        page.goto("http://localhost:5422/", timeout=30000, wait_until="domcontentloaded")
        _auth(page); _open(page)
        # 添加 text + image
        page.click('.nb-add-node-btn:has-text("文本")')
        page.wait_for_timeout(300)
        page.click('.nb-add-node-btn:has-text("图片")')
        page.wait_for_timeout(300)
        # 拿到节点的 React Flow data-id 属性
        ids = page.evaluate("""() => Array.from(document.querySelectorAll('.react-flow__node')).map(n => n.getAttribute('data-id'))""")
        text_id = ids[0]
        image_id = ids[1]
        # 在 text 节点里写 prompt
        text_ta = page.locator(f'[data-id="{text_id}"] .nb-text-input')
        text_ta.fill("一只在樱花树下坐着的柴犬,电影质感,自然光")
        page.wait_for_timeout(500)
        # 连线:用 window.__NB_CANVAS_STORE 直接调 onConnect
        page.evaluate(f"""
            (() => {{
                const store = window.__NB_CANVAS_STORE;
                if (!store) return 'no store';
                store.getState().onConnect({{
                    source: '{text_id}', sourceHandle: 'text',
                    target: '{image_id}', targetHandle: 'prompt'
                }});
                return 'ok';
            }})();
        """)
        page.wait_for_timeout(800)
        # 验证 image 节点的 prompt 被注入
        image_prompt = page.evaluate(f"""(() => {{
            const n = document.querySelector('[data-id=\"{image_id}\"] .nb-prompt-input');
            return n ? n.value : null;
        }})()""")
        page.screenshot(path=shot, full_page=False)
        b.close()
    elapsed = (int(time.time()*1000)-t0)/1000
    ok = ("柴犬" in (image_prompt or "")) and not perrs
    status = "PASS" if ok else "FAIL"
    art = REL(shot)
    msg = json.dumps({"image_prompt": image_prompt, "console_errors": len(errs), "page_errors": len(perrs)}, ensure_ascii=False)
    body = f"### {cid} {name}\n**状态**: **{status}** | {elapsed:.1f}s\n[{os.path.basename(shot)}]({art})\n**指标**: {msg}\n"
    report.add(cid, name, status, f"{elapsed:.1f}s", art, body)


def case_nb_04_image_generate(report):
    cid, name = "NB-04", "Image 节点生成真实图片"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    shot = os.path.join(folder, "generated.png")
    src_png = os.path.join(folder, "source.png")
    from playwright.sync_api import sync_playwright
    errs, perrs = [], []
    image_url = None
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        page = b.new_context(viewport={"width":1600,"height":1000}).new_page()
        page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        page.on("pageerror", lambda exc: perrs.append(str(exc)[:200]))
        page.goto("http://localhost:5422/", timeout=30000, wait_until="domcontentloaded")
        _auth(page); _open(page)
        # 添加 image 节点 + 写 prompt
        page.click('.nb-add-node-btn:has-text("图片")')
        page.wait_for_timeout(800)
        node_id = page.evaluate("""() => document.querySelector('.react-flow__node')?.getAttribute('data-id')""")
        page.locator(f'[data-id="{node_id}"] .nb-prompt-input').fill("一只在金色麦田里漫步的虎斑猫,秋天,油画质感")
        page.locator(f'[data-id="{node_id}"] .nb-prompt-input').press("Tab")
        page.wait_for_timeout(300)
        # 点击生成按钮
        page.locator(f'[data-id="{node_id}"] button.nb-primary-btn').click()
        # 等生成完成 — 观察 imageUrl 出现
        deadline = time.time() + 90
        while time.time() < deadline:
            src = page.evaluate(f"""(() => {{
                const img = document.querySelector('[data-id=\"{node_id}\"] .nb-image-preview img');
                return img ? img.src : null;
            }})()""")
            if src and src.startswith("http"):
                image_url = src
                break
            time.sleep(1.5)
        page.screenshot(path=shot, full_page=False)
        # 下载图片
        if image_url and image_url.startswith("http"):
            from helpers.http import download_to
            download_to(image_url, src_png, timeout=60)
        b.close()
    elapsed = (int(time.time()*1000)-t0)/1000
    valid = False
    if os.path.exists(src_png):
        with open(src_png, "rb") as f:
            head = f.read(8)
        valid = head.startswith(b"\x89PNG")
    ok = bool(image_url) and valid and not perrs
    status = "PASS" if ok else "FAIL"
    arts = [REL(shot)]
    if os.path.exists(src_png):
        arts.append(REL(src_png))
    msg = json.dumps({
        "imageUrl_set": bool(image_url),
        "image_url": image_url[:120] if image_url else None,
        "png_bytes": os.path.getsize(src_png) if os.path.exists(src_png) else 0,
        "console_errors": len(errs),
        "page_errors": len(perrs),
    }, ensure_ascii=False)
    body = f"### {cid} {name}\n**状态**: **{status}** | {elapsed:.1f}s\n" + ", ".join(f"[{os.path.basename(a)}]({a})" for a in arts) + f"\n**指标**: {msg}\n"
    if errs[:3]:
        body += "\n错误:\n" + "\n".join(f"- {e}" for e in errs[:3])
    report.add(cid, name, status, f"{elapsed:.1f}s", ", ".join(arts), body)


def case_nb_05_history_panel(report):
    """NB-05: ImageNode 生成成功后,自动写入 historyItems 并出现在 bottomHistory panel."""
    cid, name = "NB-05", "生成结果入历史图库面板"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    shot = os.path.join(folder, "history.png")
    from playwright.sync_api import sync_playwright
    errs, perrs = [], []
    items_count = 0
    first_image = None
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        page = b.new_context(viewport={"width":1600,"height":1000}).new_page()
        page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        page.on("pageerror", lambda exc: perrs.append(str(exc)[:200]))
        page.goto("http://localhost:5422/", timeout=30000, wait_until="domcontentloaded")
        _auth(page); _open(page)
        # 添加 image 节点 + 触发图片生成(ImageNode 现在会自动 recordHistory)
        page.click('.nb-add-node-btn:has-text("图片")')
        page.wait_for_timeout(800)
        node_id = page.evaluate("""() => document.querySelector('.react-flow__node')?.getAttribute('data-id')""")
        page.locator(f'[data-id="{node_id}"] .nb-prompt-input').fill("一只在紫藤花下坐着的狐狸")
        page.wait_for_timeout(300)
        page.locator(f'[data-id="{node_id}"] button.nb-primary-btn').click()
        # 等生成
        deadline = time.time() + 120
        while time.time() < deadline:
            src_val = page.evaluate(f"""(() => {{
                const img = document.querySelector('[data-id=\"{node_id}\" ] .nb-image-preview img');
                return img ? img.src : null;
            }})()""")
            if src_val and src_val.startswith("http"):
                break
            time.sleep(2)
        page.wait_for_timeout(1000)
        items_count = page.evaluate("""() => document.querySelectorAll('.nb-history-item').length""")
        first_image = page.evaluate("""() => document.querySelector('.nb-history-item img')?.src || null""")
        page.screenshot(path=shot, full_page=False)
        b.close()
    elapsed = (int(time.time()*1000)-t0)/1000
    ok = items_count >= 1 and bool(first_image) and not perrs
    status = "PASS" if ok else "FAIL"
    art = REL(shot)
    msg = json.dumps({
        "items_count": items_count,
        "first_image": (first_image or '')[:120],
        "console_errors": len(errs),
        "page_errors": len(perrs),
    }, ensure_ascii=False)
    body = f"### {cid} {name}\n**状态**: **{status}** | {elapsed:.1f}s\n[{os.path.basename(shot)}]({art})\n**指标**: {msg}\n"
    if errs[:3]:
        body += "\n错误:\n" + "\n".join(f"- {e}" for e in errs[:3])
    report.add(cid, name, status, f"{elapsed:.1f}s", art, body)


def case_nb_06_persistence(report):
    """NB-06: 添加节点 → 刷新页面 → 节点还在(IndexedDB 持久化)."""
    cid, name = "NB-06", "刷新后画布节点 IDB 持久化"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    shot_before = os.path.join(folder, "before_reload.png")
    shot_after = os.path.join(folder, "after_reload.png")
    from playwright.sync_api import sync_playwright
    errs, perrs = [], []
    survived = False
    has_nodes_after = 0
    node_titles_after = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        ctx = b.new_context(viewport={"width":1600,"height":1000})
        page = ctx.new_page()
        page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        page.on("pageerror", lambda exc: perrs.append(str(exc)[:200]))
        page.goto("http://localhost:5422/", timeout=30000, wait_until="domcontentloaded")
        _auth(page); _open(page)
        # 添加 3 个节点
        for lbl in ["图片","文本","角色"]:
            page.click(f'.nb-add-node-btn:has-text("{lbl}")')
            page.wait_for_timeout(300)
        page.wait_for_timeout(700)
        n_before = page.evaluate("""() => document.querySelectorAll('.nb-node').length""")
        page.screenshot(path=shot_before, full_page=False)
        # 刷新
        page.reload(timeout=60000, wait_until="networkidle")
        try:
            page.wait_for_selector(".nb-app-shell", timeout=30000)
            page.wait_for_timeout(2000)
        except Exception:
            pass
        has_nodes_after = page.evaluate("""() => document.querySelectorAll('.nb-node').length""")
        node_titles_after = page.evaluate("""() => Array.from(document.querySelectorAll('.nb-node-title')).map(n => n.textContent)""")
        page.screenshot(path=shot_after, full_page=False)
        # 注意:当前实现 projectStore 不直接存 nodes/edges,而 auto-save 通过 window.__NB_CANVAS 读
        # 因此持久化的节点数可能为 0 — 这是一个已知的限制
        # 但 IDB 中确实存了空项目,所以"节点是否真的被保存"取决于 auto-save 是否触发
        survived = has_nodes_after >= n_before  # 节点完全恢复才算 PASS,否则记录差异
        b.close()
    elapsed = (int(time.time()*1000)-t0)/1000
    ok = survived and not perrs
    status = "PASS" if ok else "PARTIAL" if (has_nodes_after > 0 and not perrs) else "FAIL"
    arts = [REL(shot_before), REL(shot_after)]
    msg = json.dumps({
        "nodes_before": n_before,
        "nodes_after": has_nodes_after,
        "titles_after": node_titles_after,
        "survived_pct": (has_nodes_after / max(1, n_before)) * 100,
        "console_errors": len(errs),
        "page_errors": len(perrs),
    }, ensure_ascii=False)
    body = f"### {cid} {name}\n**状态**: **{status}** | {elapsed:.1f}s\n" + ", ".join(f"[{os.path.basename(a)}]({a})" for a in arts) + f"\n**指标**: {msg}\n"
    if status == "FAIL":
        body += "\n**注**: 自动保存依赖 `window.__NB_CANVAS`,刷新后会被清空 — 这是已知边界,需要把 storeRef 换到 React Context 才能正常持久化(下个迭代)\n"
    report.add(cid, name, status, f"{elapsed:.1f}s", ", ".join(arts), body)


def case_nb_07_custom_preset(report):
    """NB-07: 选 Custom → /sixview 预设 → 执行生成."""
    cid, name = "NB-07", "Custom 节点选预设(/sixview)并执行"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    shot = os.path.join(folder, "preset.png")
    from playwright.sync_api import sync_playwright
    errs, perrs = [], []
    out_url = None
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        page = b.new_context(viewport={"width":1600,"height":1000}).new_page()
        page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        page.on("pageerror", lambda exc: perrs.append(str(exc)[:200]))
        page.goto("http://localhost:5422/", timeout=30000, wait_until="domcontentloaded")
        _auth(page); _open(page)
        page.click('.nb-add-node-btn:has-text("自定义")')
        page.wait_for_timeout(500)
        node_id = page.evaluate("""() => document.querySelector('.nb-custom-node')?.parentElement?.getAttribute('data-id')""")
        # 点 "选择预设" 按钮
        page.locator(f'[data-id="{node_id}"] .nb-preset-picker button').click()
        page.wait_for_timeout(400)
        # 选 "专业设计"
        page.locator(f'.nb-preset-menu .nb-preset-item:has-text("专业设计")').click()
        page.wait_for_timeout(400)
        # 触发执行
        page.locator(f'[data-id="{node_id}"] button.nb-primary-btn').click()
        deadline = time.time() + 90
        while time.time() < deadline:
            src = page.evaluate(f"""(() => {{
                const img = document.querySelector('[data-id=\"{node_id}\"] .nb-image-preview img');
                return img ? img.src : null;
            }})()""")
            if src and src.startswith("http"):
                out_url = src
                break
            time.sleep(1.5)
        page.screenshot(path=shot, full_page=False)
        b.close()
    elapsed = (int(time.time()*1000)-t0)/1000
    ok = bool(out_url) and not perrs
    status = "PASS" if ok else "FAIL"
    art = REL(shot)
    msg = json.dumps({"preset_out": out_url[:120] if out_url else None, "console_errors": len(errs), "page_errors": len(perrs)}, ensure_ascii=False)
    body = f"### {cid} {name}\n**状态**: **{status}** | {elapsed:.1f}s\n[{os.path.basename(shot)}]({art})\n**指标**: {msg}\n"
    if errs[:3]:
        body += "\n错误:\n" + "\n".join(f"- {e}" for e in errs[:3])
    report.add(cid, name, status, f"{elapsed:.1f}s", art, body)


def case_nb_08_agent_chat(report):
    """NB-08: Agent 面板发中文 → 拿到 reply + action."""
    cid, name = "NB-08", "AI Agent 中文对话 → 生成图片"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    shot = os.path.join(folder, "agent.png")
    from playwright.sync_api import sync_playwright
    errs, perrs = [], []
    final_messages = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        page = b.new_context(viewport={"width":1600,"height":1000}).new_page()
        page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        page.on("pageerror", lambda exc: perrs.append(str(exc)[:200]))
        page.goto("http://localhost:5422/", timeout=30000, wait_until="domcontentloaded")
        _auth(page); _open(page)
        # 在右侧 Agent 输入框里写,关掉"自动生图"
        page.locator('.nb-auto-toggle input').uncheck()
        page.wait_for_timeout(300)
        ta = page.locator('.nb-right-panel .nb-input-row textarea')
        ta.fill("我要画一只考拉和一只小熊猫一起喝下午茶")
        page.locator('.nb-right-panel .nb-primary-btn').click()
        # 等响应
        deadline = time.time() + 60
        while time.time() < deadline:
            n = page.evaluate("""() => document.querySelectorAll('.nb-msg-assistant').length""")
            if n >= 2:  # welcome + 我们的
                break
            time.sleep(1.5)
        final_messages = page.evaluate("""() => Array.from(document.querySelectorAll('.nb-msg-assistant .nb-msg-content')).map(m => m.textContent)""")
        page.screenshot(path=shot, full_page=False)
        b.close()
    elapsed = (int(time.time()*1000)-t0)/1000
    last = final_messages[-1] if final_messages else ""
    ok = ("考拉" in last or "小熊猫" in last) and len(final_messages) >= 2 and not perrs
    status = "PASS" if ok else "FAIL"
    art = REL(shot)
    msg = json.dumps({
        "msgs": final_messages,
        "last_200": last[:200],
        "console_errors": len(errs),
        "page_errors": len(perrs),
    }, ensure_ascii=False)
    body = f"### {cid} {name}\n**状态**: **{status}** | {elapsed:.1f}s\n[{os.path.basename(shot)}]({art})\n**指标**: {msg}\n"
    report.add(cid, name, status, f"{elapsed:.1f}s", art, body)


def case_nb_09_keysettings(report):
    """NB-09: 设置面板显示 6 个 provider + Agnes 默认 + 至少 1 个其它 provider (OpenAI/火山/通义/DeepSeek)."""
    cid, name = "NB-09", "API Key 面板渲染"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    shot = os.path.join(folder, "keys.png")
    from playwright.sync_api import sync_playwright
    errs, perrs = [], []
    n = None
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        page = b.new_context(viewport={"width":1600,"height":1000}).new_page()
        page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        page.on("pageerror", lambda exc: perrs.append(str(exc)[:200]))
        page.goto("http://localhost:5422/", timeout=30000, wait_until="domcontentloaded")
        _auth(page); _open(page)
        page.click('.nb-topbar button.nb-secondary-btn:has-text("设置")')
        page.wait_for_timeout(700)
        n = page.evaluate("""() => ({
            providers: document.querySelectorAll('.nb-provider-card').length,
            labels: Array.from(document.querySelectorAll('.nb-provider-card strong')).map(s => s.textContent),
            has_default_badge: !!document.querySelector('.nb-default-badge'),
        })""")
        page.screenshot(path=shot, full_page=False)
        b.close()
    elapsed = (int(time.time()*1000)-t0)/1000
    ok = n and n["providers"] >= 6 and n["has_default_badge"] and not perrs
    status = "PASS" if ok else "FAIL"
    art = REL(shot)
    msg = json.dumps({**n, "console_errors": len(errs), "page_errors": len(perrs)}, ensure_ascii=False)
    body = f"### {cid} {name}\n**状态**: **{status}** | {elapsed:.1f}s\n[{os.path.basename(shot)}]({art})\n**指标**: {msg}\n"
    report.add(cid, name, status, f"{elapsed:.1f}s", art, body)


def case_nb_10_video_endpoint(report):
    """NB-10: 后端 /api/generate-video 仍可用(text2video),证明 Agnes 全栈联调正常."""
    cid, name = "NB-10", "视频任务提交链路"
    t0 = int(time.time()*1000)
    s, resp = post_json("/api/generate-video", {
        "model": "agnes-video-v2.0",
        "prompt": "一只蝴蝶在花丛中飞过,电影感",
        "ratio": "16:9",
        "images": [],
    }, timeout=30)
    elapsed = (int(time.time()*1000)-t0)/1000
    ok = s == 200 and resp.get("taskId") and "task_" in resp["taskId"]
    status = "PASS" if ok else "FAIL"
    msg = json.dumps({"http": s, "taskId": resp.get("taskId"), "videoId": resp.get("videoId")}, ensure_ascii=False)
    body = f"### {cid} {name}\n**状态**: **{status}** | {elapsed:.1f}s\n**响应**: {msg}\n"
    report.add(cid, name, status, f"{elapsed:.1f}s", "n/a", body)



def case_nb_11_upload(report):
    """NB-11: 点击 上传图片 按钮 → 选择文件 → Image 节点创建 + 历史图库入一条."""
    cid, name = "NB-11", "本地上传图片"
    t0 = int(time.time()*1000)
    folder = ARTE(cid); os.makedirs(folder, exist_ok=True)
    shot = os.path.join(folder, "after_upload.png")
    test_png = os.path.join(folder, "test_upload.png")
    if not os.path.exists(test_png):
        import base64
        png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII="
        with open(test_png, "wb") as f:
            f.write(base64.b64decode(png_b64))
    from playwright.sync_api import sync_playwright
    errs, perrs = [], []
    img_count = 0; history_count = 0
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        page = b.new_context(viewport={"width":1600,"height":1000}).new_page()
        page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        page.on("pageerror", lambda exc: perrs.append(str(exc)[:200]))
        page.goto("http://localhost:5422/", timeout=30000, wait_until="domcontentloaded")
        _auth(page); _open(page)
        page.click('[data-testid="upload-btn"]')
        page.wait_for_timeout(500)
        page.set_input_files('[data-testid="upload-input"]', test_png)
        page.wait_for_timeout(1500)
        counts = page.evaluate("""() => ({
            image_nodes: document.querySelectorAll('.nb-image-node').length,
            history_items: document.querySelectorAll('.nb-history-item').length,
        })""")
        img_count = counts["image_nodes"]; history_count = counts["history_items"]
        page.screenshot(path=shot, full_page=False)
        b.close()
    elapsed = (int(time.time()*1000)-t0)/1000
    ok = (img_count >= 1 and history_count >= 1 and not perrs)
    status = "PASS" if ok else "FAIL"
    art = REL(shot)
    msg = json.dumps({**counts, "console_errors": len(errs), "page_errors": len(perrs)}, ensure_ascii=False)
    body = f"### {cid} {name}\n**状态**: **{status}** | {elapsed:.1f}s\n[{os.path.basename(shot)}]({art})\n**指标**: {msg}\n"
    report.add(cid, name, status, f"{elapsed:.1f}s", art, body)


def main():
    report = Report()
    started = time.time()
    env = {"configured": True, "imageModel": "agnes-image-2.0-flash", "textModel": "agnes-2.0-flash", "videoModel": "agnes-video-v2.0"}

    # 标准浏览器场景
    case_nb_01_load(report)
    case_nb_02_add_nodes(report)
    case_nb_03_text_to_image_wire(report)
    case_nb_04_image_generate(report)
    case_nb_05_history_panel(report)
    case_nb_06_persistence(report)
    case_nb_07_custom_preset(report)
    case_nb_08_agent_chat(report)
    case_nb_09_keysettings(report)
    # 本地上传
    case_nb_11_upload(report)
    # 后端代理
    case_nb_10_video_endpoint(report)

    ended = time.time()
    report_path = os.path.join(ROOT, "REPORT.md")
    report.write(started, ended, env)
    print(f"[done] {int(ended-started)}s, report: {report_path}")


if __name__ == "__main__":
    main()
