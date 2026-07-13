/**
 * Project store — 管多 project + 多 Tab 协调
 * **不** 存 nodes/edges 副本:这些只活在 canvasStore 里。project 只存元数据(name, timestamps, historyItems, thumbnail)。
 * 这样避开 useEffect 在 canvas 和 project 之间互相 update 的死循环。
 */
import { create } from 'zustand'
import { useCanvasStore } from './canvasStore'
import { ulid } from 'ulid'
import { getChannel, getTabId, publish, subscribe } from '../utils/broadcast'
import {
  deleteProject,
  listProjects,
  putProject,
} from '../utils/idb'
import type { HistoryItem } from '../types'

export interface ProjectMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  thumbnailDataUrl?: string
  historyItems: HistoryItem[]
}

export interface ProjectState {
  projects: ProjectMeta[]
  currentId: string | null
  currentName: string
  historyItems: HistoryItem[]
  dirty: boolean
  lastSavedAt: number | null

  loadAllProjects(): Promise<void>
  openProject(id: string): Promise<void>
  newProject(name?: string): Promise<void>
  saveCurrent(getNodes: () => any, getEdges: () => any, getThumbnail?: () => string | undefined): Promise<void>
  deleteProject(id: string): Promise<void>
  recordHistory(item: HistoryItem): void
  setName(name: string): void
  setDirty(d: boolean): void
  clearDirty(): void
}

async function ensureAuth() {
  // No-op for now — AuthGate is enforced elsewhere
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentId: null,
  currentName: '未命名项目',
  historyItems: [],
  dirty: false,
  lastSavedAt: null,

  loadAllProjects: async () => {
    const list = await listProjects()
    set({
      projects: list.map((p) => ({
        id: p.id,
        name: p.name,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        thumbnailDataUrl: p.thumbnailDataUrl,
        historyItems: p.historyItems,
      })),
    })
  },

  openProject: async (id) => {
    const list = await listProjects()
    const meta = list.find((x) => x.id === id)
    if (!meta) return
    set({
      currentId: id,
      currentName: meta.name,
      historyItems: meta.historyItems || [],
      dirty: false,
      lastSavedAt: meta.updatedAt,
    })
    publish({ type: 'project:loaded', projectId: id, tabId: getTabId() })
  },

  newProject: async (name) => {
    const id = ulid()
    const doc = {
      id,
      name: name || '未命名项目',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodes: [],
      edges: [],
      historyItems: [] as HistoryItem[],
      storageVersion: 2 as const,
    }
    await putProject(doc)
    const list = await listProjects()
    set({
      currentId: id,
      currentName: doc.name,
      historyItems: [],
      dirty: false,
      lastSavedAt: Date.now(),
      projects: list.map((p) => ({
        id: p.id,
        name: p.name,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        thumbnailDataUrl: p.thumbnailDataUrl,
        historyItems: p.historyItems,
      })),
    })
  },

  saveCurrent: async (getNodes, getEdges, getThumbnail) => {
    const { currentId, currentName, historyItems } = get()
    if (!currentId) return
    const doc = {
      id: currentId,
      name: currentName,
      createdAt: (get().projects.find((p) => p.id === currentId)?.createdAt) || Date.now(),
      updatedAt: Date.now(),
      nodes: getNodes(),
      edges: getEdges(),
      historyItems,
      thumbnailDataUrl: getThumbnail?.(),
      storageVersion: 2 as const,
    }
    await putProject(doc)
    const list = await listProjects()
    set({
      dirty: false,
      lastSavedAt: Date.now(),
      projects: list.map((p) => ({
        id: p.id,
        name: p.name,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        thumbnailDataUrl: p.thumbnailDataUrl,
        historyItems: p.historyItems,
      })),
    })
    publish({ type: 'project:save', projectId: currentId, tabId: getTabId(), updatedAt: doc.updatedAt })
  },

  deleteProject: async (id) => {
    await deleteProject(id)
    const list = await listProjects()
    set((s) => ({
      projects: list.map((p) => ({
        id: p.id,
        name: p.name,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        thumbnailDataUrl: p.thumbnailDataUrl,
        historyItems: p.historyItems,
      })),
      currentId: s.currentId === id ? null : s.currentId,
      historyItems: s.currentId === id ? [] : s.historyItems,
    }))
    publish({ type: 'project:delete', projectId: id, tabId: getTabId() })
  },

  recordHistory: (item) =>
    set((s) => ({ historyItems: [item, ...s.historyItems].slice(0, 50) })),

  setName: (name) => set({ currentName: name, dirty: true }),
  setDirty: (d) => set({ dirty: d }),
  clearDirty: () => set({ dirty: false, lastSavedAt: Date.now() }),
}))

/* 多 Tab 协调 */
export async function initProjectStore(): Promise<void> {
  await useProjectStore.getState().loadAllProjects()
  const list = useProjectStore.getState().projects
  if (list.length) {
    await useProjectStore.getState().openProject(list[0].id)
  } else {
    await useProjectStore.getState().newProject()
  }

  const ch = getChannel()
  if (ch) {
    subscribe(async (e) => {
      if (e.type === 'project:save' && e.tabId !== getTabId()) {
        window.dispatchEvent(
          new CustomEvent('node-banana:other-tab-saved', { detail: { projectId: e.projectId } })
        )
        await useProjectStore.getState().loadAllProjects()
      } else if (e.type === 'project:loaded' || e.type === 'project:delete') {
        await useProjectStore.getState().loadAllProjects()
      }
    })
  }
}

/* 自动保存:每 4 秒若 canvas dirty 则写 */
let autoSaveTimer: any = null
let getCurrentData: (() => { nodes: any; edges: any; thumbnail?: string }) | null = null
let lastSavedFingerprint: string = ''

export function startAutoSave(provider: () => { nodes: any; edges: any; thumbnail?: string }) {
  if (!getCurrentData) getCurrentData = provider
  if (autoSaveTimer) return
  autoSaveTimer = setInterval(async () => {
    if (!getCurrentData) return
    const canvasStore = useCanvasStore.getState()
    if (!canvasStore.dirty) return
    const projStore = useProjectStore.getState()
    if (!projStore.currentId) return
    const { nodes, edges, thumbnail } = getCurrentData()
    // 指纹去重:相同内容别重复写
    const fp = JSON.stringify({ nodes: nodes.length, edges: edges.length, lastNode: nodes.at(-1)?.id })
    if (fp === lastSavedFingerprint) return
    lastSavedFingerprint = fp
    await projStore.saveCurrent(() => nodes, () => edges, () => thumbnail)
    // save 成功,清 canvas 的 dirty
    useCanvasStore.setState({ dirty: false })
  }, 4000)
}
