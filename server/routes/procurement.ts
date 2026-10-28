import { Router } from 'express'
import { z } from 'zod'
import { execute, query, transaction } from '../db.js'
import { AppError } from '../errors.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { writeAuditLog } from '../services/audit.js'
import { sendEmail } from '../services/email.js'
import { buildPurchaseOrderPdf } from '../services/pdf.js'

const router = Router()
router.use(requireAuth)

router.get('/', async (_request, response) => {
  const purchaseOrders = await query(
    `SELECT po.id, po.number, po.supplier_id, po.status, po.total_amount, po.rejection_reason,
            po.approved_at, po.dispatched_at, po.created_at,
            s.name AS supplier, s.email AS supplier_email, u.name AS created_by_name
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN users u ON u.id = po.created_by
     ORDER BY po.created_at DESC`,
  )
  response.json({ purchaseOrders })
})

router.get('/:id', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const orders = await query<any[]>(
    `SELECT po.id, po.number, po.supplier_id, po.status, po.total_amount, po.rejection_reason,
            po.approved_at, po.dispatched_at, po.created_at,
            s.name AS supplier, s.email AS supplier_email, u.name AS created_by_name
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN users u ON u.id = po.created_by
     WHERE po.id = ?`,
    [id],
  )
  if (!orders[0]) throw new AppError(404, 'Purchase order not found', 'PO_NOT_FOUND')
  const items = await query<any[]>(
    `SELECT poi.id, poi.product_id, p.name AS product_name, p.sku, poi.quantity, poi.received_quantity, poi.unit_price, poi.line_total
     FROM purchase_order_items poi
     JOIN products p ON p.id = poi.product_id
     WHERE poi.purchase_order_id = ?`,
    [id],
  )
  response.json({ purchaseOrder: { ...orders[0], items } })
})

router.post('/', async (request, response) => {
  const input = z.object({
    supplierId: z.number().int().positive(),
    items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive(), unitPrice: z.number().nonnegative() })).min(1),
  }).parse(request.body)

  const number = `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}-${Math.floor(100 + Math.random() * 900)}`
  const total = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const id = await transaction(async (connection) => {
    const [result] = await connection.execute(
      'INSERT INTO purchase_orders (number, supplier_id, created_by, status, total_amount) VALUES (?, ?, ?, ?, ?)',
      [number, input.supplierId, request.user?.id ?? null, 'DRAFT', total],
    )
    const orderId = Number((result as { insertId: number }).insertId)
    for (const item of input.items) {
      await connection.execute(
        'INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.productId, item.quantity, item.unitPrice, item.quantity * item.unitPrice],
      )
    }
    await writeAuditLog({ userId: request.user?.id, action: 'CREATE', entityType: 'purchase_order', entityId: orderId, metadata: { number, total } }, connection)
    return orderId
  })
  response.status(201).json({ id, number })
})

router.post('/:id/submit', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const isAdmin = request.user?.role === 'admin'
  const [result] = await execute(
    `UPDATE purchase_orders SET status = 'PENDING_APPROVAL' WHERE id = ? AND status = 'DRAFT' ${isAdmin ? '' : 'AND created_by = ?'}`,
    isAdmin ? [id] : [id, request.user?.id ?? null],
  )
  if (!result.affectedRows) throw new AppError(409, 'Only draft purchase orders can be submitted', 'PO_STATE_INVALID')
  await writeAuditLog({ userId: request.user?.id, action: 'SUBMIT_FOR_APPROVAL', entityType: 'purchase_order', entityId: id })
  response.status(204).send()
})

router.post('/:id/approve', requireRole('admin'), async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const [result] = await execute(
    `UPDATE purchase_orders SET status = 'APPROVED', approved_by = ?, approved_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'PENDING_APPROVAL'`,
    [request.user?.id ?? null, id],
  )
  if (!result.affectedRows) throw new AppError(409, 'Purchase order is not awaiting approval', 'PO_STATE_INVALID')
  await writeAuditLog({ userId: request.user?.id, action: 'APPROVE', entityType: 'purchase_order', entityId: id })
  response.status(204).send()
})

router.post('/:id/reject', requireRole('admin'), async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const reason = z.string().trim().min(3).parse(request.body.reason)
  const [result] = await execute(
    `UPDATE purchase_orders SET status = 'REJECTED', rejection_reason = ? WHERE id = ? AND status = 'PENDING_APPROVAL'`,
    [reason, id],
  )
  if (!result.affectedRows) throw new AppError(409, 'Purchase order is not awaiting approval', 'PO_STATE_INVALID')
  await writeAuditLog({ userId: request.user?.id, action: 'REJECT', entityType: 'purchase_order', entityId: id, metadata: { reason } })
  response.status(204).send()
})

router.post('/:id/dispatch', requireRole('admin'), async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const [result] = await execute(
    `UPDATE purchase_orders SET status = 'DISPATCHED', dispatched_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'APPROVED'`,
    [id],
  )
  if (!result.affectedRows) throw new AppError(409, 'Purchase order is not approved for dispatch', 'PO_STATE_INVALID')
  await writeAuditLog({ userId: request.user?.id, action: 'DISPATCH', entityType: 'purchase_order', entityId: id })

  // Send dispatch notification or preview
  try {
    const orders = await query<{ number: string; supplier: string; supplier_email: string | null }[]>(
      `SELECT po.number, s.name supplier, s.email supplier_email FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?`,
      [id],
    )
    if (orders[0]) {
      const recipient = orders[0].supplier_email ?? 'procurement@invomech.local'
      const subject = `INVOMECH PVT. LTD. - Purchase Order ${orders[0].number} Dispatched`
      const html = `<p>Dear ${orders[0].supplier},</p><p>Purchase Order <strong>${orders[0].number}</strong> has been officially approved and dispatched by INVOMECH PVT. LTD.</p>`
      const emailResult = await sendEmail({ to: recipient, subject, html })
      await execute(
        'INSERT INTO notification_outbox (recipient, subject, body, status) VALUES (?, ?, ?, ?)',
        [recipient, subject, html, emailResult.status],
      )
    }
  } catch (err) {
    console.error('Email dispatch error', err)
  }

  response.status(204).send()
})

router.get('/:id/pdf', async (request, response) => {
  const id = z.coerce.number().int().positive().parse(request.params.id)
  const orders = await query<{ number: string; supplier: string }[]>(
    'SELECT po.number, s.name supplier FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?',
    [id],
  )
  if (!orders[0]) throw new AppError(404, 'Purchase order not found', 'PO_NOT_FOUND')
  const items = await query<{ name: string; quantity: number; unit_price: number }[]>(
    'SELECT p.name, poi.quantity, poi.unit_price FROM purchase_order_items poi JOIN products p ON p.id = poi.product_id WHERE poi.purchase_order_id = ?',
    [id],
  )
  const pdf = await buildPurchaseOrderPdf({
    number: orders[0].number,
    supplier: orders[0].supplier,
    items: items.map((item) => ({ name: item.name, quantity: item.quantity, unitPrice: item.unit_price })),
  })
  response.type('application/pdf')
  response.setHeader('Content-Disposition', `attachment; filename="${orders[0].number}.pdf"`)
  response.send(pdf)
})

export default router

