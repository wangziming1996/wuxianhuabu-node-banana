/**
 * 文本节点 — 输入文本,作为下游 image / character / agent 的 prompt 注入
 * 支持斜杠命令:输入 /sixview 自动转换成 character 三视图预设
 */
import { Handle, Position, type NodeProps } from 'reactflow'
import { useMemo, useState } from 'react'
import { SLASH_COMMANDS, matchSlashCommand } from '../utils/slashCommands'
import { WORKFLOW_PRESETS } from '../ai/presets'
import { useCanvasStore } from '../stores/canvasStore'
import type { AiCanvasNode } from '../types'

type Props = NodeProps<AiCanvasNode>

export function TextNode({ id, data, selected }: Props) {
  const updateData = useCanvasStore((s) => s.updateNodeData)
  const [showSlashHint, setShowSlashHint] = useState(false)

  const slashMatch = useMemo(() => matchSlashCommand((data as any).text || '', WORKFLOW_PRESETS), [data])

  return (
    <div className={`nb-node nb-text-node ${selected ? 'nb-selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="text" className="nb-handle nb-handle-text" />
      <Handle type="source" position={Position.Right} id="text" className="nb-handle nb-handle-text" />

      <div className="nb-node-header">
        <span className="nb-node-title">📝 {(data as any).title || '文本节点'}</span>
      </div>

      <textarea
        className="nb-text-input"
        placeholder="键入 / 触发工作流预设,例如 /sixview"
        value={(data as any).text || ''}
        onChange={(e) => updateData(id, { text: e.target.value } as any)}
        onFocus={() => setShowSlashHint(true)}
        onBlur={() => setShowSlashHint(false)}
        rows={5}
      />

      {slashMatch?.preset && (
        <div className="nb-slash-hint nb-slash-match">
          <strong>{slashMatch.command}</strong> → 已识别预设 <em>{slashMatch.preset.title}</em>
        </div>
      )}

      {showSlashHint && (
        <div className="nb-slash-hint nb-slash-list">
          {SLASH_COMMANDS.map((c) => (
            <div key={c.slug} className="nb-slash-item">
              <code>/{c.slug}</code>
              <span>{c.title}</span>
              <small>{c.description}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
