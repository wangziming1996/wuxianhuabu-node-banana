---
title: Node Banana AI 画布
component: ./AiNodeCanvasExample.tsx
priority: 1
keywords: [ai, image generation, node graph, multi-channel, react flow, mini-map]
---

基于 React Flow 的节点图 AI 画布,复刻 canvas.aixc4d.com(Node Banana):

- 5 种节点(image / text / character / audio / custom)
- 10 个工作流预设(专业设计 / 中文海报 / 快速草图 / 图片精修 / 文字改图 / 角色三视图 / 剧情梗概 / 时间推演 4 格 / 故事九宫格 / 动作迁移)
- AI Agent 对话助手 — 在右侧面板发指令自动构造 prompt / 直接生图
- 多渠道 OpenAI-compatible(默认 Agnes,可加火山方舟 / 通义千问 / DeepSeek / 自定义)
- 多 Project 管理 — 列表 + 导入 / 导出 / 删除,自动 IDB 保存
- 多 Tab 协调 — BroadcastChannel 防止覆盖其它标签页的修改
- 斜杠命令 — 在文本节点输入 `/sixview` `/triptych` 等自动绑定预设

Key 前端 Key 存于 `apps/examples/.env.local`(`IMAGE_API_KEY`)。
