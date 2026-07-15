/**
 * 文本节点 — 输入文本,作为下游 image / character / agent 的 prompt 注入
 *
 * 2026-07 优化:
 *  - 节点宽度/高度随文本自动伸缩(260~600px 宽,高度按内容计算)
 *  - 头部新增"设置"按钮(⚙),点击展开下拉面板:
 *      字体大小 / 字体粗细 / 文字颜色 / 背景颜色 / 对齐方式 / 是否作为 prompt 注入
 *  - 支持斜杠命令:输入 /sixview 自动插一个 CustomNode 到画布并预填预设
 */
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from 'reactflow'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SLASH_COMMANDS, matchSlashCommand } from '../utils/slashCommands'
import { WORKFLOW_PRESETS } from '../ai/presets'
import { useCanvasStore } from '../stores/canvasStore'
import type {
  AiCanvasNode,
  TextAlign,
  TextBgToken,
  TextColorToken,
  TextFontSize,
  TextFontWeight,
  TextNodeData,
} from '../types'
import { newId } from '../utils/ulid'
import { NodeDeleteButton } from './NodeChrome'

type Props = NodeProps<AiCanvasNode>

// 文本节点的尺寸约束(px)
const MIN_WIDTH = 260
const MAX_WIDTH = 600
const HEADER_HEIGHT = 36
const FOOTER_GAP = 12
const PADDING_X = 24 // nb-node 自带 12px padding × 2
const PADDING_Y = 20

// 字体大小 → textarea font-size(px)
const FONT_SIZE_PX: Record<TextFontSize, number> = {
  sm: 12,
  md: 14,
  lg: 18,
  xl: 24,
}

const LINE_HEIGHT = 1.45

// 测量文本宽度(没有 DOM 也能跑)。粗略估算:中英文按 0.55 / 0.6 em 平均
function measureTextWidth(text: string, fontSize: number): number {
  if (!text) return 0
  let width = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) || 0
    // 简单分类:CJK / 全角 → 1em,其它 → 0.55em
    if (
      code >= 0x1100 && // Hangul Jamo
      (code <= 0x115f || // Hangul Jamo init
        (code >= 0x2e80 && code <= 0x303e) || // CJK Radicals + Kangxi
        (code >= 0x3041 && code <= 0x33ff) || // Hiragana/Katakana/CJK Symbols
        (code >= 0x3400 && code <= 0x4dbf) || // CJK Ext A
        (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
        (code >= 0xa000 && code <= 0xa4cf) || // Yi
        (code >= 0xac00 && code <= 0xd7a3) || // Hangul Syllables
        (code >= 0xf900 && code <= 0xfaff) || // CJK Compat Ideographs
        (code >= 0xfe30 && code <= 0xfe4f) || // CJK Compat Forms
        (code >= 0xff00 && code <= 0xff60) || // Fullwidth Forms
        (code >= 0xffe0 && code <= 0xffe6))
    ) {
      width += fontSize
    } else {
      width += fontSize * 0.55
    }
  }
  return width
}

function computeNodeSize(
  text: string,
  fontSize: TextFontSize,
  hasSettingsOpen: boolean,
  hasSlashHint: boolean,
  hasInsertedConfirm: boolean,
) {
  const fontPx = FONT_SIZE_PX[fontSize] || FONT_SIZE_PX.md

  // 取所有非空行中宽度最大的一行,按字符估算
  const lines = text.length ? text.split('\n') : ['']
  let maxLineChars = 0
  for (const line of lines) {
    if (line.length > maxLineChars) maxLineChars = line.length
  }
  // 用最宽的一行作为宽度估算(更准确应取最长行,但最长行字符串可能重复)
  let widestLine = ''
  for (const line of lines) {
    if (measureTextWidth(line, fontPx) > measureTextWidth(widestLine, fontPx)) {
      widestLine = line
    }
  }
  const textWidth = measureTextWidth(widestLine, fontPx)

  // 节点宽度:header(标题) / footer(提示) 至少要 260;
  // 文本内容加 PADDING_X 后夹在 [MIN, MAX] 内
  const minFromText = Math.ceil(textWidth) + PADDING_X
  const headerMin = 200 // "📝 文本节点 ⚙" 大约需要 200
  const minRequired = Math.max(MIN_WIDTH, headerMin)
  const desired = Math.max(minRequired, minFromText)
  const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, desired))

  // 高度:按行数算。空内容保留最小高度
  const lineCount = Math.max(1, lines.length)
  // 估算每行高度:fontSize * lineHeight
  const lineHeightPx = Math.ceil(fontPx * LINE_HEIGHT)
  // 如果文本被换行(单行太宽,会 wrap),按宽度反推视觉行数
  const usableWidth = width - PADDING_X
  let visualLines = 0
  for (const line of lines) {
    const lw = measureTextWidth(line, fontPx)
    const wraps = Math.max(1, Math.ceil(lw / Math.max(1, usableWidth)))
    visualLines += wraps
  }
  // 至少 3 行(避免创建后太矮)
  visualLines = Math.max(3, visualLines)

  const textHeight = visualLines * lineHeightPx + 20 // 内 padding
  let height = HEADER_HEIGHT + PADDING_Y + textHeight

  if (hasSlashHint || hasInsertedConfirm) height += 36
  if (hasSettingsOpen) height += 180

  return { width, height, visualLines, lineHeightPx, fontPx }
}

export function TextNode({ id, data, selected }: Props) {
  const updateData = useCanvasStore((s) => s.updateNodeData)
  const addNode = useCanvasStore((s) => s.addNode)
  const refInit = useUpdateNodeInternals()

  const [showSlashHint, setShowSlashHint] = useState(false)
  const [insertedPresetId, setInsertedPresetId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const d = data as unknown as TextNodeData
  const text = d.text || ''
  const fontSize: TextFontSize = d.fontSize || 'md'
  const fontWeight: TextFontWeight = d.fontWeight || 'normal'
  const align: TextAlign = d.align || 'left'
  const color: TextColorToken = d.color || 'default'
  const bg: TextBgToken = d.bg || 'transparent'
  const isPrompt = d.isPrompt ?? true

  const slashMatch = useMemo(() => matchSlashCommand(text, WORKFLOW_PRESETS), [text])

  const size = useMemo(
    () => computeNodeSize(text, fontSize, showSettings, !!slashMatch, !!insertedPresetId),
    [text, fontSize, showSettings, slashMatch, insertedPresetId],
  )

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const settingsRef = useRef<HTMLDivElement | null>(null)
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null)

  // 自动调整 textarea 内部高度(不改变节点高度,只是消除内部滚动条)
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text, fontSize])

  // 节点尺寸变化时通知 React Flow 重算 handle 位置
  useEffect(() => {
    refInit(id)
  }, [id, refInit, size.width, size.height])

  // 点击外部关闭设置面板
  useEffect(() => {
    if (!showSettings) return
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Node | null
      if (!target) return
      if (settingsRef.current?.contains(target)) return
      if (settingsBtnRef.current?.contains(target)) return
      setShowSettings(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [showSettings])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleInsertPreset()
    }
    // Esc 关闭设置面板
    if (e.key === 'Escape' && showSettings) {
      setShowSettings(false)
    }
  }

  function handleInsertPreset() {
    if (!slashMatch?.preset) return
    const preset = slashMatch.preset
    const cur = d as any
    const offsetX = cur.xOffset ?? 360
    const insertId = addNode('custom', { x: 0, y: 0 }, {
      title: preset.title,
      templateId: preset.id,
    } as any)
    setInsertedPresetId(insertId)
    updateData(id, { text: slashMatch.args || preset.description } as any)
    setTimeout(() => setInsertedPresetId(null), 1600)
  }

  function patchStyle(patch: Partial<TextNodeData>) {
    updateData(id, patch as any)
  }

  return (
    <div
      className={`nb-node nb-text-node nb-tx-${fontSize} nb-tx-w-${fontWeight} nb-tx-a-${align} nb-tx-c-${color} nb-tx-bg-${bg} ${selected ? 'nb-selected' : ''}`}
      style={{ width: size.width, minHeight: size.height }}
      data-node-width={size.width}
      data-testid="text-node"
    >
      <Handle type="target" position={Position.Left} id="text" className="nb-handle nb-handle-text" />
      <Handle type="source" position={Position.Right} id="text" className="nb-handle nb-handle-text" />

      <div className="nb-node-header">
        <span className="nb-node-title">📝 {(d as any).title || '文本节点'}</span>
        <div className="nb-text-node__header-actions">
          <button
            ref={settingsBtnRef}
            type="button"
            className={`nb-icon-btn ${showSettings ? 'is-active' : ''}`}
            onClick={() => setShowSettings((v) => !v)}
            aria-label="文本节点设置"
            title="文本设置"
            data-testid="text-node-settings-btn"
          >
            ⚙
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className="nb-text-input"
        placeholder="键入 / 触发工作流预设,例如 /sixview,然后 Ctrl+Enter"
        value={text}
        onChange={(e) => updateData(id, { text: e.target.value } as any)}
        onFocus={() => setShowSlashHint(true)}
        onBlur={() => setShowSlashHint(false)}
        onKeyDown={handleKeyDown}
        rows={1}
        data-testid="text-node-input"
      />

      {showSettings && (
        <div
          ref={settingsRef}
          className="nb-text-settings"
          onPointerDown={(e) => e.stopPropagation()}
          data-testid="text-node-settings"
        >
          <div className="nb-text-settings__row">
            <label>字号</label>
            <div className="nb-text-settings__group" role="radiogroup" aria-label="字号">
              {(['sm', 'md', 'lg', 'xl'] as TextFontSize[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`nb-chip ${fontSize === s ? 'is-on' : ''}`}
                  onClick={() => patchStyle({ fontSize: s })}
                  data-testid={`text-fs-${s}`}
                >
                  {s === 'sm' ? '小' : s === 'md' ? '中' : s === 'lg' ? '大' : '巨'}
                </button>
              ))}
            </div>
          </div>

          <div className="nb-text-settings__row">
            <label>粗细</label>
            <div className="nb-text-settings__group" role="radiogroup" aria-label="粗细">
              {(['normal', 'bold'] as TextFontWeight[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`nb-chip ${fontWeight === w ? 'is-on' : ''}`}
                  onClick={() => patchStyle({ fontWeight: w })}
                  data-testid={`text-fw-${w}`}
                >
                  {w === 'normal' ? '常规' : '加粗'}
                </button>
              ))}
            </div>
          </div>

          <div className="nb-text-settings__row">
            <label>对齐</label>
            <div className="nb-text-settings__group" role="radiogroup" aria-label="对齐">
              {(['left', 'center', 'right'] as TextAlign[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`nb-chip ${align === a ? 'is-on' : ''}`}
                  onClick={() => patchStyle({ align: a })}
                  data-testid={`text-align-${a}`}
                  title={a === 'left' ? '左对齐' : a === 'center' ? '居中' : '右对齐'}
                >
                  {a === 'left' ? '⇤' : a === 'center' ? '↔' : '⇥'}
                </button>
              ))}
            </div>
          </div>

          <div className="nb-text-settings__row">
            <label>文字</label>
            <div className="nb-text-settings__group" role="radiogroup" aria-label="文字颜色">
              {(
                [
                  ['default', '默认'],
                  ['muted', '灰'],
                  ['accent', '紫'],
                  ['success', '绿'],
                  ['danger', '红'],
                ] as [TextColorToken, string][]
              ).map(([c, label]) => (
                <button
                  key={c}
                  type="button"
                  className={`nb-chip nb-chip-color nb-chip-color-${c} ${color === c ? 'is-on' : ''}`}
                  onClick={() => patchStyle({ color: c })}
                  data-testid={`text-color-${c}`}
                  title={label}
                >
                  A
                </button>
              ))}
            </div>
          </div>

          <div className="nb-text-settings__row">
            <label>背景</label>
            <div className="nb-text-settings__group" role="radiogroup" aria-label="背景颜色">
              {(
                [
                  ['transparent', '透明'],
                  ['paper', '纸'],
                  ['sunken', '凹'],
                  ['accent', '紫'],
                ] as [TextBgToken, string][]
              ).map(([b, label]) => (
                <button
                  key={b}
                  type="button"
                  className={`nb-chip nb-chip-bg nb-chip-bg-${b} ${bg === b ? 'is-on' : ''}`}
                  onClick={() => patchStyle({ bg: b })}
                  data-testid={`text-bg-${b}`}
                  title={label}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="nb-text-settings__row nb-text-settings__row--toggle">
            <label htmlFor={`text-isPrompt-${id}`}>作为 Prompt 注入</label>
            <button
              id={`text-isPrompt-${id}`}
              type="button"
              role="switch"
              aria-checked={isPrompt}
              className={`nb-toggle ${isPrompt ? 'is-on' : ''}`}
              onClick={() => patchStyle({ isPrompt: !isPrompt })}
              data-testid="text-isprompt-toggle"
            >
              <span className="nb-toggle__thumb" />
            </button>
          </div>
        </div>
      )}

      {slashMatch?.preset && (
        <div className="nb-slash-hint nb-slash-match">
          <strong>{slashMatch.command}</strong> → 已识别预设 <em>{slashMatch.preset.title}</em>
          <button
            className="nb-primary-btn"
            onClick={handleInsertPreset}
            style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
            data-testid="insert-preset-btn"
          >
            插入
          </button>
        </div>
      )}

      {insertedPresetId && (
        <div className="nb-slash-hint nb-slash-confirm" data-testid="insert-confirm">
          ✓ 已插入预设节点 {insertedPresetId.slice(-6)}
        </div>
      )}

      {showSlashHint && !slashMatch && !showSettings && (
        <div className="nb-slash-hint nb-slash-list">
          {SLASH_COMMANDS.map((c) => (
            <div key={c.slug} className="nb-slash-item">
              <code>/{c.slug}</code>
              <span>{c.title}</span>
              <small>{c.description}</small>
            </div>
          ))}
        </div>
      )}

      <NodeDeleteButton id={id} />
    </div>
  )
}
