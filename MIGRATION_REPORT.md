# 复刻迁移报告 — Node Banana(像素级 + L2 渠道 + React Flow)

> 本报告汇总把 `wuxianhuabu`(tldraw 基础)改造为 Node Banana 本地复刻的全过程。
> 起点 commit:`8370961` · 终点 commit:`886ac1d` · 历时 ~5 小时 / 6 次提交

---

## 〇、原始目标与最终对标

| 维度 | 起点 wuxianhuabu | 终点 wuxianhuabu-node-banana |
|---|---|---|
| 画布 | tldraw(自由)| **React Flow 节点图** |
| 节点类型 | image/prompt/text/doodle/video | **image/text/character/audio/custom** |
| AI 提供商 | Agnes 单网关 | **多渠道 OpenAI-compatible** UI |
| 项目管理 | 单画布 IndexedDB | **多 Project + 多 Tab 协调** |
| 工作流预设 | 4 个 | **10 个全部复刻** |
| 视觉对齐 | tldraw 配色 | **Node Banana 深色风格 + 节点图配色** |

---

## 一、阶段路线图

| 阶段 | 内容 | 提交 | 用例 | 状态 |
|---|---|---|---|---|
| 0 | 仓库骨架 (注入 wuxianhuabu v3dd7c0b 作为起点)| `8370961` | — | ✅ |
| 1 | React Flow 骨架 + 5 节点 + UI 面板 | `b96c5fb` | NB-01,02 | ✅ |
| 1.5 | 后端端到端 + IDB 持久化 + recordHistory 修复 | `c8d80f5` | NB-03~10 | ✅ |
| 2.1 | 本地图片上传(file input + drag-drop)| `2bdf9fa` | NB-11 | ✅ |
| 2.2 | 斜杠命令插入预设 + 存储/成本 widget + 多项目 | `860dd78` | NB-12,13,14 | ✅ |
| 3 | 持久化 bug 修复 + 预设覆盖 + 多 Tab | `d780df4` | NB-15,16 + NB-06 fix | ✅ |
| 4.1 | 视觉调优 + MiniMap 染色 + task spinner + flash | `886ac1d` | NB-17 | ✅ |

---

## 二、最终测试成绩

**17 / 17 全过**(总耗时 ~5 分钟跑完一次)

```
NB-01 PASS  启动 + 画布加载                    (7s)
NB-02 PASS  添加 5 种节点                      (9s)
NB-03 PASS  Text → Image 连线 + prompt 注入      (9s)
NB-04 PASS  Image 节点生成真实图片                (27s)
NB-05 PASS  生成结果入历史图库面板              (30s)
NB-06 PASS  刷新后画布节点 IDB 持久化            (11s) ← 修复后 100% 留存
NB-07 PASS  Custom 节点选预设(/sixview)并执行    (24s)
NB-08 PASS  AI Agent 中文对话 → 生成图片          (26s)
NB-09 PASS  API Key 面板渲染                    (7s)
NB-10 PASS  视频任务提交链路                     (7s)
NB-11 PASS  本地上传图片                       (8s)
NB-12 PASS  斜杠命令插入预设节点                (8s)
NB-13 PASS  顶栏存储空间 + 成本 widget         (26s)
NB-14 PASS  多项目创建与切换                  (9s)
NB-15 PASS  10 个工作流预设都在 PresetPicker 中  (7s)
NB-16 PASS  多 Tab 协调广播                    (12s)
NB-17 PASS  视觉调优 v2 完整渲染               (30s)
```

---

## 三、本次复刻踩过的坑(及解决方案)

按严重程度排:

### 🔴 严重 — 影响功能正确性

| # | 问题 | 复刻的解决 |
|---|---|---|
| 1 | **死循环**:`useEffect(setNodes) + useEffect(setDirty)` 互相 update | 拆分数据流,canvas store 是 source of truth,project store 只负责 IDB 写入 |
| 2 | **持久化泄漏**(NB-06 显示 3→2 节点)| 移除 `window.__NB_CANVAS` 全局,改用 `() => useCanvasStore.getState()` 直接读 Zustand |
| 3 | **Agnes 视频 URL 隐藏在 metadata 字段** | `pickRemoteVideoUrl()` 22 条候选路径 fallback |
| 4 | **多图视频缺 `mode=keyframes`** | 多图分支加 `videoBody.mode = 'keyframes'` |

### 🟡 中等 — 影响体验

| # | 问题 | 解决 |
|---|---|---|
| 5 | corepack enable 在 mac 上 EACCES 失败 | 用 `@yarnpkg/cli-dist@4.17.0` 装到 `~/.yarn-4-cli/` |
| 6 | IndexDB store 名 `canvas` 猜错,实际是 `states` | 读源码确认 |
| 7 | Agnes CDN CORS 阻止 canvas pixel | `crossOrigin='anonymous'` + try/catch fallback |
| 8 | yarn 4 + project 兼容警告一堆 | 用 yarn 4 warning 不影响功能,接受 |
| 9 | React Flow MiniMap 节点颜色相同 | 给 node.data 加 `kind` 字段,在 MiniMap 用 `nodeColor={n => kindMap[n.data.kind]}` |
| 10 | report.py 路径 hardcode 到老仓库 | 用 `os.path.dirname(...)` 动态算 |

### 🟢 小问题 — 不影响功能

| # | 问题 | 解决 |
|---|---|---|
| 11 | GH OAuth 缺 `workflow` scope,workflows 不能 push | 暂时 `.github/workflows/` 不入仓(本地留存)|
| 12 | Agnes rate limit 偶发 429 | 测试用例容差(放宽单用例 200s 超时)|
| 13 | dev server 自动落到非 5420 端口(被老 vite 占)| 写 daemon 用 `ss` 提取实占端口即可,改 `localhost:542X` 即可 |

---

## 四、复刻对照 Node Banana 真实功能

| 功能 | Node Banana | 本项目 | 差异 |
|---|---|---|---|
| 节点类型 5 种 | ✅ image/text/character/audio/custom | ✅ 完全一致 | API Key 字段名差异 |
| 10 预设 | ✅ | ✅ | 1:1 翻译 prompt |
| AI 模型纳管 | 火山/通义/DeepSeek/OpenAI/Gemini | **L2 抽象**:6 渠道 UI + Agnes 真实跑通 | L3(各家特色模型参数)留作下版 |
| 多 Project + 列表 + 切 | ✅ | ✅ | — |
| 多 Tab 协调 | ✅(BroadcastChannel) | ✅ | — |
| 存储空间探测 | ✅ | ✅(widget) | UI 位置一致(右上)|
| 成本簿记 | ✅ | ✅(widget)| 模型级 usdPerK 简略估算 |
| 斜杠命令 | ✅ | ✅ | 11 个 slug 对齐 |
| Tool approval 流程 | ✅(LLM-driven)| ❌ 留作下版 | — |
| Audio 节点 | ✅(TTS/效果)| ⚠️ UI 占位 | 真接 Agnes 没 audio model |
| Orphan media sweep | ✅ | ❌ | — |
| Recovery snapshot | ✅ | ❌ | IDB 配置已有,自动恢复未实现 |

---

## 五、未来 Roadmap(优先级排序)

### P1 — 必做(让所有 node 都能真工作)

- [ ] **AudioNode 后端** — Agnes 没 audio API,要决定接哪家(Mock / OpenAI TTS / ElevenLabs 替身)
- [ ] **Tool approval** — Agent 返回 `{action, requires_approval}` 时,UI 弹 "是否允许,需要多少 token" 确认面板

### P2 — 体验增强

- [ ] **Orphan media sweep cron** — 每天 IDB 清一次不再被引用的图
- [ ] **Recovery snapshot** — localStorage 备份 + 刷新时优先 ask "恢复上次未保存版本?"
- [ ] **Vitest 单测 + 组件测试** — 1 个 Vue /React 文件 = 1 个 .test.tsx

### P3 — 生产化

- [ ] **GitHub Actions CI** — push 触发 Playwright + Python 跑测试
- [ ] **真正的 L3 多渠道模型** — 实现各家特色 feature(Seedream 多图模式、Z-Image Turbo 负向词支持等)
- [ ] **项目导出 JSON / 从 ZIP 导入** — 大项目分享
- [ ] **Service Worker 离线缓存** — 不联网也能编辑

---

## 六、给下一个开发者的话

### 这个项目还是 wuxianhuabu 吗?

**不是**。它现在是一个独立的 Node Banana 复刻项目,代码与 `wuxianhuabu` 完全分离(`/Users/wangziming/aimake/zmt/wuxianhuabu_Banana/`),共享 dep 但不复用 React 代码。

### 怎么接下去干活

```bash
cd /Users/wangziming/aimake/zmt/wuxianhuabu_Banana   # ← 注意 _Banana 后缀
yarn install
cd apps/examples && yarn dev
# 浏览器: http://localhost:542X/ai-node-canvas/full (X 自动检测)

# 跑测试
cd tests
python3 run_node_banana.py
```

### 关键文件位置

| 我想改什么 | 改哪个文件 |
|---|---|
| 加新节点类型 | `types.ts` 加 union 分支 + `nodes/` 加 `*Node.tsx` + `nodes/index.ts` 注册 |
| 加新预设 | `ai/presets.ts` 加一项 + `modals/PresetPicker.tsx` 自动渲染 |
| 改后端 | 实际跑的还是 `wuxianhuabu` 的 `apps/examples/vite.config.ts` —— 修改它,Vite 会自动重启 |
| 改存储 schema | `utils/idb.ts` 的 `upgrade` + `projectStore.ts` 的 fields |
| 加新斜杠命令 | `utils/slashCommands.ts` 的 `SLUG_TO_PRESET` 映射 |

### 已知限流提示

- Agnes API 当前对单 Key 约 ~10 req/min,密集测试 NB-08 / NB-04 时可能 429
- 解决:每个用例间隔 5s,或在 `ImageNode.handleGenerate` 加 backoff
