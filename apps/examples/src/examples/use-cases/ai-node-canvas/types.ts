/**
 * 节点图数据模型 — 复刻 Node Banana 的核心 schema
 * 关键决策:
 *  - 5 种节点类型(image / text / character / audio / custom)
 *  - 类型化 handle(每个节点知道自己的输入/输出端口)
 *  - 边带 sourceHandle/targetHandle,允许一条边带数据
 *  - 节点 data 是区分联合,TypeScript 自动收窄
 */

import type { Node, Edge } from 'reactflow'

export type NodeKind = 'image' | 'text' | 'character' | 'audio' | 'custom'

export type ImageNodeStatus = 'idle' | 'generating' | 'done' | 'error'

/* ---------------- 图像节点 ---------------- */
export interface ImageNodeData {
  kind: 'image'
  title: string
  prompt: string                 // 用户写的文本 prompt
  negativePrompt?: string
  imageUrl?: string              // 生成 / 上传后填入
  thumbnailUrl?: string
  width?: number
  height?: number
  size: AspectRatioId            // 比例
  count: number                  // 生成张数(1-4)
  model: string                  // 当前模型 ID
  providerId?: string            // 默认 'agnes'
  status: ImageNodeStatus
  errorMessage?: string
  historyRefs?: string[]         // 关联的历史记录 ID
  isReference?: boolean          // 是否被其他节点作为参考图
}

/* ---------------- 文本节点 ---------------- */
export interface TextNodeData {
  kind: 'text'
  text: string                   // 任意文本,会自动 trim 给下游
  isPrompt?: boolean             // 是否当作 prompt 注入
}

/* ---------------- 角色节点 ---------------- */
export interface CharacterNodeData {
  kind: 'character'
  title: string                  // 角色名
  description: string            // 角色描述(传给模型)
  referenceImageUrls?: string[]  // 角色参考图
  generatedImages?: { view: 'front' | 'side' | 'back'; url: string }[]
  model?: string
  size?: AspectRatioId
  status?: 'idle' | 'generating' | 'done' | 'error'
}

/* ---------------- 音频节点(预留 UI) ---------------- */
export interface AudioNodeData {
  kind: 'audio'
  title: string
  description: string             // TTS / 音效 prompt
  audioUrl?: string
  duration?: number
  status?: 'idle' | 'generating' | 'done' | 'error'
}

/* ---------------- 自定义节点(用户自定义提示词模板) ---------------- */
export interface CustomNodeData {
  kind: 'custom'
  title: string
  templateId?: string            // 引用 ai/presets.ts 的预设
  inputs: Record<string, string> // key → 节点输出 ref 或 字面量
  output?: string
  status?: 'idle' | 'generating' | 'done' | 'error'
}

/* ---------------- 类型合集 ---------------- */
export type AnyNodeData =
  | ImageNodeData
  | TextNodeData
  | CharacterNodeData
  | AudioNodeData
  | CustomNodeData

export type AspectRatioId = '1:1' | '3:4' | '4:3' | '16:9' | '9:16' | '21:9'

export interface AiCanvasNode extends Node<AnyNodeData> {
  type: NodeKind
}

export interface AiCanvasEdge extends Edge {
  data?: {
    kind?: 'reference' | 'prompt' | 'output'
    preview?: string
  }
}

/* ---------------- 项目 / 历史 / 任务 ---------------- */
export interface ProjectDoc {
  id: string                      // ULID
  name: string
  createdAt: number
  updatedAt: number
  nodes: AiCanvasNode[]
  edges: AiCanvasEdge[]
  historyItems: HistoryItem[]
  thumbnailDataUrl?: string
  storageVersion: 2
}

export interface HistoryItem {
  id: string
  projectId: string
  nodeId: string
  kind: 'uploaded' | 'generated'
  title: string
  imageUrl: string
  prompt?: string
  model?: string
  size?: AspectRatioId
  referenceImageUrls?: string[]
  createdAt: number
}

/* ---------------- 设置:多渠道 AI ---------------- */
export type ProviderId = 'agnes' | 'openai' | 'volcengine' | 'dashscope' | 'deepseek' | 'custom'

export interface ProviderSetting {
  id: ProviderId
  label: string
  baseUrl: string
  apiKey?: string                 // 留空表示使用 env 默认
  enabled: boolean
  models: string[]                // 用户能看到、能选的模型列表
  isDefault?: boolean
  supportsImage: boolean
  supportsVideo: boolean
  supportsText: boolean
}

/* ---------------- 工作流预设(Node Banana 复刻) ---------------- */
export interface WorkflowPreset {
  id: string
  category: '设计' | '海报' | '草图' | '精修' | '改图' | '角色' | '剧情' | '分镜'
  title: string
  description: string
  prompt: string                  // 主 prompt 模板
  recommendedModel?: string
  size?: AspectRatioId
  count?: number
  presetFor: NodeKind[]           // 适用节点类型
}
