/**
 * 斜杠命令解析 — 在文本节点输入框里支持 /imagen /qwen /wan 等
 * 返回是否激活了一个工作流预设
 */
import type { WorkflowPreset } from '../types'

const PATTERN = /^\/(\w+)(?:\s+(.*))?$/

export interface SlashCommandMatch {
  command: string
  args: string
  preset?: WorkflowPreset
}

export function matchSlashCommand(text: string, presets: WorkflowPreset[]): SlashCommandMatch | null {
  const trimmed = text.trim()
  const m = PATTERN.exec(trimmed)
  if (!m) return null
  const command = m[1]
  const args = (m[2] || '').trim()
  const preset = presets.find((p) => p.id.includes(command) || command === p.id.toLowerCase())
  return { command, args, preset }
}

export const SLASH_COMMANDS: { slug: string; title: string; description: string }[] = [
  { slug: 'sixview', title: '/sixview 产品六视图', description: '从产品图生成正侧背俯后侧顶六视图' },
  { slug: 'triptych', title: '/triptych 角色三视图', description: '从角色图生成正面、侧面、背面三视图设定稿' },
  { slug: 'lighting', title: '/lighting 九宫格灯光', description: '9 种不同打光方案的对比网格图' },
  { slug: 'motion', title: '/motion 动作迁移', description: '把图 B 的姿态迁移到图 A 的形象' },
  { slug: 'poster', title: '/poster 中文海报', description: '中文渲染最佳,适合品牌海报' },
  { slug: 'sketch', title: '/sketch 快速草图', description: '极速低成本写实人像 / 产品' },
]
