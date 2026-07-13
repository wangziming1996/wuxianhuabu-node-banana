/**
 * Settings store — 多渠道 AI provider + 默认偏好
 * 默认就有 Agnes,用户可加其它 OpenAI-compatible
 */
import { create } from 'zustand'
import type { ProviderSetting } from '../types'

const DEFAULT_PROVIDERS: ProviderSetting[] = [
  {
    id: 'agnes',
    label: 'Agnes (默认)',
    baseUrl: 'https://apihub.agnes-ai.com',
    enabled: true,
    isDefault: true,
    models: ['agnes-image-2.0-flash', 'agnes-image-2.1-flash', 'agnes-2.0-flash'],
    supportsImage: true,
    supportsVideo: true,
    supportsText: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    enabled: false,
    models: ['gpt-image-1', 'dall-e-3', 'dall-e-2'],
    supportsImage: true,
    supportsVideo: false,
    supportsText: true,
  },
  {
    id: 'volcengine',
    label: '火山方舟',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    enabled: false,
    models: ['doubao-seedream-4-5-251128', 'doubao-seedream-5-0-260128'],
    supportsImage: true,
    supportsVideo: true,
    supportsText: true,
  },
  {
    id: 'dashscope',
    label: '通义千问/万相',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    enabled: false,
    models: ['qwen-image-2.0-pro', 'wan2.7-image-pro'],
    supportsImage: true,
    supportsVideo: true,
    supportsText: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    enabled: false,
    models: ['deepseek-chat', 'deepseek-reasoner'],
    supportsImage: false,
    supportsVideo: false,
    supportsText: true,
  },
  {
    id: 'custom',
    label: '自定义',
    baseUrl: '',
    enabled: false,
    models: [],
    supportsImage: true,
    supportsVideo: false,
    supportsText: true,
  },
]

export interface SettingsState {
  providers: ProviderSetting[]
  defaultImageModel: string
  defaultTextModel: string
  defaultVideoModel: string

  setProvider(id: string, patch: Partial<ProviderSetting>): void
  setApiKey(id: string, apiKey: string): void
  setBaseUrl(id: string, baseUrl: string): void
  setEnabled(id: string, enabled: boolean): void
  setDefaultImageModel(model: string): void
  setDefaultTextModel(model: string): void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  providers: DEFAULT_PROVIDERS,
  defaultImageModel: 'agnes-image-2.0-flash',
  defaultTextModel: 'agnes-2.0-flash',
  defaultVideoModel: 'agnes-video-v2.0',

  setProvider: (id, patch) =>
    set((s) => ({
      providers: s.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
  setApiKey: (id, apiKey) =>
    set((s) => ({
      providers: s.providers.map((p) => (p.id === id ? { ...p, apiKey } : p)),
    })),
  setBaseUrl: (id, baseUrl) =>
    set((s) => ({
      providers: s.providers.map((p) => (p.id === id ? { ...p, baseUrl } : p)),
    })),
  setEnabled: (id, enabled) =>
    set((s) => ({
      providers: s.providers.map((p) => (p.id === id ? { ...p, enabled } : p)),
    })),
  setDefaultImageModel: (m) => set({ defaultImageModel: m }),
  setDefaultTextModel: (m) => set({ defaultTextModel: m }),
}))
