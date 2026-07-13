/**
 * Node Banana 复刻 — 主组件
 * 数据流:Canvas store = 编辑主存,Project store = 持久化元数据,自动保存定时把 Canvas 写入 IDB
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useReactFlow } from 'reactflow'
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
import { newId } from './utils/ulid'

function NodeCanvasInner() {
  const rf = useReactFlow()
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
      const idbList = await (await import('./utils/idb')).listProjects()
      const proj = idbList.find((p) => p.id === useProjectStore.getState().currentId)
      if (proj) {
        setAll(proj.nodes as any, proj.edges as any)
      }
      // 把 canvas 当前快照 getter 给 auto-save(走 store 直接读,避免 window 全局丢失)
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

  /* 把 canvas / project store 当前快照暴露到 window,供自动保存回调 + 测试钩子使用 */
  useEffect(() => {
    ;(window as any).__NB_CANVAS = { nodes, edges }
    ;(window as any).__NB_CANVAS_STORE = useCanvasStore
    ;(window as any).__NB_PROJECT_STORE = useProjectStore
    setDirty(true)
  }, [nodes, edges, setDirty])


  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    const file = files[0]
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const pos = rf.screenToFlowPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      const id = useCanvasStore.getState().addNode('image', pos, {
        title: file.name.replace(/\.[^.]+$/, ''),
        prompt: '',
        imageUrl: dataUrl,
        size: '1:1',
        count: 1,
        model: 'agnes-image-2.0-flash',
        status: 'done',
      } as any)
      // 入历史(kind='uploaded')
      const proj = useProjectStore.getState()
      if (proj.currentId) {
        proj.recordHistory({
          id: newId('h'),
          projectId: proj.currentId,
          nodeId: id,
          kind: 'uploaded',
          title: file.name,
          imageUrl: dataUrl,
          createdAt: Date.now(),
        })
      }
    } catch (err) {
      console.error('[upload] failed:', err)
    }
  }

  const handleDropOnFlow = useCallback((e: any) => handleDrop(e as any), [])
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

        <div
          className="nb-canvas-area"
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
          onDrop={handleDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onDrop={handleDropOnFlow}
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
