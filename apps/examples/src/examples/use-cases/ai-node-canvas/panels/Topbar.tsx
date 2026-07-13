/**
 * 顶栏 — 项目名 + 新建/打开/保存 + 存储空间 / 成本看板
 */
import { useEffect, useState } from 'react'
import { useProjectStore, initProjectStore } from '../stores/projectStore'
import { getStorageEstimate } from '../utils/idb'
import { getCostRecords, subscribeCosts } from '../ai/cost'

export function Topbar({ onOpenSettings, onOpenPresets }: { onOpenSettings: () => void; onOpenPresets: () => void }) {
  const currentId = useProjectStore((s) => s.currentId)
  const currentName = useProjectStore((s) => s.currentName)
  const projects = useProjectStore((s) => s.projects)
  const dirty = useProjectStore((s) => s.dirty)
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt)
  const setName = useProjectStore((s) => s.setName)
  const saveCurrent = useProjectStore((s) => s.saveCurrent)
  const newProject = useProjectStore((s) => s.newProject)
  const openProject = useProjectStore((s) => s.openProject)
  const deleteProject = useProjectStore((s) => s.deleteProject)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [editingName, setEditingName] = useState(false)

  // 存储空间探测
  const [storage, setStorage] = useState<{ usage: number; quota: number; percent: number } | null>(null)
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const e = await getStorageEstimate()
      if (!cancelled) setStorage(e)
    }
    check()
    const t = setInterval(check, 30000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  // 成本簿记聚合
  const [costUSD, setCostUSD] = useState(0)
  const [costRecords, setCostRecords] = useState(0)
  useEffect(() => {
    const update = () => {
      const recs = getCostRecords()
      const total = recs.reduce((acc, r) => acc + r.estimatedCostUSD, 0)
      setCostUSD(total)
      setCostRecords(recs.length)
    }
    update()
    return subscribeCosts(update)
  }, [])

  useEffect(() => {
    // auto-save 由 AiNodeCanvasExample 启动并订阅 canvas store,这里只需初始化 IDB
    initProjectStore()
  }, [])

  const storageWarn = storage && storage.percent > 0.85
  return (
    <div className="nb-topbar">
      <div className="nb-topbar-left">
        <strong className="nb-brand">Node Banana</strong>

        {currentId && (
          <div className="nb-project-title">
            {editingName ? (
              <input
                value={currentName}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
                autoFocus
              />
            ) : (
              <span onDoubleClick={() => setEditingName(true)}>{currentName}</span>
            )}
            {!dirty && lastSavedAt && <small className="nb-saved-indicator">已保存 {timeAgo(lastSavedAt)}</small>}
            {dirty && <small className="nb-dirty-indicator">● 未保存</small>}
          </div>
        )}
      </div>

      <div className="nb-topbar-center">
        <button className="nb-secondary-btn" onClick={() => newProject()}>
          新建
        </button>
        <button className="nb-secondary-btn" onClick={() => setShowSwitcher(!showSwitcher)}>
          打开 ▾
        </button>
        {showSwitcher && (
          <div className="nb-switcher-menu">
            {projects.length === 0 && <div>暂无项目</div>}
            {projects.map((p) => (
              <div key={p.id} className={`nb-switcher-item ${p.id === currentId ? 'nb-active' : ''}`}>
                <span onClick={() => { openProject(p.id); setShowSwitcher(false) }}>{p.name}</span>
                {p.id !== currentId && (
                  <button
                    className="nb-icon-btn"
                    onClick={async () => {
                      if (confirm(`删除项目 ${p.name}?`)) {
                        await deleteProject(p.id)
                      }
                    }}
                    title="删除"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <button className="nb-secondary-btn" disabled={!dirty} onClick={() => saveCurrent(() => [], () => [], undefined)}>
          保存
        </button>
        <button className="nb-secondary-btn" onClick={onOpenPresets}>
          工作流预设
        </button>
      </div>

      <div className="nb-topbar-right">
        {/* 存储空间 - 总是渲染,navigator.storage 不可用时显示 — */}
        <div
          className={`nb-storage-widget ${storageWarn ? 'nb-storage-warn' : ''}`}
          title={storage ? `IndexedDB 存储用量 ${formatBytes(storage.usage)} / ${formatBytes(storage.quota)}` : "navigator.storage 不可用"}
          data-testid="storage-widget"
        >
          <span className="nb-storage-label">存储</span>
          <div className="nb-storage-bar">
            <div className="nb-storage-fill" style={{ width: storage ? `${(storage.percent * 100).toFixed(1)}%` : '0%' }} />
          </div>
          <span className="nb-storage-pct">{storage ? `${(storage.percent * 100).toFixed(1)}%` : '—'}</span>
        </div>
        {/* 成本 */}
        <div className="nb-cost-widget" title={`累计 ${costRecords} 次生成调用`}>
          <span className="nb-cost-label">成本</span>
          <span className="nb-cost-value">${costUSD.toFixed(4)}</span>
        </div>
        <button className="nb-secondary-btn" onClick={onOpenSettings}>
          ⚙ 设置
        </button>
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function timeAgo(ts: number): string {
  const ms = Date.now() - ts
  if (ms < 60_000) return '刚刚'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} 分钟前`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} 小时前`
  return `${Math.floor(ms / 86_400_000)} 天前`
}
