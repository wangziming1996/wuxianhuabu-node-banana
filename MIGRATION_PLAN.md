# 复刻计划书 — wuxianhuabu → Node Banana(像素级)

> 目标:1:1 复刻 https://canvas.aixc4d.com/(Node Banana)的所有功能与 UI,默认 AI 渠道保留 Agnes,但 UI 上支持任何 OpenAI-compatible 渠道。
> 起点仓库:`wuxianhuabu` v`3dd7c0b`(已 import 作为初始 commit)

---

## 〇、复刻对象档案

| 维度 | Node Banana 现状 |
|---|---|
| 框架 | Next.js 15 + turbopack + React + React Flow + Vercel AI SDK |
| 节点类型 | image / text / character / audio / custom |
| 节点预设(从 JS 抽) | 专业设计、中文海报、快速草图、图片精修、文字改图、角色三视图、剧情梗概、剧情走向、故事九宫格、时间推演 4 格 |
| 多渠道 | 火山方舟、通义万相、DeepSeek,每个独立 Key |
| 顶层路由 | `/`、`/api/{agent,chat,generate,generate/poll,llm,test-key}` |
| 多 Project | 列表 / 打开 / 保存 / 导出 / 导入 / 多 Tab 防覆盖 / 孤儿清扫 / 存储空间检测 |
| AI 助手 | /api/agent、/api/chat、/api/llm 三个分层接口 |
| 商业化 | 成本簿记、并发限制、Tool approval、标准错误 |
| 视觉 | 简洁卡片 / 深色面板 / 节点网格自对齐 / Mini-Map |

**复刻目标**:把上面这一整套在我们的 Vite + tldraw 仓库里,以"视觉对齐 + 功能对齐"重做。画布换 React Flow,后端换成 5 个统一路由(参考 Node Banana),数据层从单画布变多项目。

---

## 一、技术栈替换映射表

| 维度 | 老(wuxianhuabu)| 新(wuxianhuabu-node-banana)|
|---|---|---|
| 框架 | Vite + tldraw | Vite + React Flow `reactflow@^11.x` |
| 状态 | React useState | Zustand(`zustand@^4.x`)— Node Banana 用的 Vercel AI SDK 配套 |
| 数据 | IndexedDB 单 store | IndexedDB 多 project store(`idb@^8.x`)|
| 后端路由 | 13 个分散 | 5 个统一(`/api/agent`、`/api/chat`、`/api/generate`、`/api/generate/poll`、`/api/llm`)|
| AI 接入 | 直连 Agnes OpenAI 协议 | 通用 OpenAI-compatible fetcher,Key + Base URL 由用户在 UI 注入 |
| UI 库 | tldraw 自带 | shadcn/ui 风格手搓 + Tailwind(可选)|
| 画布图类型 | tldraw shape | React Flow Node / Edge + 自定义类型 |

---

## 二、阶段分解(每个阶段单独可测)

### 阶段 0 · 工程脚手架 ✅(已完成)

- [x] 在 GitHub 创建 `wuxianhuabu-node-banana` 仓库  
- [x] 本地克隆并把 `wuxianhuabu@3dd7c0b` 注入作为初始 commit  
- [x] `.env.local`(Agnes key)在新仓库就位  
- [x] 推送到 origin:main

> 验证:`git ls-remote` 看到 main 分支;`apps/examples/.env.local` 已配

---

### 阶段 1 · 画布迁移:tldraw → React Flow(分前后端逐步)

**预计时间**:3-5 天  
**风险**:高(重新画数据模型)  
**产出**:能加载、原 wuxianhuabu 的 19 个测试改成 React Flow 版后也全过

#### 1A. 数据模型

```ts
// types.ts
export type NodeKind = 'image' | 'text' | 'character' | 'audio' | 'custom'

export interface CanvasNode {
  id: string
  type: NodeKind
  position: { x: number; y: number }
  data: NodeData  // discriminated by type
  width?: number
  height?: number
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export type NodeData =
  | ImageNodeData
  | TextNodeData
  | CharacterNodeData
  | AudioNodeData
  | CustomNodeData
```

#### 1B. 组件结构

```
apps/examples/src/examples/use-cases/ai-node-canvas/
├─ AiNodeCanvasExample.tsx         主组件
├─ components/
│  ├─ CanvasShell.tsx              React Flow 容器
│  ├─ nodes/
│  │  ├─ ImageNode.tsx             图像节点(支持 i2i 输入引脚)
│  │  ├─ TextNode.tsx              文本节点(prompt 输入)
│  │  ├─ CharacterNode.tsx         角色三视图节点
│  │  ├─ AudioNodeData.tsx         音频节点(预留,这次不做音频生成,但 UI 要有)
│  │  └─ CustomNode.tsx            通用节点
│  ├─ edges/
│  │  └─ ConnectionEdge.tsx        自定义连线样式
│  ├─ panels/
│  │  ├─ Topbar.tsx                项目标题、新建/打开/保存/导出/导入/未保存指示
│  │  ├─ LeftSidebar.tsx           节点添加按钮(+/image/text/character/audio/custom)
│  │  ├─ RightPanel.tsx            AI 助手面板
│  │  ├─ BottomHistoryPanel.tsx    历史图库面板
│  │  └─ MiniMap.tsx               canvas mini-map
│  └─ modals/
│     ├─ ApiKeyManager.tsx         多渠道 Key 管理
│     ├─ PresetPicker.tsx          工作流预设选择
│     └─ ProjectSwitcher.tsx       多 project 切换
├─ ai/
│  ├─ provider.ts                  OpenAI-compatible 客户端(通用)
│  ├─ presets.ts                   10 个工作流预设的 prompt 模板
│  └─ agent.ts                     Agent 调用 Vercel AI SDK 风格
└─ store/
   ├─ canvasStore.ts               Zustand: nodes / edges / selection
   ├─ projectStore.ts              IDB 多 project
   ├─ settingsStore.ts             多渠道 Key + provider 选择
   └─ taskStore.ts                 任务队列(并发限制 + 成本簿记)
```

#### 1C. 测试用例

新增 tests/run_node_banana.py,等价于老的 F1-F11 但走新路由;老 tests/ 保留作为兼容性参考。

---

### 阶段 2 · 多渠道 Key 系统(L2:OpenAI-compatible URL)

**预计时间**:2-3 天  
**风险**:中  
**产出**:用户能在 UI 输入任意 OpenAI-compatible 服务的 URL + Key,立即生效

#### 2A. 设置面板 UI

| 字段 | 默认值 |
|---|---|
| 提供商 | Agnes / OpenAI / 通义(国际版 Dashscope) / 火山方舟 / DeepSeek / 自定义 |
| Base URL | 自动按提供商填,自定义可改 |
| API Key | 用户输入,留空则用 `.env.local` 默认 |
| 测试按钮 | `POST /api/test-key` 验通 |

#### 2B. 数据存储

```ts
// settingsStore.ts (IndexedDB store: 'settings')
interface ProviderSetting {
  provider: 'agnes' | 'openai' | 'dashscope' | 'volcengine' | 'deepseek' | 'custom'
  baseUrl: string
  apiKey: string
  enabled: boolean
  models: string[]
  isDefault: boolean
}
```

#### 2C. Provider 抽象

```ts
// ai/provider.ts
interface AIProvider {
  generateText(req: TextGenReq): AsyncIterable<TextChunk>
  generateImage(req: ImageGenReq): Promise<ImageGenResult>
  generateVideo(req: VideoGenReq): Promise<{ taskId: string }>
  pollVideo(taskId: string): Promise<VideoStatus>
  listModels(): Promise<ModelInfo[]>
}

class OpenAICompatibleProvider implements AIProvider {
  constructor(setting: ProviderSetting) { ... }
}
```

每个 provider 实现 OpenAI 协议适配;Agnes 也用同一份(因为它本身就是 OpenAI 兼容)。

---

### 阶段 3 · 多 Project + 数据治理

**预计时间**:2-3 天  
**风险**:中  
**产出**:完整 project CRUD + 导入/导出 + 多 Tab 协调 + 孤儿清扫 + 存储空间检测

#### 3A. Project Store

```ts
// projectStore.ts
interface ProjectDoc {
  id: string                    // ulid
  name: string
  createdAt: number
  updatedAt: number
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  historyItems: HistoryItem[]
  thumbnailDataUrl?: string     // 自动抓 canvas 缩略图
  storageVersion: 2             // 升级 schema 标志
}
```

#### 3B. IDB Schema

```
DB: tap-node-banana (v1)
Stores:
- projects (keyPath: 'id')           — ProjectDoc
- media   (keyPath: 'id')           — ImageData / AudioData (separated)
- settings(keyPath: 'providerId')    — ProviderSetting
- snapshots(keyPath: 'projectId+ts') — 自动恢复快照
```

#### 3C. 多 Tab 协调

```ts
// 用 BroadcastChannel 实现
const channel = new BroadcastChannel('tap-node-banana');
channel.postMessage({ type: 'project:save', projectId, payload });

channel.onmessage = (e) => {
  if (e.data.type === 'project:save' && e.data.projectId !== currentId) {
    showToast('其他标签页已修改,跳过本次保存…');
  }
};
```

#### 3D. 存储空间检测

```ts
async function checkStorageQuota(): Promise<{ usage, quota, percent }> {
  const estimate = await navigator.storage.estimate();
  return {
    usage: estimate.usage,
    quota: estimate.quota,
    percent: estimate.usage / estimate.quota
  };
}
```

#### 3E. 孤儿媒体清扫

```ts
// 每天检查一次,清理 projects 中没有引用的 media
async function sweepOrphanedMedia() {
  const referencedIds = await getReferencedMediaIds();
  const allIds = await idb.getAllKeys('media');
  const orphans = allIds.filter(id => !referencedIds.has(id));
  await Promise.all(orphans.map(id => idb.del('media', id)));
}
```

---

### 阶段 4 · AI Agent 增强(把 /api/agent-chat 拆三层)

**预计时间**:1-2 天  
**风险**:低(我们已经有一个 working agent-chat)

#### 4A. 三层 API

| 路由 | 用途 | 对应 Node Banana |
|---|---|---|
| `/api/agent` | Agent 对话(可用工具) | ✓ |
| `/api/chat` | 纯文本补全 | ✓ |
| `/api/llm` | LLM 通用推理(封装) | ✓ |

#### 4B. Tool approval 流

```ts
// 前端 Agent 面板里
// 1. 用户说"画一只猫"
// 2. Agent 返回 { tool: 'generate_image', requires_approval: true, params: {...} }
// 3. UI 弹"是否允许生成?需要 X 额度"
// 4. 用户点确认 → 真实生成
// 5. 用户点取消 → 不生成,回到对话
```

#### 4C. 成本簿记

```ts
// 每次生成调用记录
interface CostRecord {
  taskId: string
  provider: string
  model: string
  estimatedTokens: number
  estimatedCostUSD: number
  durationMs: number
  timestamp: number
}

// taskStore 累计显示在右上角
```

---

### 阶段 5 · UI 像素级对齐 + 工作流预设

**预计时间**:3-5 天  
**风险**:中(纯视觉)  
**产出**:UI 与 canvas.aixc4d.com 接近一致;Node Banana 的 10 个预设全部可点

#### 5A. 视觉规范(Node Banana 风格)

| 元素 | 风格 |
|---|---|
| 主背景 | 深灰 `#1a1a1a` 系列,节点图区浅色 |
| 节点 | 圆角 12px,白底,轻微阴影,选中加蓝色边框 |
| 端口 | 蓝色小圆点;输入在左,输出在右 |
| 字体 | Inter / PingFang SC |
| 顶部顶栏 | 项目名 + 新建/打开/保存 + 自动保存指示 |
| 左侧栏 | 节点添加按钮(图标 + 文字)|
| 右侧 AI 助手 | 对话式,带输入框和样本提示词 |
| 底部历史 | 缩略图网格 |

#### 5B. 工作流预设对照(Node Banana 全部复刻)

| Node Banana 预设 | 我们当前 | 是否需要补 |
|---|---|---|
| 专业设计(高质量出图 / 万相 2.7 Pro)| ❌ | ✅ |
| 中文海报(千问 2.0 Pro)| ❌ | ✅ |
| 快速草图(Z-Image Turbo)| ❌ | ✅ |
| 图片精修(万相 2.7 Pro 改图)| ❌(等价 F4 但 prompt 不同)| 改 |
| 文字改图(千问 2.0 Pro)| ❌ | ✅ |
| 角色三视图 | ❌(有 F6 six-view 但视角不同)| ✅ |
| 剧情梗概 | ❌ | ✅ |
| 剧情走向 | ❌ | ✅ |
| 故事九宫格(分镜)| ❌ | ✅ |
| 时间推演 4 格 | ❌ | ✅ |

#### 5C. 斜杠命令

在文本节点输入框里支持 `/imagen`、`/qwen`、`/wan`、`/seedance` → 直接产生生成节点。

#### 5D. MiniMap 与键盘快捷键

- `Cmd+Z` / `Cmd+Shift+Z`:undo/redo
- `Cmd+S`:保存当前 project
- `Cmd+N`:新建 project
- `Cmd+Shift+P`:打开 project switcher
- 双击空白:快速插入文本节点
- 拖动文件:在指定位置插入图像节点

---

### 阶段 6 · 端到端测试 + 兼容性回归

**预计时间**:1-2 天  
**风险**:低  
**产出**:tests/run_node_banana.py 全过,原 19 用例 100% 复测通过

#### 6A. 测试套件

```
tests/
├─ run_node_banana.py             主入口(替代 run_all.py)
├─ video_run_banana.py            V1-V5 用新 provider 跑
├─ ui_banana_e2e.py               Playwright 多 project + 多渠道
├─ cases/
│  ├─ ai_f01_text_to_image.py
│  ├─ ai_f06_image_to_image_*.py
│  ├─ ai_v01_text_to_video.py
│  ├─ ai_p01_multi_project.py
│  ├─ ai_p02_multi_channel.py
│  ├─ ai_p03_image_prompt_presets.py    ← 新
│  ├─ ai_p04_storage_space_check.py     ← 新
│  └─ ai_p05_multi_tab_coordination.py  ← 新
└─ REPORT.md
```

#### 6B. 兼容性

- 老 `wuxianhuabu` 的 tests/run_all.py 继续保留并通过(我们会同步测试但默认入口是新的)
- 老 `apps/examples/.env.local` 内容不变
- 新 `wuxianhuabu-node-banana` 在 IDB 用不同的 db name(`tap-node-banana`),不污染老数据

---

### 阶段 7 · 文档与分享

**预计时间**:半天  
**风险**:无  
**产出**:完整文档 + screenshot 实测

- 写一份 `MIGRATION_REPORT.md`(阶段 1-6 完成后的总结)
- `ai-canvas-tutorial.html` 更新
- 视频教程脚本(可选)

---

## 三、阶段依赖图

```
阶段 0 ✅
   │
   ▼
阶段 1 (画布)──┐
   │           │
   ▼           ▼
阶段 2 (渠道)  阶段 3 (Project)
   │           │
   ▼           ▼
阶段 4 (Agent) ←┘
   │
   ▼
阶段 5 (UI + 预设)
   │
   ▼
阶段 6 (E2E 测试)
   │
   ▼
阶段 7 (文档)
```

阶段 2 和阶段 3 可以并行(都依赖 1 但互不依赖)。阶段 4 同时需要 2 和 3。

---

## 四、关键风险与应对

| 风险 | 缓解 |
|---|---|
| React Flow 与 tldraw UX 哲学冲突(节点图 vs 自由画布)| 接受"我们会失去 tldraw 的手绘体验",用自定义节点外观补足 |
| 多渠道 Key 的并发限流差异大(各 provider QPS 不同)| taskStore 维护 per-provider 队列 + semaphore |
| 视频 API 各家 schema 差异大(Seedance / Doubao / Agnes)| 在 Provider 抽象层做 normalize;只实现 Agnes 完整路径,其他 provider 标记 "video: not supported"|
| 老用户从 wuxianhuabu 迁移画布数据| 提供一次性 conversion 脚本,读老 IDB → 写新 IDB(可选)|
| 浏览器存储空间不够放多项目| 实现 LRU 淘汰 + 用户提示手动导出|
| 视觉对齐反人性(Node Banana 配色很暗,有些老用户喜欢亮的)| 提供 light / dark 切换,默认 dark|

---

## 五、本次启动需要你确认的事

1. ✅ 仓库已建:`https://github.com/wangziming1996/wuxianhuabu-node-banana`(initial commit 已推送)
2. ✅ 本地目录:`/Users/wangziming/aimake/zmt/wuxianhuabu-node-banana`(已 git clone + 注入现有 wuxianhuabu 内容)
3. ✅ Agnes API Key 已写:`apps/examples/.env.local`
4. ⏳ 等待你说"开始",我从**阶段 1** 开始动手

> 💡 如果你想调整某阶段的顺序、合并某些步骤、或者跳过非核心功能(如音频节点),告诉我即可。
