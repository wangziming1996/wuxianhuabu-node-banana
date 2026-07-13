/**
 * Task store — 生成任务队列 + 并发限制
 * Agnes API 没有明显限流,但我们用一个 per-provider semaphore 防止前端同时狂点
 */
import { create } from 'zustand'
import { ulid } from 'ulid'
import { estimateImageCost, estimateVideoCost, estimateTextCost } from '../ai/cost'

export type TaskKind = 'image' | 'video' | 'text' | 'agent'
export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface TaskRecord {
  id: string
  providerId: string
  kind: TaskKind
  status: TaskStatus
  startedAt: number | null
  endedAt: number | null
  progress: number
  errorMessage?: string
  model: string
}

export interface TaskState {
  tasks: TaskRecord[]
  submit(providerId: string, kind: TaskKind, model: string): TaskRecord
  update(id: string, patch: Partial<TaskRecord>): void
  remove(id: string): void
  clear(): void
  runningCount(): number
  costUSD(): number
}

const MAX_CONCURRENT = 3

let _waitQueue: Array<() => void> = []

async function withSlot(): Promise<void> {
  const s = useTaskStore.getState()
  if (s.runningCount() < MAX_CONCURRENT) return
  await new Promise<void>((resolve) => _waitQueue.push(resolve))
}

function _release() {
  const next = _waitQueue.shift()
  if (next) next()
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  submit: (providerId, kind, model) => {
    const t: TaskRecord = {
      id: ulid(),
      providerId,
      kind,
      status: 'queued',
      startedAt: null,
      endedAt: null,
      progress: 0,
      model,
    }
    set((s) => ({ tasks: [t, ...s.tasks] }))
    return t
  },
  update: (id, patch) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  remove: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
  clear: () => set({ tasks: [] }),
  runningCount: () => get().tasks.filter((t) => t.status === 'running').length,
  costUSD: () => {
    // stub — 真正成本聚合从 cost 那边统计
    return 0
  },
}))

export async function runWithTaskSlot<T>(
  providerId: string,
  kind: TaskKind,
  model: string,
  work: (taskId: string, update: (p: Partial<TaskRecord>) => void) => Promise<T>
): Promise<T> {
  const task = useTaskStore.getState().submit(providerId, kind, model)
  const update = (p: Partial<TaskRecord>) => useTaskStore.getState().update(task.id, p)
  update({ status: 'queued' })
  await withSlot()
  update({ status: 'running', startedAt: Date.now(), progress: 0 })
  const t0 = Date.now()
  let cost
  if (kind === 'image') cost = estimateImageCost(model)
  else if (kind === 'video') cost = estimateVideoCost(model)
  else cost = estimateTextCost(model, 1)
  try {
    const res = await work(task.id, update)
    update({ status: 'succeeded', endedAt: Date.now(), progress: 100 })
    ;(await import('../ai/cost')).addRecord({
      provider: providerId,
      model,
      kind,
      estimatedTokens: cost.tokens,
      estimatedCostUSD: cost.usd,
      durationMs: Date.now() - t0,
      status: 'ok',
    })
    return res
  } catch (e: any) {
    update({ status: 'failed', endedAt: Date.now(), errorMessage: String(e?.message || e) })
    ;(await import('../ai/cost')).addRecord({
      provider: providerId,
      model,
      kind,
      estimatedTokens: cost.tokens,
      estimatedCostUSD: 0,
      durationMs: Date.now() - t0,
      status: 'failed',
    })
    throw e
  } finally {
    _release()
  }
}
