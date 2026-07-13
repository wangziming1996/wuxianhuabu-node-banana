/**
 * 角色节点 — 角色三视图 / 角色设定稿
 * 输入: reference image URLs (来自上游图像节点)
 * 输出: front / side / back 三视图(一张 16:9 大图)
 */
import { Handle, Position, type NodeProps } from 'reactflow'
import { useMemo, useState } from 'react'
import { defaultProvider } from '../ai/provider'
import { runWithTaskSlot } from '../stores/taskStore'
import { useCanvasStore } from '../stores/canvasStore'
import type { AiCanvasNode } from '../types'

type Props = NodeProps<AiCanvasNode>

export function CharacterNode({ id, data, selected }: Props) {
  const updateData = useCanvasStore((s) => s.updateNodeData)
  const upstream = useCanvasStore((s) => s.getUpstreamNodes(id))

  const [busy, setBusy] = useState(false)

  const refUrls = useMemo(() => {
    const set = new Set<string>()
    const out: string[] = []
    for (const n of upstream) {
      if (n.type === 'image' && (n.data as any).imageUrl) {
        const u = (n.data as any).imageUrl
        if (!set.has(u)) {
          out.push(u)
          set.add(u)
        }
      }
    }
    return out
  }, [upstream])

  const characterData = data as any

  async function handleGenerate() {
    if (!characterData.description) return
    setBusy(true)
    try {
      await runWithTaskSlot('agnes', 'image', characterData.model || 'agnes-image-2.0-flash', async () => {
        const prompt =
          `角色名:${characterData.title}\n` +
          `角色描述:${characterData.description}\n\n` +
          `以参考图为基准,生成该角色的 16:9 角色设定三视图:正面、3/4 侧面、背面。` +
          `角色身份、五官、发型、体型、气质、服装与参考图严格一致。` +
          `专业角色设计稿风格,统一背景色,各视图对齐,无遮挡。无文字水印。`
        const result = await defaultProvider.generateImage({
          prompt,
          model: characterData.model || 'agnes-image-2.0-flash',
          size: '1152x648',
          count: 1,
          sourceImageUrls: refUrls.length ? refUrls : undefined,
        })
        updateData(id, {
          generatedImages: [{ view: 'front', url: result.imageUrls[0] }],
          status: 'done',
        } as any)
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`nb-node nb-character-node ${selected ? 'nb-selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="ref" className="nb-handle nb-handle-img" />
      <Handle type="source" position={Position.Right} id="image" className="nb-handle nb-handle-img" />

      <div className="nb-node-header">
        <span className="nb-node-title">🎭 {characterData.title || '角色节点'}</span>
      </div>

      <input
        className="nb-title-input"
        placeholder="角色名"
        value={characterData.title || ''}
        onChange={(e) => updateData(id, { title: e.target.value } as any)}
      />

      <textarea
        className="nb-desc-input"
        placeholder="角色描述:年龄、体型、发型、服装、气质、关键特征"
        rows={4}
        value={characterData.description || ''}
        onChange={(e) => updateData(id, { description: e.target.value } as any)}
      />

      {refUrls.length > 0 && (
        <div className="nb-ref-thumbs">
          {refUrls.slice(0, 3).map((u, i) => <img key={i} src={u} alt={`ref-${i}`} />)}
        </div>
      )}

      {characterData.generatedImages?.[0]?.url && (
        <div className="nb-image-preview">
          <img src={characterData.generatedImages[0].url} alt="三视图结果" />
        </div>
      )}

      <button className="nb-primary-btn" disabled={busy || !characterData.description} onClick={handleGenerate}>
        {busy ? '生成中…' : '生成三视图'}
      </button>
    </div>
  )
}
