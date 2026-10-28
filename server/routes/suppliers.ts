import { Router } from 'express'
import { z } from 'zod'
import { execute, query } from '../db.js'
import { AppError } from '../errors.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { writeAuditLog } from '../services/audit.js'

const router = Router()
router.use(requireAuth)

const emptyToUndefined = (val: unknown) => (typeof val === 'string' && val.trim() === '' ? undefined : val)

const supplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.preprocess(emptyToUndefined, z.string().trim().email().optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  address: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
})

router.get('/', async (_request, response) => {
  const suppliers = await query('SELECT id, name, email, phone, address, is_demo FROM suppliers WHERE archived_at IS NULL ORDER BY name')
  response.json({ suppliers })
})

router.post('/', requireRole('admin'), async (request, response) => {
  const input = supplierSchema.parse(request.body)
  const [result] = await execute(
    'INSERT INTO suppliers (name, email, phone, address, is_demo) VALUES (?, ?, ?, ?, 0)',
    [input.name, input.email ?? null, input.phone ?? null, input.address ?? null],
  )
  const id = Number(result.insertId)
  await writeAuditLog({ userId: request.user?.id, action: 'CREATE', entityType: 'supplier', entityId: id, metadata: { name: input.name } })
  response.status(201).json({ id })
})

router.patch('/:id', requireRole('admin'), async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const input = supplierSchema.partial().parse(request.body)
  const fields = Object.entries(input).filter(([, v]) => v !== undefined)
  if (!fields.length) throw new AppError(400, 'At least one field is required', 'EMPTY_UPDATE')
  const [result] = await execute(
    `UPDATE suppliers SET ${fields.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ? AND archived_at IS NULL`,
    [...fields.map(([, val]) => val ?? null), id],
  )
  if (!result.affectedRows) throw new AppError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND')
  await writeAuditLog({ userId: request.user?.id, action: 'UPDATE', entityType: 'supplier', entityId: id, metadata: input })
  response.status(204).send()
})

router.delete('/:id', requireRole('admin'), async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const [result] = await execute('UPDATE suppliers SET archived_at = UTC_TIMESTAMP() WHERE id = ? AND archived_at IS NULL', [id])
  if (!result.affectedRows) throw new AppError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND')
  await writeAuditLog({ userId: request.user?.id, action: 'ARCHIVE', entityType: 'supplier', entityId: id })
  response.status(204).send()
})

export default router

