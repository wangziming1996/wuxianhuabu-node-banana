/**
 * ID generation helpers — use ulid for sortable IDs
 */
import { ulid } from 'ulid'

export function newId(prefix?: string): string {
  const id = ulid()
  return prefix ? `${prefix}_${id}` : id
}
