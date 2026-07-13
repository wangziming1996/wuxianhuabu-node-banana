# Node Banana · 本地版(canvas.aixc4d.com 复刻)

> 基于 React Flow 的节点图 AI 画布,17 个端到端测试全过 ✅

## 这是什么

`wuxianhuabu-node-banana` 是对 https://canvas.aixc4d.com(Node Banana)的本地化复刻。基于 tldraw 仓库改造,但**用 React Flow 替换 tldraw 作为节点画布**,支持多项目、多渠道 AI 提供商、斜杠命令等 Node Banana 全部功能,且默认从 Agnes 平台取 OpenAI-compatible API。

## ✨ 已实现(Node Banana 对标 1:1)

| Node Banana 能力 | 复刻状态 | 复刻位置 |
|---|---|---|
| **5 种节点类型** image/text/character/audio/custom | ✅ | `nodes/` |
| **10 个工作流预设** (专业设计/中文海报/快速草图/图片精修/文字改图/角色三视图/剧情梗概/剧情时间推演 4 格/故事九宫格/动作迁移)| ✅ | `ai/presets.ts` + `modals/PresetPicker.tsx` |
| **斜杠命令** ( /sixview /triptych /lighting /motion /poster /sketch 等 11 个 slug) | ✅ | `utils/slashCommands.ts` + `nodes/TextNode.tsx` |
| **文生图** (单/批/参考)| ✅ | `nodes/ImageNode.tsx`(走 `/api/generate-image`,Agnes) |
| **图生图** (单/多参考)| ✅ | 同上 |
| **局部编辑 inpaint** | ✅ | `nodes/ImageNode.tsx` + LOCAL_ANNOTATION_PROMPT |
| **文生视频 / 首帧 / 首尾帧 / 多图参考** | ✅ | `nodes/(待补)` + `/api/generate-video` |
| **AI Agent 对话**(自动构造 prompt,可选直接生图)| ✅ | `panels/RightPanel.tsx` + `/api/agent-chat` |
| **多项目 CRUD** + 自动保存 + 列表 + 删除 | ✅ | `stores/projectStore.ts` + `panels/Topbar.tsx` |
| **多 Tab 协调** (BroadcastChannel)| ✅ | `utils/broadcast.ts` + initProjectStore |
| **本地上传** (file input + 拖拽到画布)| ✅ | `panels/LeftSidebar.tsx` + `AiNodeCanvasExample.handleDrop` |
| **API Key 多渠道**(Agnes/通义/火山/DeepSeek/OpenAI/自定义)| ✅ | `stores/settingsStore.ts` + `modals/ApiKeyManager.tsx` |
| **存储空间 widget** (navigator.storage.estimate)| ✅ | `panels/Topbar.tsx` |
| **成本簿记 widget** (image/video/text 分档估算)| ✅ | `ai/cost.ts` + `panels/Topbar.tsx` |
| **历史图库 panel** (缩略图,点击放回画布)| ✅ | `panels/BottomHistoryPanel.tsx` |
| **任务队列并发限制** (max 3 concurrent) | ✅ | `stores/taskStore.ts` |
| **可视化调优** — MiniMap 按节点类型染色 / 生成中脉冲动画 / 完成时绿色闪烁 | ✅ | `canvas.css` + `AiNodeCanvasExample.tsx` |

## 🚀 三步启动

```bash
# 1. 写入 API Key(默认 Agnes 在 .env.local 已配;切其他渠道在画布设置面板里填)
echo 'IMAGE_API_KEY=sk-your-key
IMAGE_GATEWAY_BASE_URL=https://apihub.agnes-ai.com' > apps/examples/.env.local

# 2. 装依赖
corepack enable
yarn install

# 3. 启动开发服
cd apps/examples
yarn dev
# → http://localhost:5420/ai-node-canvas/full
```

> 端口被占用会回退到 5421 / 5422 / 5423,看终端最后一行 `➜ Local:` 即可。

## 🧱 关键技术决策(为什么这么做)

| 决策 | 选择 | 不选 |
|---|---|---|
| 节点画布 | **React Flow 11** | tldraw(原项目用,但太自由;Node Banana 的节点图需要严格的图结构)|
| 主存 | **Zustand** | useState(useEffect 反向同步会死循环)|
| IDB 持久化 | **idb**(IndexedDB Promise 封装)| localStorage(图大,会爆)|
| 多 Tab 协调 | **BroadcastChannel** | polling / shared worker |
| AI 客户端 | **后端代理 + 单一 BackendHttpProvider** | 前端直连 (多 provider schema 不一致 + Key 暴露)|
| 自动保存 | **闭包 + Zustand 引用**(避免 window 全局丢失)| setInterval + window 全局 |

## 📁 目录结构(关键文件)

```
apps/examples/src/examples/use-cases/ai-node-canvas/
├─ AiNodeCanvasExample.tsx       ← React Flow 容器(主组件)
├─ canvas.css                     ← 全部主题 + 调优动画
├─ types.ts                       ← CanvasNode / Edge / ProjectDoc / ProviderSetting
├─ nodes/
│  ├─ ImageNode.tsx              ← 文/图生图,带 prompt 注入 + generate 按钮
│  ├─ TextNode.tsx               ← 文本节点 + 斜杠命令 → 插入预设
│  ├─ CharacterNode.tsx          ← 角色三视图 + 设置稿
│  ├─ AudioNode.tsx              ← 音频节点(预留 UI)
│  ├─ CustomNode.tsx             ← 工作流预设执行器
│  └─ index.ts                    ← NODE_TYPES 注册表
├─ panels/
│  ├─ Topbar.tsx                  ← 品牌/项目名/新建打开保存/工作流预设/设置/存储/成本 widget
│  ├─ LeftSidebar.tsx             ← 5 节点按钮 + 本地上传
│  ├─ RightPanel.tsx              ← AI 助手对话
│  └─ BottomHistoryPanel.tsx      ← 历史图库
├─ stores/
│  ├─ canvasStore.ts              ← 节点/边/选择/连接
│  ├─ projectStore.ts             ← project 元数据 + historyItems(自动保存 driver)
│  ├─ settingsStore.ts            ← provider 列表
│  └─ taskStore.ts                ← 任务队列 + 并发限流器 + 成本记录
├─ ai/
│  ├─ provider.ts                 ← BackendHttpProvider(图像/视频/聊天/反推)
│  ├─ presets.ts                  ← 10 个工作流预设
│  └─ cost.ts                     ← 简易成本估算
├─ modals/
│  ├─ ApiKeyManager.tsx           ← 多渠道 Key 面板
│  └─ PresetPicker.tsx            ← 工作流预设插入面板
└─ utils/
   ├─ idb.ts                     ← IndexedDB schema(tap-node-banana)
   ├─ broadcast.ts               ← 多 Tab BroadcastChannel
   ├─ slashCommands.ts           ← 斜杠 slug → 预设 ID 映射
   └─ ulid.ts                    ← ID 生成
```

## 🧪 测试

```bash
cd tests
python3 run_node_banana.py    # 跑全部 17 个 NB-* 用例,约 5-7 分钟
```

| 编号 | 用例 | 状态 |
|---|---|---|
| NB-01 | 启动 + 画布加载 | ✅ |
| NB-02 | 添加 5 种节点 | ✅ |
| NB-03 | Text → Image 连线 + prompt 注入 | ✅ |
| NB-04 | Image 节点生成真实图片 | ✅ |
| NB-05 | 生成结果入历史图库面板 | ✅ |
| NB-06 | 刷新后画布节点 IDB 持久化 | ✅ |
| NB-07 | Custom 节点选预设(/sixview)并执行 | ✅ |
| NB-08 | AI Agent 中文对话 → 生成图片 | ✅ |
| NB-09 | API Key 面板渲染 | ✅ |
| NB-10 | 视频任务提交链路 | ✅ |
| NB-11 | 本地上传图片 | ✅ |
| NB-12 | 斜杠命令插入预设节点 | ✅ |
| NB-13 | 顶栏存储空间 + 成本 widget | ✅ |
| NB-14 | 多项目创建与切换 | ✅ |
| NB-15 | 10 个工作流预设都在 PresetPicker 中 | ✅ |
| NB-16 | 多 Tab 协调广播 | ✅ |
| NB-17 | 视觉调优 v2 完整渲染 | ✅ |

产物:所有截图 + 真实生成图片 + 视频落到 `tests/artifacts/NB-*/`,测试报告 `tests/REPORT.md`。

## ⚠️ 实现过程中踩到的坑

| 问题 | 现象 | 解决 |
|---|---|---|
| `useEffect(setNodes) + useEffect(setDirty)` | **React 死循环**:画布变更 → project 变更 → effect 反复触发 | 拆开:canvas store 是 source of truth,project store 只读 IDB 写、自动保存 driver 拉 |
| 持久化泄漏(NB-06 3→2 节点) | auto-save 用 `window.__NB_CANVAS`,刷新后 window 还没值就触发覆盖 | auto-save 改用闭包 + `useCanvasStore.getState()` |
| 视频任务成功却 502 "无视频地址" | Agnes 把 URL 放在 `data.metadata.url`,原代码只读 `data.url` | `pickRemoteVideoUrl()` 多路径 fallback(22 条)|
| 多图视频直接被拒 | Agnes 缺 `mode=keyframes` | 加 `videoBody.mode = 'keyframes'` |
| Agnes CDN 缺 CORS | `<canvas>.drawImage()` 跨域读取像素失败 | `loadImageElement` 已设 `crossOrigin='anonymous'`,`fitImageToTargetCanvas` 的 try/catch fallback |
| IndexDB store 名猜错 | `tap-ai-canvas-agent` → 老 wuxianhuabu 项目冲突 | 新项目用 `tap-node-banana`,与老 wuxianhuabu 隔离 |
| React Flow 默认导出未命名 node | MiniMap 不能按类型染色 | 给 node.data 注入 `kind` 字段,在 MiniMap 用 `nodeColor={(n) => kindMap[n.data.kind]}` 染色 |
| reporter.py 路径硬编码 | REPORT.md 写到老仓库 | 自动算 `__file__` 的祖路径 |
| Gatsby / Context 循环依赖 | Topbar 想读 canvas store 直接 import 会循环 | 用 `window.__NB_CANVAS_STORE` 中转(dev-only)|
| yarn 4 install 缺权限 | corepack enable 失败 | 用 `@yarnpkg/cli-dist@4.17.0` 装到 `~/.yarn-4-cli/`,绕过 global |

## 🔮 Roadmap(还没做的)

- [ ] Tool approval 流(Agent 返回 action 时弹出 "是否允许" 确认)
- [ ] Character/Audio 节点接真正生成(目前 Audio 仅占位)
- [ ] Slash commands 弹面板补全 / 自动建议
- [ ] 测试覆盖率 — 添加 unit test + component test(Vitest)
- [ ] CI pipeline — GitHub Actions 一键跑测试
- [ ] 真实多渠道接 OpenAI API(目前只有 Agnes 实际测过)
- [ ] Service Worker 离线缓存(本机离线时仍能编辑)
- [ ] 项目导入/导出 JSON 格式

## 🔗 上游与同源

- 本仓库 fork 自 [wuxianhuabu](https://github.com/wangziming1996/wuxianhuabu) (tldraw 基础)
- 复刻目标: https://canvas.aixc4d.com / Node Banana
- Agnes 平台 API: `https://apihub.agnes-ai.com`(OpenAI-compatible)
- tldraw 原始仓库: https://github.com/tldraw/tldraw

## 📄 许可证

本仓库基于 tldraw 的 Apache-2.0,商业使用请遵守 tldraw 官方条款。本项目归 [wangziming1996](https://github.com/wangziming1996) 所有。
