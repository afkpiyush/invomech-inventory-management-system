import type { PoolConnection } from 'mysql2/promise'
import { execute } from '../db.js'

export const writeAuditLog = async (input: {
  userId?: number
  action: string
  entityType: string
  entityId?: number
  metadata?: Record<string, unknown>
}, connection?: PoolConnection) => {
  const sql = `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata_json) VALUES (?, ?, ?, ?, ?)`
  const values = [input.userId ?? null, input.action, input.entityType, input.entityId ?? null, JSON.stringify(input.metadata ?? {})]
  if (connection) {
    await connection.execute(sql, values)
  } else {
    await execute(sql, values)
  }
}
