/**
 * 画布 store — 用 Zustand 替代 tldraw 的 reactive state
 * 数据源(初始化/保存):projectStore
 */
import { create } from 'zustand'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from 'reactflow'
import type { AiCanvasEdge, AiCanvasNode, AnyNodeData, NodeKind } from '../types'
import { useProjectStore } from './projectStore'

// 模块级 lazy 引用:canvas 修改 → 直接调 projectStore.setDirty,不走 useEffect,
// 避免 React Flow StoreUpdater ↔ nodes/edges useEffect 形成 setState 循环。


export interface CanvasState {
  nodes: AiCanvasNode[]
  edges: AiCanvasEdge[]
  viewport: Viewport
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  dirty: boolean

  /* mutations */
  setAll(nodes: AiCanvasNode[], edges: AiCanvasEdge[]): void
  applyNodeChanges(changes: NodeChange[]): void
  applyEdgeChanges(changes: EdgeChange[]): void
  onConnect(connection: Connection): void

  setViewport(v: Viewport): void

  addNode(kind: NodeKind, position: { x: number; y: number }, data?: Partial<AnyNodeData>): string
  removeSelected(): void
  updateNodeData(id: string, patch: Partial<AnyNodeData>): void
  setNodeStatus(id: string, status: 'idle' | 'generating' | 'done' | 'error', errorMessage?: string): void

  selectNodes(ids: string[]): void
  selectEdges(ids: string[]): void

  /* helpers */
  getUpstreamNodes(nodeId: string): AiCanvasNode[]
  getDownstreamNodes(nodeId: string): AiCanvasNode[]
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeIds: [],
  selectedEdgeIds: [],
  dirty: false,

  setAll: (nodes, edges) => set({ nodes, edges, dirty: false }),
  clearDirty: () => set({ dirty: false }),

  applyNodeChanges: (changes) => set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as AiCanvasNode[], dirty: true })),
  applyEdgeChanges: (changes) => set((s) => ({ edges: applyEdgeChanges(changes, s.edges) as AiCanvasEdge[], dirty: true })),

  onConnect: (conn) =>
    set((s) => {
      // avoid self-loop / duplicates
      if (conn.source === conn.target) return s
      const exists = s.edges.some(
        (e) => e.source === conn.source && e.target === conn.target && (e.sourceHandle || '') === (conn.sourceHandle || '')
      )
      if (exists) return s
      const edge: AiCanvasEdge = {
        id: `e_${conn.source}_${conn.target}_${Math.random().toString(36).slice(2, 7)}`,
        source: conn.source!,
        target: conn.target!,
        sourceHandle: conn.sourceHandle || undefined,
        targetHandle: conn.targetHandle || undefined,
      }
      return { edges: addEdge(edge, s.edges as any) as AiCanvasEdge[], dirty: true }
    }),

  setViewport: (v) => set({ viewport: v }),

  addNode: (kind, position, data) => {
    const id = `n_${Math.random().toString(36).slice(2, 10)}`
    const base: Record<NodeKind, AnyNodeData> = {
      image: {
        kind: 'image',
        title: data?.title || '图片节点',
        prompt: data?.prompt || '',
        size: '1:1',
        count: 1,
        model: data?.model || 'agnes-image-2.0-flash',
        status: 'idle',
      } as AnyNodeData,
      text: {
        kind: 'text',
        text: data?.text || '',
        isPrompt: true,
      } as AnyNodeData,
      character: {
        kind: 'character',
        title: data?.title || '新角色',
        description: data?.description || '',
      } as AnyNodeData,
      audio: {
        kind: 'audio',
        title: data?.title || '音频节点',
        description: data?.description || '',
      } as AnyNodeData,
      custom: {
        kind: 'custom',
        title: data?.title || '自定义节点',
        inputs: {},
      } as AnyNodeData,
    }
    const merged = { ...base[kind], ...(data as any) }
    const node: AiCanvasNode = {
      id,
      type: kind,
      position,
      data: merged,
    } as AiCanvasNode
    set((s) => ({ nodes: [...s.nodes, node], dirty: true }))
    return id
  },

  removeSelected: () =>
    set((s) => {
      const nodeSet = new Set(s.selectedNodeIds)
      const edgeSet = new Set(s.selectedEdgeIds)
      const newEdges = s.edges.filter((e) => !edgeSet.has(e.id) && !nodeSet.has(e.source) && !nodeSet.has(e.target))
      const newNodes = s.nodes.filter((n) => !nodeSet.has(n.id))
      return { nodes: newNodes, edges: newEdges, selectedNodeIds: [], selectedEdgeIds: [] }
    }),

  updateNodeData: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? ({ ...n, data: { ...n.data, ...patch } as AnyNodeData } as AiCanvasNode) : n)),
      dirty: true,
    })),

  setNodeStatus: (id, status, errorMessage) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id && (n.data as any).status !== undefined
          ? { ...n, data: { ...n.data, status, errorMessage } as AnyNodeData } as AiCanvasNode
          : n
      ),
      dirty: true,
    })),

  selectNodes: (ids) => set({ selectedNodeIds: ids }),
  selectEdges: (ids) => set({ selectedEdgeIds: ids }),

  getUpstreamNodes: (nodeId) => {
    const s = get()
    const upstreamIds = new Set(s.edges.filter((e) => e.target === nodeId).map((e) => e.source))
    return s.nodes.filter((n) => upstreamIds.has(n.id))
  },

  getDownstreamNodes: (nodeId) => {
    const s = get()
    const downstreamIds = new Set(s.edges.filter((e) => e.source === nodeId).map((e) => e.target))
    return s.nodes.filter((n) => downstreamIds.has(n.id))
  },
}))
