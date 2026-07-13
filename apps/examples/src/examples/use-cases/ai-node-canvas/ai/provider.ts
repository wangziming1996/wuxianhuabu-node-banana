/**
 * AI Provider 抽象层
 * - 现在阶段 1-2 默认走 Agnes(OpenAI-compatible at https://apihub.agnes-ai.com)
 * - UI 在 settings 面板提供 Key + Base URL 覆盖
 * - provider.execute() 内部把 fetch 拼成统一签名
 */
import type { ProviderSetting } from '../types'

export interface ImageGenRequest {
  model: string
  prompt: string
  size: string                // e.g. "1024x1024" or "1152x648"
  count: number
  sourceImageUrls?: string[]
}

export interface ImageGenResult {
  imageUrls: string[]
  model: string
  referenceCount: number
  imageCount: number
}

export interface VideoGenRequest {
  model: string
  prompt: string
  ratio: string               // 16:9, 9:16, etc.
  images: { url: string; role?: string }[]   // role: first_frame, last_frame, reference_image
}

export interface VideoGenSubmitResult {
  taskId: string
  videoId?: string
}

export interface VideoTaskResult {
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired' | 'completed'
  videoUrl?: string
  progress?: number
  warning?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  canvasSummary?: string
  referenceImages?: { id: string; label: string; imageUrl: string }[]
}

export interface ChatResult {
  message: string
  thinking: string[]
  action: 'answer' | 'create_prompt' | 'generate_image'
  prompt?: string
  size?: '1:1' | '3:4' | '4:3' | '16:9' | '9:16'
  count?: number
  model?: string
}

export interface ReversePromptRequest {
  imageUrl: string
  imageTitle?: string
  instruction?: string
}

export interface ReversePromptResult {
  prompt: string
  model: string
}

export interface Provider {
  listModels(signal?: AbortSignal): Promise<{ image: string[]; video: string[]; text: string[] }>
  generateImage(req: ImageGenRequest, signal?: AbortSignal): Promise<ImageGenResult>
  generateVideo(req: VideoGenRequest, signal?: AbortSignal): Promise<VideoGenSubmitResult>
  pollVideo(taskId: string, signal?: AbortSignal): Promise<VideoTaskResult>
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResult>
  reversePrompt(req: ReversePromptRequest, signal?: AbortSignal): Promise<ReversePromptResult>
}

/**
 * 一个统一的 HTTP Provider — 假设 backend (/api/*) 已经做好协议适配
 * 这样不论 backend 跑在哪个 provider 上,我们前端只发标准请求
 */
export class BackendHttpProvider implements Provider {
  constructor(private base: string = '') {}

  private url(p: string) {
    return (this.base || '') + p
  }

  async listModels() {
    const r = await fetch(this.url('/api/ai-models'))
    const data = await r.json()
    return {
      image: (data.imageModels || []).map((m: any) => m.id),
      video: ['agnes-video-v2.0'],
      text: (data.textModels || []).map((m: any) => m.id),
    }
  }

  async generateImage(req: ImageGenRequest, signal?: AbortSignal): Promise<ImageGenResult> {
    const r = await fetch(this.url('/api/generate-image'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: req.prompt,
        model: req.model,
        size: req.size,
        count: req.count,
        sourceImageUrls: req.sourceImageUrls,
      }),
      signal,
    })
    const data = await r.json()
    if (!r.ok || !data.imageUrls) {
      throw new Error(data.error || `Image gen failed (${r.status})`)
    }
    return {
      imageUrls: data.imageUrls,
      model: data.model || req.model,
      referenceCount: data.referenceCount || 0,
      imageCount: data.imageCount || data.imageUrls.length,
    }
  }

  async generateVideo(req: VideoGenRequest, signal?: AbortSignal): Promise<VideoGenSubmitResult> {
    const r = await fetch(this.url('/api/generate-video'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    })
    const data = await r.json()
    if (!r.ok || !data.taskId) {
      throw new Error(data.error || `Video gen failed (${r.status})`)
    }
    return { taskId: data.taskId, videoId: data.videoId }
  }

  async pollVideo(taskId: string, signal?: AbortSignal): Promise<VideoTaskResult> {
    const r = await fetch(this.url(`/api/video-task?id=${encodeURIComponent(taskId)}`), { signal })
    const data = await r.json()
    if (!r.ok) {
      return { status: 'failed', warning: data.error || `poll failed ${r.status}` }
    }
    return {
      status: (data.status || 'queued') as any,
      videoUrl: data.videoUrl,
      progress: data.progress,
      warning: data.warning,
    }
  }

  cancelVideo(taskId: string): Promise<boolean> {
    return fetch(this.url(`/api/video-task?id=${encodeURIComponent(taskId)}`), {
      method: 'DELETE',
    })
      .then((r) => r.ok)
      .catch(() => false)
  }

  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResult> {
    const r = await fetch(this.url('/api/agent-chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        canvasSummary: req.canvasSummary,
        referenceImages: req.referenceImages,
        autoGenerate: false,
      }),
      signal,
    })
    const data = await r.json()
    if (!r.ok) {
      throw new Error(data.error || `Chat failed (${r.status})`)
    }
    return {
      message: data.message || '',
      thinking: data.thinking || [],
      action: data.action || 'answer',
      prompt: data.prompt,
      size: data.size,
      count: data.count,
      model: data.model,
    }
  }

  async reversePrompt(req: ReversePromptRequest, signal?: AbortSignal): Promise<ReversePromptResult> {
    const r = await fetch(this.url('/api/analyze-image-prompt'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || `Reverse prompt failed (${r.status})`)
    return { prompt: data.prompt || '', model: data.model || 'unknown' }
  }
}

export const defaultProvider = new BackendHttpProvider()
