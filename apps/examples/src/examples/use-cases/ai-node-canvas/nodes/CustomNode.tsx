/**
 * 自定义节点 — 通用容器,允许执行任意预设模板
 * 上下各有一个输入端口 + 一个输出端口
 */
import { Handle, Position, type NodeProps } from 'reactflow'
import { useState } from 'react'
import { WORKFLOW_PRESETS } from '../ai/presets'
import { useCanvasStore } from '../stores/canvasStore'
import { defaultProvider } from '../ai/provider'
import { runWithTaskSlot } from '../stores/taskStore'
import type { AiCanvasNode } from '../types'

type Props = NodeProps<AiCanvasNode>

export function CustomNode({ id, data, selected }: Props) {
  const updateData = useCanvasStore((s) => s.updateNodeData)
  const upstream = useCanvasStore((s) => s.getUpstreamNodes(id))
  const customData = data as any
  const [busy, setBusy] = useState(false)
  const [showPresets, setShowPresets] = useState(false)

  async function handleExecute() {
    if (!customData.templateId) return
    setBusy(true)
    try {
      const preset = WORKFLOW_PRESETS.find((p) => p.id === customData.templateId)
      if (!preset) return
      const refUrls: string[] = []
      for (const n of upstream) {
        const u = (n.data as any).imageUrl
        if (u) refUrls.push(u)
      }
      await runWithTaskSlot('agnes', 'image', 'agnes-image-2.0-flash', async () => {
        const result = await defaultProvider.generateImage({
          prompt: preset.prompt,
          model: 'agnes-image-2.0-flash',
          size: '1152x648',
          count: preset.count || 1,
          sourceImageUrls: refUrls.length ? refUrls : undefined,
        })
        updateData(id, { output: result.imageUrls[0], status: 'done' } as any)
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`nb-node nb-custom-node ${selected ? 'nb-selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="ref" className="nb-handle nb-handle-img" style={{ top: 60 }} />
      <Handle type="target" position={Position.Left} id="prompt" className="nb-handle nb-handle-text" />
      <Handle type="source" position={Position.Right} id="output" className="nb-handle nb-handle-img" />

      <div className="nb-node-header">
        <span className="nb-node-title">⚙ {customData.title || '自定义节点'}</span>
      </div>

      <input
        className="nb-title-input"
        placeholder="节点标题"
        value={customData.title || ''}
        onChange={(e) => updateData(id, { title: e.target.value } as any)}
      />

      <div className="nb-preset-picker">
        <button className="nb-secondary-btn" onClick={() => setShowPresets(!showPresets)}>
          {customData.templateId
            ? WORKFLOW_PRESETS.find((p) => p.id === customData.templateId)?.title || '已选预设'
            : '选择预设'}
        </button>
        {showPresets && (
          <div className="nb-preset-menu">
            {WORKFLOW_PRESETS.map((p) => (
              <div
                key={p.id}
                className="nb-preset-item"
                onClick={() => {
                  updateData(id, { templateId: p.id, title: p.title } as any)
                  setShowPresets(false)
                }}
              >
                <strong>{p.title}</strong>
                <small>{p.description}</small>
              </div>
            ))}
          </div>
        )}
      </div>

      {customData.output && (
        <div className="nb-image-preview">
          <img src={customData.output} alt="output" />
        </div>
      )}

      <button className="nb-primary-btn" disabled={busy || !customData.templateId} onClick={handleExecute}>
        {busy ? '执行中…' : '执行预设'}
      </button>
    </div>
  )
}
