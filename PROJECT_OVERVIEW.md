# 无限画布(wuxianhuabu)项目总览

> 基于 tldraw SDK 改造的本地 AI 图像 / 视频创作工作台 · 一篇搞定上手、用法与排坑

## 一、项目概览

### 1.1 这是什么

`wuxianhuabu`(无限画布)是一个**本地部署、面向创作者的 AI 无限画布**,在 tldraw 无限可平移 / 缩放的画布之上,集成了:

- **文生图**(单张 / 批量,最多 4 张)
- **图编辑**(参考图改写)
- **局部重绘**(画红圈 → inpaint,`LOCAL_ANNOTATION_PROMPT`)
- **多图参考图生图**(双图风格融合、动作迁移)
- **工作流预设**:产品六视图、九宫格灯光探索、反推提示词、动作迁移
- **AI Agent 对话助手**(自动写 prompt → 直接生图)
- **首帧图生视频 / 首尾帧视频 / 多图参考视频**(agnes-video-v2.0)
- **历史图库面板 + IndexedDB 持久化** (刷新页面不丢节点)

所有 AI 调用走 Agnes 平台 OpenAI-compatible 网关,Key 写在本机,不提交仓库。

### 1.2 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React + TypeScript + Vite + tldraw SDK |
| 后端代理 | Vite `configureServer` middleware(`apps/examples/vite.config.ts`)|
| AI 网关 | `https://apihub.agnes-ai.com` (image + video + text) |
| 浏览器存储 | IndexedDB `tap-ai-canvas-agent` / store `states` / key `tap-ai-canvas-state` |
| 包管理 | Yarn 4(corepack,`yarn.lock` 已锁) |

### 1.3 顶层目录速览

```
wuxianhuabu/
├─ apps/
│  └─ examples/                    主站 + AI 画布示例(5420 端口)
│     ├─ src/examples/use-cases/ai-canvas-agent/   画布核心组件
│     ├─ vite.config.ts                            后端代理与所有 /api/* 路由
│     ├─ proxy-server.mjs                          本地静态预览服务(5430)
│     └─ .env.local                                API Key(已 gitignore)
├─ packages/                       tldraw SDK 模块化源码
├─ templates/                      各种空白脚手架
├─ internal/                       仓库内部工具脚本
├─ tests/                          本仓库自带的 19 个测试用例 + 报告
├─ PROJECT_OVERVIEW.md             ← 你正在看的这份文档
└─ README.md / QUICK_START.md / …  其他文档
```

### 1.4 完整能力清单(对应测试用例 ID)

| 用例 ID | 能力 | 入参 | 落地 |
|---|---|---|---|
| F1 | 文生图 单张 | `/api/generate-image` prompt+size | PNG |
| F2 | 文生图 多张 | 同上 count=3 | 3 × PNG |
| F3 | 图生图 多参考 | sourceImageUrls | PNG |
| F4 | 图编辑 单参考 | 单 ref + 改写 prompt | PNG |
| F5 | 局部编辑(inpaint) | 单 ref + `LOCAL_ANNOTATION_PROMPT` + 圈选 | PNG |
| F6 | 工作流:six-view | `size=16:9` + 产品六视图 prompt | PNG |
| F7 | 工作流:lighting-contact-sheet | 9 宫格豪华灯光探索 prompt | PNG |
| F8 | 工作流:motion-transfer | 双图 + 形象 / 动作分离 prompt | PNG |
| F9 | AI Agent 对话 | `/api/agent-chat` messages | PNG + prompt |
| F10 | 反推提示词 | `/api/analyze-image-prompt` | 文本 |
| F11 | 模型列举 | `GET /api/ai-models` | 列表 |
| V1 | 文生视频 text→video | `/api/generate-video` 无图 | MP4 |
| V2 | 首帧 video | images=[{url, role:'first_frame'}] | MP4 |
| V3 | 首尾帧 keyframes | images=[first, last] + mode=keyframes | MP4 |
| V4 | 多图参考 video | images=[ref1, ref2] + mode=keyframes | MP4 |
| V5 | 取消任务 | `DELETE /api/video-task?id=…` | — |
| P1 | IndexedDB 持久化 | 直写 + reload 读回 | — |
| P2 | UI 完整加载 | 浏览器访问 `/ai-canvas-agent/full` | 截图 |
| E2E | 端到端真实用户流程 | 登录→拖图→生成→历史→刷新 | 截图 |

**当前状态**:19 / 19 测试 PASS,见 `tests/REPORT.md`。

---

## 二、如何使用

### 2.1 准备环境

| 工具 | 要求 |
|---|---|
| Node.js | ≥ 20.0(实测 24.7 可用)|
| Yarn | 4.17.0(项目 .yarnrc.yml 已固定)|
| corepack | 0.34+(Node 自带,首次需要 `corepack enable`)|
| macOS / Linux / Windows | 任一,实测 macOS arm64 OK |
| Agnes API Key | 联系 Agnes 平台申请 OpenAI-compatible + Agnes-Video-V2.0 权限 |

### 2.2 三步启动

```bash
# 1) 进入项目目录(假设已经 clone 到本地)
cd /path/to/wuxianhuabu

# 2) 安装依赖(Yarn 4 会自动启用,无需手动 npm/yarn install)
corepack enable
yarn install
# 或者,如果 yarn.lock 已存在,跑 immutable 检查:
yarn install --immutable
```

### 2.3 写入 API Key

项目本身没有把 Key 入仓,你需要新建一份 `apps/examples/.env.local`:

```bash
cat > apps/examples/.env.local <<EOF
IMAGE_API_KEY=sk-你的Agnes密钥
IMAGE_GATEWAY_BASE_URL=https://apihub.agnes-ai.com
EOF
```

> 💡 同一份 Key 同时给 image 和 video 用,vite.config.ts 里共用 `IMAGE_API_KEY`,无需额外 ARK / Vision key。

### 2.4 启动 dev server

#### 方法 A:前台启动(看实时日志,Ctrl+C 停)

```bash
cd apps/examples
yarn dev
# Vite v8 ready → http://localhost:5420/
```

#### 方法 B:后台守护启动(跑测试 / 不被父 shell 影响)

普通 `nohup ... &` 在某些 shell 里仍会被回收,推荐用 Python 双重 fork:

```bash
cat > /tmp/daemonize_vite.py <<'PY'
import os, sys
LOG = "/path/to/wuxianhuabu/dev-server.out.log"
PIDFILE = "/path/to/wuxianhuabu/dev-server.pid"
WORKDIR = "/path/to/wuxianhuabu/apps/examples"
NODE_BIN = "/path/to/wuxianhuabu/node_modules/.bin/vite"
if os.fork() > 0: sys.exit(0)
os.setsid()
if os.fork() > 0: sys.exit(0)
sys.stdin = open("/dev/null")
log = open(LOG, "ab", buffering=0)
os.dup2(log.fileno(), 1); os.dup2(log.fileno(), 2); log.close()
os.chdir(WORKDIR)
with open(PIDFILE, "w") as f: f.write(str(os.getpid()))
os.execvp("/usr/local/bin/node", ["node", NODE_BIN, "--port", "5420", "--host"])
PY

python3 /tmp/daemonize_vite.py
sleep 4
curl -s http://localhost:5420/api/ai-status  # 应该返回 configured:true
```

#### 停止:

```bash
kill $(cat /path/to/wuxianhuabu/dev-server.pid)
```

### 2.5 访问入口

| 地址 | 用途 |
|---|---|
| `http://localhost:5420/` | 首页(侧栏 + 当前示例)|
| `http://localhost:5420/ai-canvas-agent` | 基础 AI 画布路由 |
| `http://localhost:5420/ai-canvas-agent/full` | **完整画布**(推荐,沉浸式)|

> ⚠️ 进入画布前**先在首页注册一个账户**(邮箱 + 密码 ≥ 6 位),所有受 AuthGate 保护的路由都基于 `apps/examples/.local-auth/` 的本地账户。

### 2.6 画布怎么用

1. **接入 API**:首次进入画布会显示"接口未配置"徽章,点击顶部接口状态按钮 → 确认 KEY 已写入 → "接口已连接"变绿。
2. **拖图片**到画布 → 自动产生一个 `image` 节点。
3. **双击空白** → 创建 `prompt` 节点。
4. **从图片节点的右侧连接点拖到 prompt 节点** → 建立连线,prompt 节点会自动用连线输入作为参考图。
5. **在 prompt 节点里写提示词 + 选比例 + 选数量** → 点"生成"。
6. **生成完成后**结果自动作为新 `image` 节点落到画布,加入历史图库。
7. **切换到"标注工具"** → 在图片上画红圈 → 调用 `LOCAL_ANNOTATION_PROMPT` 局部重绘。
8. **左下角 Agent 面板** → 输入中文需求 → 自动写 prompt,选"自动生成图片"会直接出图。
9. **右上角视频工具** → 单图 / 双图 / 多图参考的视频,3 档分辨率、7 种画幅可选。
10. **页面刷新** → IndexedDB 自动恢复所有节点 / 连线 / 历史记录。

### 2.7 跑测试

```bash
cd /path/to/wuxianhuabu/tests

python3 run_all.py     # F1-F11 图片生成,约 3 分钟
python3 video_run.py   # V1-V5 视频,约 10-15 分钟
python3 ui_tests.py    # P1 IndexedDB 持久化
python3 ui_p2.py       # P2 UI smoke
python3 e2e_session.py # 端到端完整用户会话,约 1 分钟
```

报告输出统一到 `tests/REPORT.md`,自动追加、相同用例 ID 自动去重。产物(PNG / MP4 / 截图)落到 `tests/artifacts/{F1..F11,V1..V5,P1,P2,E2E}/`。

### 2.8 /api/* 路由契约

| 路由 | 方法 | 关键字段 |
|---|---|---|
| `/api/ai-status` | GET | `{configured, baseUrl, arkConfigured}` |
| `/api/ai-models` | GET | `{imageModels:[{id,label}], textModels:[...]}` |
| `/api/ai-key` | POST | body `{apiKey, baseUrl?}` |
| `/api/ark-key` | POST | body `{arkApiKey, arkBaseUrl?}`(可选用 video 模型)|
| `/api/generate-image` | POST | `{prompt, model, size, aspectRatio, count, sourceImageUrl?, sourceImageUrls?}` |
| `/api/analyze-image-prompt` | POST | `{imageUrl, imageTitle?, instruction?}` |
| `/api/agent-chat` | POST | `{messages, model?, canvasSummary?, referenceImages?, autoGenerate?}` |
| `/api/generate-video` | POST | `{model, prompt, ratio, images:[{url,role?}]}`,多图须 `mode=keyframes` |
| `/api/video-task?id=…` | GET / DELETE | 轮询状态 / 取消 |
| `/api/video-file/{taskId}.mp4` | GET | 二进制视频 |
| `/api/auth/{session,register,login,logout}` | GET / POST | 本地账户 |

`apps/examples/vite.config.ts` 是这些路由的唯一实现,改坏了所有功能都会挂,改之前看清。

---

## 三、排坑指南:过程中踩到的 8 个坑

### 🪤 坑 1:`nohup vite &` 一退出父 shell 就被杀

**现象**:`dev server` 启动后跑了 5 分钟,父 exec_command 一返回,端口 5420 立刻死。

**根因**:`nohup` 只是忽略 `SIGHUP`,但 `&` 把进程挂在父进程组里,父 shell 退出时整个进程组被回收。

**解决**:用 Python 双重 fork(见 §2.4 方法 B),让进程脱离任何进程组、脱离任何 TTY,等到 `os.execvp` 才挂上 vite 本体。生成的 `dev-server.pid` 和 `dev-server.out.log` 在仓库根。

### 🪤 坑 2:Vite 启动后 Vite.config.ts 改了不生效

**现象**:改了 `apps/examples/vite.config.ts`,Vite 不会自动重载这块(server middleware 文件)。

**根因**:Vite 的 HMR 只覆盖客户端代码,`configureServer()` 注册的中间件属于启动时解析的配置。

**解决**:Vite v8 已经支持 server 重启提醒 — 终端会看到 `[vite] server restarted.`,**重启 dev server 就好**(`kill $(cat dev-server.pid) && python3 /tmp/daemonize_vite.py`)。

### 🪤 坑 3:视频任务返回 `{taskId}` 后,过几小时任务"无视频地址"

**现象**:V1(文生视频)提交拿到 `taskId`,等 5~10 分钟再轮询 `/api/video-task?id=…`,后端返回 502:

```json
{"error":"任务成功但没有返回视频地址。"}
```

**根因**:`apps/examples/vite.config.ts` 里原代码只看了 `data.url` 和 `data['remixed_from_video_id']`,但 Agnes-Video-V2.0 真实响应是:

```json
{"status":"completed","metadata":{"url":"https://.../xxx.mp4"}, ...}
```

URL 藏在 `metadata.url`,原代码找不到就 502。

**修复**(提交 `3e0be6b`):新增 `pickRemoteVideoUrl(data)`,按 22 条候选路径逐个提取,`metadata.url` 是其中之一。修复后 V1 真正拿到 2MB MP4,下载到 `apps/examples/.cache/ai-videos/{taskId}.mp4`,由 `/api/video-file/{taskId}.mp4` 提供给前端。

### 🪤 坑 4:多图视频(V3 / V4)提交直接失败 `OpenAI-compatible API request failed.`

**现象**:V3(首尾帧)、V4(多图参考)提交后 `console.error: Video task creation failed: OpenAI-compatible API request failed.`,且没有任何 taskId 返回。

**根因**:Agnes-Video-V2.0 上游明确要求 **多图时必须传 `mode=keyframes`**。直接 `curl` 探测得到:

```json
{"code":"invalid_request",
 "message":"This request contains multiple images, but mode was omitted. ...",
 "data":{"max_images":1,"param":"image","valid_modes":["keyframes"]}}
```

原代码只设了 `extra_body: { image: [...] }`,漏掉 `mode: 'keyframes'`,被上游拒绝。

**修复**(同一提交):在 `videoImages.length > 1` 分支添加 `videoBody.mode = 'keyframes'`,同时把 `image` 直接放在根(不再用 `extra_body`)。修复后 V3、V4 都跑通。

### 🪤 坑 5:`git push` 时被 GitHub 拒绝"无法创建 workflow"

**现象**:`git push origin main` 失败:

```
! [remote rejected] main -> main (refusing to allow an OAuth App to create or
update workflow `.github/workflows/add-framer-rewrites.yml` without `workflow` scope)
```

**根因**:GitHub 安全策略 — OAuth token 必须有 `workflow` scope 才能 push `.github/workflows/*.yml` 文件。本机 `gh auth` 默认 token scopes 是 `'gist', 'read:org', 'repo'`,缺 `workflow`。

**绕开方法**(项目根目录 push)**:
1. `cp -R .github/workflows /tmp/wuxianhuabu-workflows-backup/`
2. `rm -rf .github/workflows`
3. `git commit --amend`(把 workflows 从这次 commit 里拿掉)
4. `git push --force-with-lease origin main`
5. 把 `/tmp/wuxianhuabu-workflows-backup/workflows` 复制回原位,**作为未追踪文件**(不会出现在 `git status` 待提交列表,除非显式 `git add`)

**真正修复**:在浏览器里跑一次 `gh auth refresh -h github.com -s workflow`,授权完再 `git add .github/workflows && git commit && git push`。

### 🪤 坑 6:VideoURL 的提取逻辑里 `extra_body` 是想当然的选择

**现象**:跟坑 4 强相关,原先的项目代码想"通过 `extra_body` 把多个 image 字段塞进上游 body",但 Agnes-Video-V2.0 根本不支持这个 schema。

**教训**:遇到上游 API 文档不全(Agnes 视频 API 没公开 schema),**先 `curl` 一次探明响应结构**比猜字段名更靠谱。我们就是这么发现 `metadata.url` 和 `mode=keyframes` 的。

### 🪤 坑 7:拖图到画布后,前端控制台报 CORS 错误

**现象**:把 `platform-outputs.agnes-ai.space/images/...png` 拖到画布,渲染出节点;但控制台报:

```
Access to fetch at 'https://platform-outputs.agnes-ai.space/images/...' from origin
'http://localhost:5420' has been blocked by CORS policy
```

**根因**:Agnes CDN 上 `Access-Control-Allow-Origin` 头缺失,导致 `<canvas>.drawImage()` 读取像素被浏览器阻断。

**缓解**:这是上游控制,本仓库 `apps/examples/src/examples/use-cases/ai-canvas-agent/AiCanvasAgentExample.tsx` 的 `loadImageElement()` 已经设了 `image.crossOrigin = 'anonymous'`,并在 `fitImageToTargetCanvas()` 里把 `try` 失败后的 `catch` 直接返回原 `imageUrl`(用 `<img src>` 渲染,不走 canvas pixel 读取)。所以**功能不受影响**,只是控制台一行警告。

**进一步缓解**:在 `apps/examples/vite.config.ts` 里加一个 `/api/image-proxy?url=…` 反代,把 `platform-outputs.agnes-ai.space` 的图通过 dev server 转发同源返回。

### 🪤 坑 8:IndexedDB 的 store / key 名猜错 → 写不进 / 读不到

**现象**:写完一段 Playwright 测试,写 IDB 后 reload,再也读不回来。

**根因**:直觉命名 `db=…, store=canvas, key=state`,但项目实际是:
- DB:`tap-ai-canvas-agent`(v=1)
- Store:`states`(**复数**)
- Key:`tap-ai-canvas-state`(字符串,**不是 `state`**)

读源码 `apps/examples/src/examples/use-cases/ai-canvas-agent/AiCanvasAgentExample.tsx` 第 4508 行附近 `indexedDB.open('tap-ai-canvas-agent', 1)` 和 `db.createObjectStore('states')`,以及第 310 行 `const CANVAS_STORAGE_KEY = 'tap-ai-canvas-state'` 才确认。

**调试方法**:`page.evaluate` 里直接 query 所有 store 名 + 列 keys,别瞎写。

---

## 四、日常开发 / 维护

### 4.1 增加一个新功能?

1. **后端代理** 编辑 `apps/examples/vite.config.ts`,在 `aiStudioApiPlugin()` 里加 `server.middlewares.use('/api/your-route', handler)`。
2. **前端组件** 编辑 `apps/examples/src/examples/use-cases/ai-canvas-agent/AiCanvasAgentExample.tsx` + 同目录的 `ai-canvas-agent.css`。
3. **新测试** 在 `tests/` 加 `cases/your_test.py` 或者扩 `run_all.py` / `video_run.py`。
4. **更新报告** 重跑所有相关脚本,`tests/REPORT.md` 自动追加。

### 4.2 常见动作清单

| 想做的事 | 命令 |
|---|---|
| 重启 dev server | `kill $(cat dev-server.pid) && python3 /tmp/daemonize_vite.py` |
| 看 dev server 日志 | `tail -f dev-server.out.log` |
| 清空画布数据 | `page.evaluate(...)` 删 IDB store,或在控制台执行 `indexedDB.deleteDatabase('tap-ai-canvas-agent')` |
| 看 AI 视频缓存 | `ls apps/examples/.cache/ai-videos/` |
| 清空视频缓存 | `rm apps/examples/.cache/ai-videos/*.mp4` |
| 一键全测 | 见 §2.7 |
| 重生成 REPORT | 任意测试脚本跑完,自动增量重写 `tests/REPORT.md` |

### 4.3 调试 Agnes API 的小技巧

```bash
# 看图片能用哪些模型
curl -s http://localhost:5420/api/ai-models | python3 -m json.tool

# 直接打 upstream 看真实响应(关键排查 upstream 字段变化时用)
curl -s 'https://apihub.agnes-ai.com/v1/videos/task_xxx' \
  -H "Authorization: Bearer $IMAGE_API_KEY" | python3 -m json.tool
```

---

## 五、版本与提交

```
2d4cde6 test(e2e): add end-to-end real-user session test
3e0be6b fix(video): extract metadata.url and add mode=keyframes for multi-image; add tests
f94a841 Initial commit: 无限画布 AI 工作台 (tldraw-based local AI canvas)
```

- **GitHub 仓库**:https://github.com/wangziming1996/wuxianhuabu
- **基于的 tldraw 仓库**:`apps/`、`packages/`、`templates/`、`internal/` 都来自 tldraw monorepo,生产使用请遵守 tldraw 官方许可。

---

## 六、TL;DR(30 秒上手)

```bash
# 1. 配置 API Key(只需要一行)
echo 'IMAGE_API_KEY=sk-xxx\nIMAGE_GATEWAY_BASE_URL=https://apihub.agnes-ai.com' \
  > apps/examples/.env.local

# 2. 起服务
corepack enable && yarn install
cd apps/examples
yarn dev
# → http://localhost:5420/ai-canvas-agent/full
# → 注册账户 → 上传图 → 创建 prompt 节点 → 点生成

# 3. (可选)跑测试
cd ../tests
python3 run_all.py && python3 video_run.py
# 看 tests/REPORT.md
```

🤖 本文档记录的所有修复和脚本,在 **2026-07-13 / Asia/Shanghai** 当天完成,真实测通 19/19 个用例。
