/**
 * 左侧节点面板 — 添加新节点(image / text / character / audio / custom)
 */
import { useCallback } from 'react'
import { useReactFlow } from 'reactflow'
import { useCanvasStore } from '../stores/canvasStore'

const NODE_BUTTONS = [
  { kind: 'image', label: '图片', icon: '🖼', desc: '上传 / 生成 / 编辑' },
  { kind: 'text', label: '文本', icon: '📝', desc: 'Prompt 输入 / 斜杠命令' },
  { kind: 'character', label: '角色', icon: '🎭', desc: '三视图 / 设定稿' },
  { kind: 'audio', label: '音频', icon: '🔊', desc: 'TTS / 音效(预留)' },
  { kind: 'custom', label: '自定义', icon: '⚙', desc: '复用工作流预设' },
] as const

export function LeftSidebar() {
  const rf = useReactFlow()
  const addNode = useCanvasStore((s) => s.addNode)

  const onAdd = useCallback(
    (kind: typeof NODE_BUTTONS[number]['kind']) => {
      const bounds = rf.getViewport()
      // 把节点加在屏幕中心(基于当前 viewport)
      const x = (window.innerWidth / 2 - bounds.x) / bounds.zoom - 100
      const y = (window.innerHeight / 2 - bounds.y) / bounds.zoom - 50
      addNode(kind, { x, y })
    },
    [rf, addNode]
  )

  return (
    <aside className="nb-left-sidebar">
      <div className="nb-sidebar-section">
        <h3>添加节点</h3>
        <div className="nb-node-buttons">
          {NODE_BUTTONS.map((b) => (
            <button key={b.kind} className="nb-add-node-btn" onClick={() => onAdd(b.kind)} title={b.desc}>
              <span className="nb-icon">{b.icon}</span>
              <span className="nb-label">{b.label}</span>
              <small>{b.desc}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="nb-sidebar-section nb-tips">
        <h3>操作提示</h3>
        <ul>
          <li>从节点左侧圆点拖到另一节点左侧圆点 → 连线</li>
          <li>Cmd/Ctrl+Z 撤销,Cmd/Ctrl+Shift+Z 重做</li>
          <li>双击空白处放置文本节点</li>
          <li>节点右上拖动小圆点连接</li>
          <li>右侧 AI 助手可用自然语言请求</li>
        </ul>
      </div>
    </aside>
  )
}
