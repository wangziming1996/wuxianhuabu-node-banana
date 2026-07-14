/**
 * 音频节点 — UI 预览,不接实际生成 API(本次迭代不含音频后端)
 */
import { Handle, Position, type NodeProps } from 'reactflow'
import { useCanvasStore } from '../stores/canvasStore'
import type { AiCanvasNode } from '../types'
import { NodeDeleteButton } from './NodeChrome'

type Props = NodeProps<AiCanvasNode>

export function AudioNode({ id, data, selected }: Props) {
  const updateData = useCanvasStore((s) => s.updateNodeData)
  const audioData = data as any

  return (
    <div className={`nb-node nb-audio-node ${selected ? 'nb-selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="text" className="nb-handle nb-handle-text" />
      <Handle type="source" position={Position.Right} id="audio" className="nb-handle nb-handle-audio" />

      <div className="nb-node-header">
        <span className="nb-node-title">🔊 {audioData.title || '音频节点'}</span>
        <span className="nb-badge">预留</span>
      </div>

      <textarea
        className="nb-desc-input"
        placeholder="音频描述 / TTS 文案"
        rows={3}
        value={audioData.description || ''}
        onChange={(e) => updateData(id, { description: e.target.value } as any)}
      />

      {audioData.audioUrl ? (
        <audio controls src={audioData.audioUrl} />
      ) : (
        <div className="nb-image-placeholder">音频生成功能开发中</div>
      )}
    
        <NodeDeleteButton id={id} />
      </div>
  )
}
