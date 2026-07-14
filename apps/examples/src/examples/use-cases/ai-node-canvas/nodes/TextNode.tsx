/**
 * 文本节点 — 输入文本,作为下游 image / character / agent 的 prompt 注入
 * 支持斜杠命令:输入 /sixview 自动插一个 CustomNode 到画布并预填预设
 */
import { Handle, Position, type NodeProps } from 'reactflow'
import { useMemo, useState } from 'react'
import { SLASH_COMMANDS, matchSlashCommand } from '../utils/slashCommands'
import { WORKFLOW_PRESETS } from '../ai/presets'
import { useCanvasStore } from '../stores/canvasStore'
import type { AiCanvasNode } from '../types'
import { newId } from '../utils/ulid'
import { NodeDeleteButton } from './NodeChrome'

type Props = NodeProps<AiCanvasNode>

export function TextNode({ id, data, selected }: Props) {
  const updateData = useCanvasStore((s) => s.updateNodeData)
  const addNode = useCanvasStore((s) => s.addNode)
  const [showSlashHint, setShowSlashHint] = useState(false)
  const [insertedPresetId, setInsertedPresetId] = useState<string | null>(null)

  const text = (data as any).text || ''
  const slashMatch = useMemo(() => matchSlashCommand(text, WORKFLOW_PRESETS), [text])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleInsertPreset()
    }
  }

  function handleInsertPreset() {
    if (!slashMatch?.preset) return
    const preset = slashMatch.preset
    // 从这条 TextNode 的位置向右偏移生成 CustomNode
    const cur = (data as any)
    const offsetX = (cur.xOffset ?? 360)
    const insertId = addNode('custom', { x: 0, y: 0 }, {
      title: preset.title,
      templateId: preset.id,
    } as any)
    setInsertedPresetId(insertId)
    // 也把 preset prompt 塞到当前节点,方便用户修改
    updateData(id, { text: slashMatch.args || preset.description } as any)
    // 1.6s 后清掉提示
    setTimeout(() => setInsertedPresetId(null), 1600)
  }

  return (
    <div className={`nb-node nb-text-node ${selected ? 'nb-selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="text" className="nb-handle nb-handle-text" />
      <Handle type="source" position={Position.Right} id="text" className="nb-handle nb-handle-text" />

      <div className="nb-node-header">
        <span className="nb-node-title">📝 {(data as any).title || '文本节点'}</span>
      </div>

      <textarea
        className="nb-text-input"
        placeholder="键入 / 触发工作流预设,例如 /sixview,然后 Ctrl+Enter"
        value={text}
        onChange={(e) => updateData(id, { text: e.target.value } as any)}
        onFocus={() => setShowSlashHint(true)}
        onBlur={() => setShowSlashHint(false)}
        onKeyDown={handleKeyDown}
        rows={5}
      />

      {slashMatch?.preset && (
        <div className="nb-slash-hint nb-slash-match">
          <strong>{slashMatch.command}</strong> → 已识别预设 <em>{slashMatch.preset.title}</em>
          <button
            className="nb-primary-btn"
            onClick={handleInsertPreset}
            style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
            data-testid="insert-preset-btn"
          >
            插入
          </button>
        </div>
      )}

      {insertedPresetId && (
        <div className="nb-slash-hint nb-slash-confirm" data-testid="insert-confirm">
          ✓ 已插入预设节点 {insertedPresetId.slice(-6)}
        </div>
      )}

      {showSlashHint && !slashMatch && (
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
    
        <NodeDeleteButton id={id} />
      </div>
  )
}
