/**
 * 简易成本簿记 — 每次生成调用记一行,后续可聚合显示在右上角
 * 模型本身没有公开单位价时,用相对 token 数估算
 */

export interface CostRecord {
  id: string
  timestamp: number
  provider: string
  model: string
  kind: 'image' | 'video' | 'text' | 'agent'
  estimatedTokens: number
  estimatedCostUSD: number
  durationMs: number
  status: 'ok' | 'failed' | 'cancelled'
}

let _records: CostRecord[] = []
const listeners = new Set<() => void>()

export function getCostRecords(): CostRecord[] {
  return _records.slice()
}

export function totalCost(): number {
  return _records.reduce((acc, r) => acc + r.estimatedCostUSD, 0)
}

export function addRecord(rec: Omit<CostRecord, 'id' | 'timestamp'>): CostRecord {
  const full: CostRecord = {
    ...rec,
    id: Math.random().toString(36).slice(2, 10),
    timestamp: Date.now(),
  }
  _records.push(full)
  listeners.forEach((cb) => cb())
  return full
}

/**
 * 非常粗略的 USD 估算,只为给用户一个量级感
 * Agnes 在写文档时定价没公开,所以这只是 placeholder
 */
export function estimateImageCost(model: string): { tokens: number; usd: number } {
  const TOKENS_PER_IMAGE = 1500
  const usdPerK = model.includes('nano-banana') ? 0.06 : model.includes('flash') ? 0.012 : 0.04
  return { tokens: TOKENS_PER_IMAGE, usd: (TOKENS_PER_IMAGE / 1000) * usdPerK }
}

export function estimateVideoCost(model: string): { tokens: number; usd: number } {
  const TOKENS_PER_VIDEO = 8000
  const usdPerK = 0.08
  return { tokens: TOKENS_PER_VIDEO, usd: (TOKENS_PER_VIDEO / 1000) * usdPerK }
}

export function estimateTextCost(model: string, messageCount: number): { tokens: number; usd: number } {
  const tokens = 2000 * messageCount
  const usdPerK = 0.002
  return { tokens, usd: (tokens / 1000) * usdPerK }
}

export function subscribeCosts(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
