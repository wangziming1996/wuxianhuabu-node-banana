/**
 * 右侧 AI 助手面板 — 与 Canvas Agent 对话,产出 prompt / image
 * 复刻 Node Banana 的 /api/agent 模式
 */
import { useState } from 'react'
import { useCanvasStore } from '../stores/canvasStore'
import { useSettingsStore } from '../stores/settingsStore'
import { defaultProvider } from '../ai/provider'
import { runWithTaskSlot } from '../stores/taskStore'

type Msg = { id: string; role: 'user' | 'assistant'; content: string; action?: string; prompt?: string }

export function RightPanel() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好,我是创作助手。告诉我你想做什么,我会先理解再帮你放在画布上。',
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [autoGen, setAutoGen] = useState(false)
  const textModel = useSettingsStore((s) => s.defaultTextModel)
  const imageModel = useSettingsStore((s) => s.defaultImageModel)

  async function send() {
    if (!input.trim() || busy) return
    const userMsg: Msg = { id: `m_${Date.now()}`, role: 'user', content: input }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setBusy(true)
    try {
      const nodes = useCanvasStore.getState().nodes
      const summary = nodes
        .slice(-12)
        .map((n) => `[${n.type}] ${n.id.slice(-4)} ${(n.data as any).title || ''}`)
        .join('\n')
      await runWithTaskSlot('agnes', 'text', textModel, async () => {
        const result = await defaultProvider.chat({
          model: textModel,
          messages: messages.concat(userMsg).map((m) => ({ role: m.role, content: m.content })),
          canvasSummary: summary,
        })
        const aMsg: Msg = {
          id: `m_${Date.now() + 1}`,
          role: 'assistant',
          content: result.message || '(空响应)',
          action: result.action,
          prompt: result.prompt,
        }
        setMessages((m) => [...m, aMsg])
        if (autoGen && result.action === 'generate_image' && result.prompt) {
          const refImages: string[] = []
          for (const n of nodes) {
            const u = (n.data as any).imageUrl
            if (u && n.type === 'image') refImages.push(u)
          }
          await runWithTaskSlot('agnes', 'image', imageModel, async () => {
            const img = await defaultProvider.generateImage({
              prompt: result.prompt!,
              model: imageModel,
              size: '1024x1024',
              count: 1,
              sourceImageUrls: refImages.length ? refImages : undefined,
            })
            const x = 100 + Math.random() * 200
            const y = 100 + Math.random() * 200
            const id = useCanvasStore.getState().addNode('image', { x, y }, {
              title: 'Agent 生成',
              prompt: result.prompt,
              imageUrl: img.imageUrls[0],
              size: result.size || '1:1',
              count: result.count || 1,
              model: imageModel,
              status: 'done',
            })
            setMessages((m) => [...m, { id: `m_${Date.now() + 2}`, role: 'assistant', content: `已生成图片节点: ${id.slice(-6)}` }])
          })
        }
      })
    } catch (e: any) {
      setMessages((m) => [...m, { id: `e_${Date.now()}`, role: 'assistant', content: `错误: ${e?.message || e}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="nb-right-panel">
      <div className="nb-right-header">
        <h3>Agent 创作助手</h3>
        <label className="nb-auto-toggle">
          <input type="checkbox" checked={autoGen} onChange={(e) => setAutoGen(e.target.checked)} />
          <small>自动生成图片</small>
        </label>
      </div>

      <div className="nb-messages">
        {messages.map((m) => (
          <div key={m.id} className={`nb-msg nb-msg-${m.role}`}>
            <div className="nb-msg-content">{m.content}</div>
            {m.prompt && <pre className="nb-msg-prompt">{m.prompt}</pre>}
            {m.action && <div className="nb-msg-action">action = {m.action}</div>}
          </div>
        ))}
      </div>

      <div className="nb-input-row">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例如:画一盏未来感台灯,放在书房"
          rows={2}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
          }}
        />
        <button className="nb-primary-btn" onClick={send} disabled={busy || !input.trim()}>
          {busy ? '…' : '发送'}
        </button>
      </div>
    </aside>
  )
}
