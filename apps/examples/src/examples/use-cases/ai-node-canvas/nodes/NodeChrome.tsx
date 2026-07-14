/**
 * 节点外壳工具栏 — 选中时右上角悬浮 × 删除按钮
 * 在每种 node 组件的根 div 里加 <NodeDeleteButton id={id} />
 */
import { Handle, Position, type NodeProps } from 'reactflow'
import { useCanvasStore } from '../stores/canvasStore'
import type { AiCanvasNode } from '../types'

export function NodeDeleteButton({ id, label = '\u00d7' }: { id: string; label?: string }) {
  const applyNodeChanges = useCanvasStore((s) => s.applyNodeChanges)
  const remove = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    // 通过 applyNodeChanges 模拟 React Flow 的 'remove' 事件 — 它会走 applyNodeChanges 把这个节点从 nodes 数组里过滤掉
    applyNodeChanges([{ id, type: 'remove' } as any])
  }
  return (
    <button
      className="nb-node-delete"
      onClick={remove}
      onMouseDown={(e) => e.stopPropagation()}
      title="删除该节点(Delete)"
      data-testid={`node-delete-${id}`}
      type="button"
    >
      {label}
    </button>
  )
}

/**
 * 给 ImageNode 用的小 wrapper,确保右上角 × 在选中时显现
 */
export function NodeShell({ id, children, selected }: { id: string; children: React.ReactNode; selected?: boolean }) {
  return (
    <>
      {children}
      <NodeDeleteButton id={id} />
    </>
  )
}
