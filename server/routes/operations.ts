import { Router } from 'express'
import { z } from 'zod'
import { execute, query, transaction } from '../db.js'
import { AppError } from '../errors.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { writeAuditLog } from '../services/audit.js'
import { evaluateLowStock } from '../services/alerts.js'

const router = Router()
router.use(requireAuth)

router.get('/categories', async (_request, response) => {
  response.json({ categories: await query('SELECT id, name FROM categories ORDER BY name') })
})

router.get('/goods-received', async (_request, response) => {
  response.json({
    receipts: await query(
      `SELECT gr.id, gr.reference, gr.received_at, po.number, u.name AS received_by, s.name AS supplier
       FROM goods_receipts gr
       JOIN purchase_orders po ON po.id = gr.purchase_order_id
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN users u ON u.id = gr.received_by
       ORDER BY gr.received_at DESC`,
    ),
  })
})

router.post('/goods-received', async (request, response) => {
  const input = z.object({
    purchaseOrderId: z.number().int().positive(),
    reference: z.string().trim().max(120).optional(),
    items: z.array(z.object({ itemId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1),
  }).parse(request.body)

  await transaction(async (connection) => {
    const [orderRows] = await connection.query({
      sql: `SELECT id, status FROM purchase_orders WHERE id = ? AND status IN ('APPROVED', 'DISPATCHED', 'PARTIALLY_RECEIVED') FOR UPDATE`,
      values: [input.purchaseOrderId],
    })
    if (!(orderRows as Array<{ id: number }>)[0]) throw new AppError(409, 'Purchase order is not receivable', 'PO_RECEIPT_INVALID')
    const [receipt] = await connection.execute('INSERT INTO goods_receipts (purchase_order_id, received_by, reference) VALUES (?, ?, ?)', [input.purchaseOrderId, request.user?.id ?? null, input.reference ?? null])
    const receiptId = (receipt as { insertId: number }).insertId

    for (const item of input.items) {
      const [itemRows] = await connection.query({
        sql: 'SELECT product_id, quantity, received_quantity FROM purchase_order_items WHERE id = ? AND purchase_order_id = ? FOR UPDATE',
        values: [item.itemId, input.purchaseOrderId],
      })
      const line = (itemRows as Array<{ product_id: number; quantity: number; received_quantity: number }>)[0]
      if (!line || line.received_quantity + item.quantity > line.quantity) throw new AppError(400, 'Receipt exceeds ordered quantity', 'RECEIPT_EXCEEDS_ORDER')
      await connection.execute('UPDATE purchase_order_items SET received_quantity = received_quantity + ? WHERE id = ?', [item.quantity, item.itemId])
      await connection.execute('UPDATE products SET quantity = quantity + ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [item.quantity, line.product_id])
      await connection.execute(
        `INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, reason, quantity_after, unit_price)
         SELECT id, ?, ?, ?, ?, quantity, unit_price FROM products WHERE id = ?`,
        [request.user?.id ?? null, 'IN', item.quantity, `Goods receipt #${receiptId}`, line.product_id],
      )
    }
    await connection.execute(
      `UPDATE purchase_orders SET status = CASE WHEN NOT EXISTS (SELECT 1 FROM purchase_order_items WHERE purchase_order_id = ? AND received_quantity < quantity) THEN 'RECEIVED' ELSE 'PARTIALLY_RECEIVED' END WHERE id = ?`,
      [input.purchaseOrderId, input.purchaseOrderId],
    )
    await writeAuditLog({ userId: request.user?.id, action: 'GOODS_RECEIVED', entityType: 'purchase_order', entityId: input.purchaseOrderId, metadata: { receiptId, reference: input.reference } }, connection)
  })

  await evaluateLowStock()
  response.status(201).json({ ok: true })
})

router.get('/reports/inventory.csv', requireRole('admin', 'inventory_manager'), async (_request, response) => {
  const rows = await query<Array<{ sku: string; name: string; category: string; quantity: number; minimum_quantity: number; unit_price: number }>>(
    'SELECT p.sku, p.name, c.name AS category, p.quantity, p.minimum_quantity, p.unit_price FROM products p JOIN categories c ON c.id = p.category_id WHERE p.archived_at IS NULL ORDER BY p.sku',
  )
  const csv = [
    'SKU,Name,Category,Quantity,Minimum,Unit Price (INR)',
    ...rows.map((row) =>
      [row.sku, row.name, row.category, row.quantity, row.minimum_quantity, row.unit_price]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(','),
    ),
  ].join('\r\n')
  response.type('text/csv').attachment('invomech-inventory.csv').send(csv)
})

router.get('/audit-log', requireRole('admin'), async (_request, response) => {
  const entries = await query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata_json, a.created_at, u.name AS user_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC
     LIMIT 200`,
  )
  response.json({ entries })
})

router.get('/notifications', async (request, response) => {
  const rows = await query(
    `SELECT id, type, title, body, read_at, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [request.user!.id],
  )
  response.json({ notifications: rows })
})

router.post('/notifications/:id/read', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  await execute('UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE id = ? AND user_id = ?', [id, request.user!.id])
  response.status(204).send()
})

router.get('/alerts', async (_request, response) => {
  const rows = await query(
    `SELECT a.id, a.product_id, p.name AS product_name, p.sku, p.quantity, p.minimum_quantity,
            a.alert_type, a.status, a.suggested_quantity, a.created_at
     FROM alerts a
     JOIN products p ON p.id = a.product_id
     WHERE a.status = 'OPEN' AND p.archived_at IS NULL
     ORDER BY a.created_at DESC`,
  )
  response.json({ alerts: rows })
})

router.get('/settings', async (_request, response) => {
  const rows = await query<Array<{ setting_key: string; setting_value: string }>>('SELECT setting_key, setting_value FROM company_settings')
  const settings = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]))
  response.json({
    companyName: settings.company_name ?? 'INVOMECH PVT. LTD.',
    tagline: settings.tagline ?? 'Manufacturer of all kind of packaging machines and Engineering solutions provider.',
    currency: settings.currency ?? 'INR',
    lowStockThresholdRatio: settings.low_stock_ratio ?? '1.0',
    contactEmail: settings.contact_email ?? 'contact@invomech.local',
  })
})

router.put('/settings', requireRole('admin'), async (request, response) => {
  const input = z.object({
    companyName: z.string().trim().min(2).optional(),
    tagline: z.string().trim().optional(),
    contactEmail: z.string().trim().email().optional(),
  }).parse(request.body)

  if (input.companyName) {
    await execute('INSERT INTO company_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', ['company_name', input.companyName])
  }
  if (input.tagline !== undefined) {
    await execute('INSERT INTO company_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', ['tagline', input.tagline])
  }
  if (input.contactEmail) {
    await execute('INSERT INTO company_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', ['contact_email', input.contactEmail])
  }

  await writeAuditLog({ userId: request.user?.id, action: 'UPDATE_SETTINGS', entityType: 'company_settings', metadata: input })
  response.status(204).send()
})

export default router

