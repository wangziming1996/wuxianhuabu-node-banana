# wuxianhuabu-node-banana

> Node Banana (canvas.aixc4d.com) 的本地复刻 — 基于 tldraw 改造的无限画布,React Flow 节点图迁移版,多渠道 OpenAI-compatible AI(Agnes 为默认)。

## 与上游 wuxianhuabu 的区别

| 维度 | wuxianhuabu | 本项目 |
|---|---|---|
| 画布 | tldraw(自由画布)| React Flow(节点图,严格有向图) |
| AI 提供商 | Agnes 单网关 | 多渠道 OpenAI-compatible(火山方舟/通义万相/DeepSeek/OpenAI…)+ Agnes 默认 |
| 项目模型 | 单画布 IndexedDB | 多 Project + 列表 + 导入/导出 |
| UI 风格 | tldraw 风格 | 像素级对齐 Node Banana |
| 节点类型 | image / prompt / text / doodle / video | image / text / character / audio / custom + 同上 |

## 起点继承自 wuxianhuabu

当前 commit 来自 https://github.com/wangziming1996/wuxianhuabu 的 `3dd7c0b`,包含:
- 19 个全过测试(F1-F11、V1-V5、P1-P2、E2E)
- 已修的两个视频 Bug(metadata.url 提取 + mode=keyframes)
- AGNES API Key 已配(`apps/examples/.env.local`,本机私有)

接下来的所有复刻工作都在本仓库进行,不会动 `wuxianhuabu` 仓库。

## 复刻路线图

详见 `MIGRATION_PLAN.md`(预计开始后填入)。
