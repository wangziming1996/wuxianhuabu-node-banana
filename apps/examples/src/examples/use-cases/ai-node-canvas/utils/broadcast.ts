/**
 * 多 Tab 协调:基于 BroadcastChannel
 * 每个 Tab 保存项目时广播 project:save 事件,其他 Tab 检测到非自己保存的写入,提示避免覆盖
 */
export type BroadcastEvent =
  | { type: 'project:save'; projectId: string; tabId: string; updatedAt: number }
  | { type: 'project:delete'; projectId: string; tabId: string }
  | { type: 'project:loaded'; projectId: string; tabId: string }
  | { type: 'storage:near-full'; percent: number }

const CHANNEL_NAME = 'tap-node-banana-bus'
const TAB_ID = Math.random().toString(36).slice(2, 10)

let _channel: BroadcastChannel | null = null

export function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!_channel) _channel = new BroadcastChannel(CHANNEL_NAME)
  return _channel
}

export function getTabId(): string {
  return TAB_ID
}

export function publish(event: BroadcastEvent): void {
  const ch = getChannel()
  if (ch) ch.postMessage(event)
}

export function subscribe(handler: (e: BroadcastEvent) => void): () => void {
  const ch = getChannel()
  if (!ch) return () => undefined
  const cb = (e: MessageEvent<BroadcastEvent>) => handler(e.data)
  ch.addEventListener('message', cb)
  return () => ch.removeEventListener('message', cb)
}
