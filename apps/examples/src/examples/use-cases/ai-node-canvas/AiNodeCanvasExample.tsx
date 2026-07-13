/**
 * Node Banana 复刻 — 主组件
 * 数据流:Canvas store = 编辑主存,Project store = 持久化元数据,自动保存定时把 Canvas 写入 IDB
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { useCanvasStore } from './stores/canvasStore'
import { useProjectStore, initProjectStore, startAutoSave } from './stores/projectStore'
import { NODE_TYPES } from './nodes'
import { Topbar } from './panels/Topbar'
import { LeftSidebar } from './panels/LeftSidebar'
import { RightPanel } from './panels/RightPanel'
import { BottomHistoryPanel } from './panels/BottomHistoryPanel'
import { ApiKeyManager } from './modals/ApiKeyManager'
import { PresetPicker } from './modals/PresetPicker'

import './canvas.css'

function NodeCanvasInner() {
  const [showSettings, setShowSettings] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [otherTabWarning, setOtherTabWarning] = useState<string | null>(null)

  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const applyNodeChanges = useCanvasStore((s) => s.applyNodeChanges)
  const applyEdgeChanges = useCanvasStore((s) => s.applyEdgeChanges)
  const onConnect = useCanvasStore((s) => s.onConnect)
  const setAll = useCanvasStore((s) => s.setAll)
  const setDirty = useProjectStore((s) => s.setDirty)
  const currentId = useProjectStore((s) => s.currentId)
  const loadCurrent = useProjectStore((s) => s.openProject)
  const projects = useProjectStore((s) => s.projects)
  const newProject = useProjectStore((s) => s.newProject)

  /* 初始化:加载项目列表,创建/打开默认项目,把节点从 IDB 注入到 canvas store */
  const initRan = useRef(false)
  useEffect(() => {
    if (initRan.current) return
    initRan.current = true
    ;(async () => {
      await initProjectStore()
      if (!useProjectStore.getState().currentId) {
        const list = useProjectStore.getState().projects
        if (list.length) {
          await useProjectStore.getState().openProject(list[0].id)
        } else {
          await useProjectStore.getState().newProject()
        }
      }
      // 把当前项目的 nodes/edges 一次性灌到 canvas store
      const list = await (await fetch('/api/auth/session', { credentials: 'include' })).json()
      // 不能直接抓 session,从 listProjects 拉
      const idbList = await import('./utils/idb').then((m) => m.listProjects())
      const proj = idbList.find((p) => p.id === useProjectStore.getState().currentId)
      if (proj) {
        setAll(proj.nodes as any, proj.edges as any)
      }
      // 启 auto-save:把 canvas 当前快照传给持久化层
      startAutoSave(() => ({
        nodes: useCanvasStore.getState().nodes,
        edges: useCanvasStore.getState().edges,
      }))
    })()

    const handler = (e: any) => {
      setOtherTabWarning(`其他标签页已修改同一项目(${e.detail.projectId.slice(-6)}),继续编辑可能覆盖对方改动`)
    }
    window.addEventListener('node-banana:other-tab-saved', handler as any)
    return () => window.removeEventListener('node-banana:other-tab-saved', handler as any)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* 把 canvas store 当前快照暴露到 window,供自动保存回调读取 */
  useEffect(() => {
    ;(window as any).__NB_CANVAS = { nodes, edges }
    setDirty(true)
  }, [nodes, edges, setDirty])

  const onNodesChange = useCallback((changes: any) => applyNodeChanges(changes), [applyNodeChanges])
  const onEdgesChange = useCallback((changes: any) => applyEdgeChanges(changes), [applyEdgeChanges])
  const handleConnect = useCallback((conn: any) => onConnect(conn), [onConnect])

  return (
    <div className="nb-app-shell">
      <Topbar onOpenSettings={() => setShowSettings(true)} onOpenPresets={() => setShowPresets(true)} />

      {otherTabWarning && (
        <div className="nb-warning-banner" onClick={() => setOtherTabWarning(null)}>
          ⚠ {otherTabWarning} (点击关闭)
        </div>
      )}

      <div className="nb-main">
        <LeftSidebar />

        <div className="nb-canvas-area">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            nodeTypes={NODE_TYPES}
            fitView
            minZoom={0.2}
            maxZoom={2}
            nodeOrigin={[0.5, 0.5]}
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#333" />
            <Controls />
            <MiniMap pannable zoomable nodeStrokeWidth={2} maskColor="rgba(0,0,0,0.5)" />
          </ReactFlow>
        </div>

        <RightPanel />
      </div>

      <BottomHistoryPanel />

      {showSettings && <ApiKeyManager onClose={() => setShowSettings(false)} />}
      {showPresets && <PresetPicker onClose={() => setShowPresets(false)} />}
    </div>
  )
}

export default function AiNodeCanvasExample() {
  return (
    <ReactFlowProvider>
      <NodeCanvasInner />
    </ReactFlowProvider>
  )
}
