/**
 * IndexedDB schema — `tap-node-banana` (与老 wuxianhuabu 的 `tap-ai-canvas-agent` 隔离)
 * Stores:
 *   - projects   (keyPath id, index by updatedAt)
 *   - media      (keyPath id, 用于图片缓存数据 URL 等)
 *   - settings   (keyPath id, 存 ProviderSetting 列表)
 *   - snapshots  (keyPath projectId, 自动定时快照用于恢复)
 *   - tasks      (keyPath id, 生成任务队列状态)
 */
import { openDB, type IDBPDatabase } from 'idb'
import type { ProjectDoc, ProviderSetting } from '../types'

const DB_NAME = 'tap-node-banana'
const DB_VERSION = 1

let _dbPromise: Promise<IDBPDatabase> | null = null

export function getDB(): Promise<IDBPDatabase> {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          const store = db.createObjectStore('projects', { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'projectId' })
        }
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id' })
        }
      },
    })
  }
  return _dbPromise
}

/* ---------------- 项目 CRUD ---------------- */
export async function listProjects(): Promise<ProjectDoc[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('projects', 'updatedAt')
  return all.reverse() // 最新的在前
}

export async function getProject(id: string): Promise<ProjectDoc | undefined> {
  const db = await getDB()
  return db.get('projects', id)
}

export async function putProject(p: ProjectDoc): Promise<void> {
  const db = await getDB()
  await db.put('projects', { ...p, updatedAt: Date.now() })
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('projects', id)
}

/* ---------------- 设置 ---------------- */
export async function saveProvider(setting: ProviderSetting): Promise<void> {
  const db = await getDB()
  await db.put('settings', setting)
}

export async function listProviders(): Promise<ProviderSetting[]> {
  const db = await getDB()
  return db.getAll('settings')
}

/* ---------------- 快照(自动恢复用) ---------------- */
export async function saveSnapshot(projectId: string, snapshot: ProjectDoc): Promise<void> {
  const db = await getDB()
  await db.put('snapshots', { projectId, ...snapshot, savedAt: Date.now() })
}

export async function getLatestSnapshot(projectId: string): Promise<ProjectDoc | undefined> {
  const db = await getDB()
  return db.get('snapshots', projectId)
}

/* ---------------- 存储空间探测 ---------------- */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number; percent: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  const est = await navigator.storage.estimate()
  if (!est.quota || !est.usage) return null
  return { usage: est.usage, quota: est.quota, percent: est.usage / est.quota }
}
