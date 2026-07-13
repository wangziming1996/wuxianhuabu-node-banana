/**
 * 工作流预设面板 — 列出 10 个预设,一键插入 CustomNode
 */
import { useCanvasStore } from '../stores/canvasStore'
import { WORKFLOW_PRESETS } from '../ai/presets'

export function PresetPicker({ onClose }: { onClose: () => void }) {
  const addNode = useCanvasStore((s) => s.addNode)

  function insertPreset(presetId: string) {
    const preset = WORKFLOW_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    addNode('custom', { x: 240 + Math.random() * 200, y: 100 + Math.random() * 200 }, {
      title: preset.title,
      templateId: preset.id,
    })
    onClose()
  }

  const byCat: Record<string, typeof WORKFLOW_PRESETS> = {}
  for (const p of WORKFLOW_PRESETS) {
    if (!byCat[p.category]) byCat[p.category] = []
    byCat[p.category].push(p)
  }

  return (
    <div className="nb-modal-backdrop" onClick={onClose}>
      <div className="nb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nb-modal-header">
          <h2>工作流预设</h2>
          <button className="nb-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="nb-modal-body">
          <p className="nb-hint">挑选一个预设,会插入一个 CustomNode 到画布,按 "执行预设" 就能调用对应 prompt 模板。</p>
          {Object.entries(byCat).map(([cat, list]) => (
            <div key={cat} className="nb-preset-category">
              <h4>{cat}</h4>
              <div className="nb-preset-grid">
                {list.map((p) => (
                  <div key={p.id} className="nb-preset-card" onClick={() => insertPreset(p.id)}>
                    <strong>{p.title}</strong>
                    <small>{p.description}</small>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="nb-modal-footer">
          <button className="nb-secondary-btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
