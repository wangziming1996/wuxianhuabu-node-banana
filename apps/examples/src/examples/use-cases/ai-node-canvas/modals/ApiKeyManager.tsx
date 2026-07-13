/**
 * API Key 管理面板 — 配置多渠道 Key + Base URL
 * 默认带 Agnes 已 enabled,用户可加其他 OpenAI-compatible 服务
 */
import { useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'

export function ApiKeyManager({ onClose }: { onClose: () => void }) {
  const providers = useSettingsStore((s) => s.providers)
  const setApiKey = useSettingsStore((s) => s.setApiKey)
  const setBaseUrl = useSettingsStore((s) => s.setBaseUrl)
  const setEnabled = useSettingsStore((s) => s.setEnabled)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [testState, setTestState] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({})

  async function testProvider(id: string, baseUrl: string, apiKey?: string) {
    setTestState((s) => ({ ...s, [id]: 'testing' }))
    try {
      const headers: Record<string, string> = {}
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
      const r = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/models`, { headers })
      if (r.ok || r.status === 401 || r.status === 403) {
        // 401/403 也是好消息 — 至少连得通
        setTestState((s) => ({ ...s, [id]: 'ok' }))
      } else {
        setTestState((s) => ({ ...s, [id]: 'fail' }))
      }
    } catch {
      setTestState((s) => ({ ...s, [id]: 'fail' }))
    }
  }

  return (
    <div className="nb-modal-backdrop" onClick={onClose}>
      <div className="nb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nb-modal-header">
          <h2>AI 接口设置</h2>
          <button className="nb-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="nb-modal-body">
          <p className="nb-hint">
            Agnes 是默认开启的,无需配置。如果你想用其他渠道(火山方舟 / 通义千问 / DeepSeek 等 OpenAI-compatible 服务),在这里添加。
          </p>
          {providers.map((p) => (
            <div key={p.id} className="nb-provider-card">
              <div className="nb-provider-header">
                <label>
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => setEnabled(p.id, e.target.checked)}
                    disabled={p.isDefault}
                  />
                  <strong>{p.label}</strong>
                  {p.isDefault && <small className="nb-default-badge">默认</small>}
                </label>
                <span className={`nb-test-badge nb-test-${testState[p.id] || 'idle'}`}>
                  {testState[p.id] || '未测'}
                </span>
              </div>

              <div className="nb-row">
                <label>Base URL</label>
                <input
                  value={p.baseUrl}
                  placeholder="https://your-provider.com/v1"
                  onChange={(e) => setBaseUrl(p.id, e.target.value)}
                />
              </div>

              <div className="nb-row">
                <label>API Key</label>
                <input
                  type={showKey[p.id] ? 'text' : 'password'}
                  value={p.apiKey || ''}
                  placeholder={p.isDefault ? '使用 .env.local 默认' : '输入 API Key'}
                  onChange={(e) => setApiKey(p.id, e.target.value)}
                />
                <button className="nb-icon-btn" onClick={() => setShowKey((s) => ({ ...s, [p.id]: !s[p.id] }))}>
                  {showKey[p.id] ? '隐藏' : '显示'}
                </button>
              </div>

              <div className="nb-row">
                <label>模型</label>
                <div className="nb-model-chips">
                  {p.models.map((m) => (
                    <span key={m} className="nb-chip">{m}</span>
                  ))}
                </div>
              </div>

              {p.enabled && (
                <div className="nb-row">
                  <button
                    className="nb-secondary-btn"
                    onClick={() => testProvider(p.id, p.baseUrl, p.apiKey)}
                  >
                    {testState[p.id] === 'testing' ? '测试中…' : '测试连接'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="nb-modal-footer">
          <button className="nb-primary-btn" onClick={onClose}>完成</button>
        </div>
      </div>
    </div>
  )
}
