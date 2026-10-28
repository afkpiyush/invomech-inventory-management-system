import { Router } from 'express'
import { z } from 'zod'
import { execute, query, transaction } from '../db.js'
import { AppError } from '../errors.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { writeAuditLog } from '../services/audit.js'
import { evaluateLowStock } from '../services/alerts.js'

const router = Router()
router.use(requireAuth)

const productSchema = z.object({
  sku: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(160),
  categoryId: z.number().int().positive(),
  quantity: z.number().int().min(0),
  minimumQuantity: z.number().int().min(0),
  reorderQuantity: z.number().int().min(1),
  unitPrice: z.number().nonnegative(),
})
const productUpdateSchema = productSchema.omit({ quantity: true }).partial()
const movementSchema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.number().int().min(0),
  reason: z.string().trim().min(3).max(500),
})

router.get('/movements', async (request, response) => {
  const limit = z.coerce.number().int().min(1).max(500).default(100).parse(request.query.limit)
  const rows = await query(
    `SELECT sm.id, sm.product_id, p.name AS product_name, p.sku, sm.movement_type, sm.quantity,
            sm.reason, sm.quantity_after, sm.unit_price, sm.movement_date, u.name AS user_name
     FROM stock_movements sm
     JOIN products p ON p.id = sm.product_id
     LEFT JOIN users u ON u.id = sm.user_id
     ORDER BY sm.movement_date DESC
     LIMIT ?`,
    [limit],
  )
  response.json({ movements: rows })
})

router.get('/', async (request, response) => {
  const search = z.string().trim().max(100).optional().parse(request.query.search)
  const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []
  const rows = await query(
    `SELECT p.id, p.sku, p.name, c.name AS category, p.quantity, p.minimum_quantity, p.reorder_quantity, p.unit_price,
            CASE WHEN p.quantity <= p.minimum_quantity / 2 THEN 'Critical'
                 WHEN p.quantity <= p.minimum_quantity THEN 'Low Stock'
                 ELSE 'In Stock' END AS status
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.archived_at IS NULL ${search ? 'AND (p.name LIKE ? OR p.sku LIKE ? OR c.name LIKE ?)' : ''}
     ORDER BY p.updated_at DESC`,
    params,
  )
  response.json({ products: rows })
})

router.post('/', async (request, response) => {
  const input = productSchema.parse(request.body)
  const result = await transaction(async (connection) => {
    const [insert] = await connection.execute(
      'INSERT INTO products (sku, name, category_id, quantity, minimum_quantity, reorder_quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [input.sku, input.name, input.categoryId, input.quantity, input.minimumQuantity, input.reorderQuantity, input.unitPrice],
    )
    const id = Number((insert as { insertId: number }).insertId)
    if (input.quantity > 0) {
      await connection.execute(
        'INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, reason, quantity_after, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, request.user?.id ?? null, 'IN', input.quantity, 'Opening balance', input.quantity, input.unitPrice],
      )
    }
    await writeAuditLog({ userId: request.user?.id, action: 'CREATE', entityType: 'product', entityId: id }, connection)
    return id
  })
  await evaluateLowStock()
  response.status(201).json({ id: result })
})

router.patch('/:id', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const input = productUpdateSchema.parse(request.body)
  const fields = Object.entries(input)
  if (!fields.length) throw new AppError(400, 'At least one field is required', 'EMPTY_UPDATE')
  const map: Record<string, string> = { categoryId: 'category_id', minimumQuantity: 'minimum_quantity', reorderQuantity: 'reorder_quantity', unitPrice: 'unit_price' }
  const [result] = await execute(
    `UPDATE products SET ${fields.map(([key]) => `${map[key] ?? key} = ?`).join(', ')}, updated_at = UTC_TIMESTAMP() WHERE id = ? AND archived_at IS NULL`,
    [...fields.map(([, value]) => value), id],
  )
  if (!result.affectedRows) throw new AppError(404, 'Product not found', 'PRODUCT_NOT_FOUND')
  await writeAuditLog({ userId: request.user?.id, action: 'UPDATE', entityType: 'product', entityId: id, metadata: input })
  await evaluateLowStock()
  response.status(204).send()
})

router.post('/:id/movements', async (request, response) => {
  const productId = z.coerce.number().int().positive().parse(request.params.id)
  const input = movementSchema.parse(request.body)
  if ((input.type === 'IN' || input.type === 'OUT') && input.quantity <= 0) {
    throw new AppError(400, 'Quantity must be greater than zero for IN or OUT movements', 'INVALID_QUANTITY')
  }
  await transaction(async (connection) => {
    const [rows] = await connection.query({ sql: 'SELECT quantity, unit_price FROM products WHERE id = ? AND archived_at IS NULL FOR UPDATE', values: [productId] })
    const product = (rows as Array<{ quantity: number; unit_price: number }>)[0]
    if (!product) throw new AppError(404, 'Product not found', 'PRODUCT_NOT_FOUND')
    const next = input.type === 'IN' ? product.quantity + input.quantity : input.type === 'OUT' ? product.quantity - input.quantity : input.quantity
    if (next < 0) throw new AppError(400, 'Stock cannot become negative', 'INSUFFICIENT_STOCK')
    await connection.execute('UPDATE products SET quantity = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [next, productId])
    await connection.execute(
      'INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, reason, quantity_after, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [productId, request.user?.id ?? null, input.type, input.quantity, input.reason, next, product.unit_price],
    )
    await writeAuditLog({ userId: request.user?.id, action: 'STOCK_MOVEMENT', entityType: 'product', entityId: productId, metadata: input }, connection)
  })
  await evaluateLowStock()
  response.status(201).json({ ok: true })
})

router.delete('/:id', requireRole('admin'), async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const [result] = await execute('UPDATE products SET archived_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = ? AND archived_at IS NULL', [id])
  if (!result.affectedRows) throw new AppError(404, 'Product not found', 'PRODUCT_NOT_FOUND')
  await execute('UPDATE alerts SET status = "RESOLVED", resolved_at = UTC_TIMESTAMP() WHERE product_id = ? AND status IN ("OPEN", "ACKNOWLEDGED")', [id])
  await writeAuditLog({ userId: request.user?.id, action: 'ARCHIVE', entityType: 'product', entityId: id })
  response.status(204).send()
})

export default router

