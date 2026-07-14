/**
 * 图片节点 — React Flow 自定义节点
 * 输入: prompt（来自上游文本节点） + reference image URLs（来自上游图像节点）
 * 输出: imageUrl（被下游图像/角色节点引用）
 */
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from 'reactflow'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AiCanvasNode, AspectRatioId } from '../types'
import { useCanvasStore } from '../stores/canvasStore'
import { defaultProvider } from '../ai/provider'
import { runWithTaskSlot } from '../stores/taskStore'
import { useProjectStore } from '../stores/projectStore'
import { newId } from '../utils/ulid'
import { NodeDeleteButton } from './NodeChrome'

type Props = NodeProps<AiCanvasNode>

export function ImageNode({ id, data, selected }: Props) {
  const updateData = useCanvasStore((s) => s.updateNodeData)
  const upstream = useCanvasStore((s) => s.getUpstreamNodes(id))
  const refInit = useUpdateNodeInternals()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  const lastImageRef = useRef<string | undefined>(undefined)

  /* 收集上游注入:文本节点的 text 当作 prompt,图像节点的 imageUrl 当作参考图 */
  const injectedPrompt = useMemo(() => {
    const texts = upstream.filter((n) => n.type === 'text').map((n) => (n.data as any).text as string)
    const trimmedTexts = texts.map((t) => t.trim()).filter(Boolean)
    return trimmedTexts.length ? trimmedTexts.join('\n\n') : data.prompt
  }, [upstream, data.prompt])

  const referenceUrls = useMemo(() => {
    const ids = new Set<string>()
    const out: string[] = []
    for (const n of upstream) {
      if (n.type === 'image' && (n.data as any).imageUrl && !ids.has((n.data as any).imageUrl)) {
        out.push((n.data as any).imageUrl)
        ids.add((n.data as any).imageUrl)
      }
    }
    return out
  }, [upstream])

  /* 选模型 / 比例 */
  const sizeMap: Record<AspectRatioId, string> = {
    '1:1': '1024x1024',
    '3:4': '768x1024',
    '4:3': '1024x768',
    '16:9': '1152x648',
    '9:16': '648x1152',
    '21:9': '1280x544',
  }
  const size = sizeMap[data.size as AspectRatioId] || '1024x1024'

  /* 通知 reactflow 端口 id 改动了 */
  useEffect(() => {
    refInit(id)
  }, [id, refInit])

  /* 图片生成成功后短期闪烁提示 */
  useEffect(() => {
    const cur = (data as any).imageUrl
    if (cur && cur !== lastImageRef.current && !busy) {
      lastImageRef.current = cur
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 1100)
      return () => clearTimeout(t)
    }
  }, [(data as any).imageUrl, busy])

  async function handleGenerate() {
    setBusy(true)
    setError(null)
    try {
      await runWithTaskSlot('agnes', 'image', data.model, async (taskId) => {
        const result = await defaultProvider.generateImage({
          prompt: injectedPrompt,
          model: data.model,
          size,
          count: data.count || 1,
          sourceImageUrls: referenceUrls.length ? referenceUrls : undefined,
        })
        const main = result.imageUrls[0]
        updateData(id, { imageUrl: main, status: 'done' })
        // 写一条历史记录
        const projState = useProjectStore.getState()
        if (projState.currentId) {
          projState.recordHistory({
            id: newId('h'),
            projectId: projState.currentId,
            nodeId: id,
            kind: 'generated',
            title: data.title || '图片节点',
            imageUrl: main,
            prompt: injectedPrompt,
            model: data.model,
            size: data.size,
            createdAt: Date.now(),
          })
        }
        return result
      })
    } catch (e: any) {
      setError(String(e?.message || e))
      updateData(id, { status: 'error', errorMessage: String(e?.message || e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`nb-node nb-image-node ${selected ? 'nb-selected' : ''} nb-status-${data.status} ${flash ? 'nb-flash-new' : ''}`}>
      <Handle type="target" position={Position.Left} id="prompt" className="nb-handle nb-handle-text" />
      <Handle type="target" position={Position.Left} id="ref" className="nb-handle nb-handle-img" style={{ top: 80 }} />
      <Handle type="source" position={Position.Right} id="image" className="nb-handle nb-handle-img" />

      <div className="nb-node-header">
        <span className="nb-node-title">🖼 {data.title || '图片节点'}</span>
        {data.status === 'generating' && <span className="nb-badge">生成中…</span>}
        {data.status === 'error' && <span className="nb-badge nb-badge-error">失败</span>}
      </div>

      <div className="nb-image-preview">
        {data.imageUrl ? (
          <img src={data.imageUrl} alt={data.title} />
        ) : (
          <div className="nb-image-placeholder">
            {data.status === 'generating' ? '生成中…' : '尚未生成'}
          </div>
        )}
      </div>

      <textarea
        className="nb-prompt-input"
        placeholder="提示词(可留空,从上游文本节点注入)"
        value={injectedPrompt || ''}
        onChange={(e) => updateData(id, { prompt: e.target.value })}
        rows={3}
      />

      <div className="nb-controls">
        <select value={data.size} onChange={(e) => updateData(id, { size: e.target.value as AspectRatioId })}>
          <option value="1:1">1:1</option>
          <option value="3:4">3:4</option>
          <option value="4:3">4:3</option>
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
          <option value="21:9">21:9</option>
        </select>
        <input
          type="number"
          min={1}
          max={4}
          value={data.count}
          onChange={(e) => updateData(id, { count: Math.max(1, Math.min(4, Number(e.target.value))) })}
        />
        <input
          value={data.model}
          onChange={(e) => updateData(id, { model: e.target.value })}
          title="模型 ID"
        />
      </div>

      {referenceUrls.length > 0 && (
        <div className="nb-ref-list">
          <small>参考图:</small>
          <div className="nb-ref-thumbs">
            {referenceUrls.slice(0, 3).map((u, i) => (
              <img key={i} src={u} alt={`ref-${i}`} />
            ))}
            {referenceUrls.length > 3 && <small>+{referenceUrls.length - 3}</small>}
          </div>
        </div>
      )}

      {error && <div className="nb-error">{error}</div>}

      <button className="nb-primary-btn" disabled={busy || !injectedPrompt} onClick={handleGenerate}>
        {busy ? '生成中…' : '生成'}
      </button>
    
        <NodeDeleteButton id={id} />
      </div>
  )
}
