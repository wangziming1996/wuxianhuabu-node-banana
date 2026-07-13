/**
 * 左侧节点面板 — 添加新节点 + 上传本地图片
 */
import { useCallback, useRef } from 'react'
import { useCanvasStore } from '../stores/canvasStore'
import { useProjectStore } from '../stores/projectStore'
import { newId } from '../utils/ulid'

const NODE_BUTTONS = [
  { kind: 'image', label: '图片', icon: '🖼', desc: '上传 / 生成 / 编辑' },
  { kind: 'text', label: '文本', icon: '📝', desc: 'Prompt 输入 / 斜杠命令' },
  { kind: 'character', label: '角色', icon: '🎭', desc: '三视图 / 设定稿' },
  { kind: 'audio', label: '音频', icon: '🔊', desc: 'TTS / 音效(预留)' },
  { kind: 'custom', label: '自定义', icon: '⚙', desc: '复用工作流预设' },
] as const

export function LeftSidebar() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addNode = useCanvasStore((s) => s.addNode)
  const recordHistory = useProjectStore((s) => s.recordHistory)
  const currentId = useProjectStore((s) => s.currentId)

  function addNodeAt(kind: any) {
    const x = 240 + Math.random() * 320
    const y = 160 + Math.random() * 240
    addNode(kind, { x, y })
  }

  const onUploadClick = () => fileInputRef.current?.click()

  const onUploadFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''  // 允许重新上传同一文件
    if (!file || !file.type.startsWith('image/')) return
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    const id = addNode('image', { x: 300, y: 200 }, {
      title: file.name.replace(/\.[^.]+$/, ''),
      imageUrl: dataUrl,
      prompt: '',
      size: '1:1',
      count: 1,
      model: 'agnes-image-2.0-flash',
      status: 'done',
    } as any)
    if (currentId) {
      recordHistory({
        id: newId('h'),
        projectId: currentId,
        nodeId: id,
        kind: 'uploaded',
        title: file.name,
        imageUrl: dataUrl,
        createdAt: Date.now(),
      })
    }
  }, [addNode, currentId, recordHistory])

  return (
    <aside className="nb-left-sidebar">
      <div className="nb-sidebar-section">
        <h3>添加节点</h3>
        <div className="nb-node-buttons">
          {NODE_BUTTONS.map((b) => (
            <button key={b.kind} className="nb-add-node-btn" onClick={() => addNodeAt(b.kind)} title={b.desc}>
              <span className="nb-icon">{b.icon}</span>
              <span className="nb-label">{b.label}</span>
              <small>{b.desc}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="nb-sidebar-section">
        <h3>本地上传</h3>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onUploadFile}
          data-testid="upload-input"
        />
        <button className="nb-secondary-btn" onClick={onUploadClick} data-testid="upload-btn">
          📂 上传图片
        </button>
        <small className="nb-upload-hint">或拖图到右侧画布</small>
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
