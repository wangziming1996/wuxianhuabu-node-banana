/**
 * 底部历史图库面板 — 列出当前项目的生成历史
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../stores/canvasStore'
import { useProjectStore } from '../stores/projectStore'

export function BottomHistoryPanel() {
  const items = useProjectStore((s) => s.historyItems)
  const currentId = useProjectStore((s) => s.currentId)
  const addNode = useCanvasStore((s) => s.addNode)

  const filtered = useMemo(
    () => (currentId ? items.filter((it: any) => !it.projectId || it.projectId === currentId) : items),
    [items, currentId]
  )

  function putToCanvas(item: any) {
    addNode('image', { x: 200 + Math.random() * 200, y: 100 + Math.random() * 100 }, {
      title: item.title || '历史图',
      imageUrl: item.imageUrl,
      prompt: item.prompt || '',
      size: item.size || '1:1',
      count: 1,
      model: item.model || 'agnes-image-2.0-flash',
      status: 'done',
    })
  }

  return (
    <div className="nb-history-panel">
      <div className="nb-history-header">
        <strong>历史图库</strong>
        <small>{filtered.length} 条记录</small>
      </div>
      <div className="nb-history-grid">
        {filtered.length === 0 ? (
          <div className="nb-history-empty">暂无历史记录,生成图片后会在这里显示</div>
        ) : (
          filtered.map((h: any) => (
            <div key={h.id} className="nb-history-item" onClick={() => putToCanvas(h)}>
              <img src={h.imageUrl} alt={h.title} />
              <div className="nb-history-meta">
                <span>{h.title}</span>
                <small>{h.size || ''}</small>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
