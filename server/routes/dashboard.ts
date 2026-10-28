import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const generateDefaultActivity = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const now = new Date()
  const result: Array<{ month: string; sales: number; purchases: number }> = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({ month: months[d.getMonth()], sales: 0, purchases: 0 })
  }
  return result
}

router.get('/', async (_request, response) => {
  const [kpis, products, activityRows] = await Promise.all([
    query<{ total_products: number; stock_value: number; low_stock_items: number; open_purchase_orders: number }[]>(
      `SELECT
       (SELECT COUNT(*) FROM products WHERE archived_at IS NULL) total_products,
       COALESCE((SELECT SUM(quantity * unit_price) FROM products WHERE archived_at IS NULL), 0) stock_value,
       (SELECT COUNT(*) FROM products WHERE archived_at IS NULL AND quantity <= minimum_quantity) low_stock_items,
       (SELECT COUNT(*) FROM purchase_orders WHERE status IN ('DRAFT','PENDING_APPROVAL','APPROVED')) open_purchase_orders`,
    ),
    query(
      `SELECT p.id, p.sku, p.name, c.name AS category, p.quantity, p.minimum_quantity, p.unit_price,
              CASE WHEN p.quantity <= p.minimum_quantity / 2 THEN 'Critical'
                   WHEN p.quantity <= p.minimum_quantity THEN 'Low Stock'
                   ELSE 'In Stock' END AS status
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.archived_at IS NULL
       ORDER BY p.updated_at DESC
       LIMIT 10`,
    ),
    query<Array<{ month: string; sales: number; purchases: number }>>(
      `SELECT DATE_FORMAT(movement_date, '%b') month,
              COALESCE(SUM(CASE WHEN movement_type = 'OUT' THEN quantity * unit_price ELSE 0 END), 0) sales,
              COALESCE(SUM(CASE WHEN movement_type IN ('IN','ADJUSTMENT') THEN quantity * unit_price ELSE 0 END), 0) purchases
       FROM stock_movements
       WHERE movement_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY YEAR(movement_date), MONTH(movement_date), DATE_FORMAT(movement_date, '%b')
       ORDER BY YEAR(movement_date), MONTH(movement_date)`,
    ),
  ])

  const activity = activityRows.length > 0 ? activityRows : generateDefaultActivity()
  const safeKpis = kpis[0] ?? { total_products: 0, stock_value: 0, low_stock_items: 0, open_purchase_orders: 0 }

  response.json({ kpis: safeKpis, products, activity })
})

export default router

