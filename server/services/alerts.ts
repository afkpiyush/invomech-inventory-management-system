import { execute, query } from '../db.js'

export const evaluateLowStock = async () => {
  const products = await query<{ id: number; sku: string; name: string; quantity: number; minimum_quantity: number; reorder_quantity: number }[]>(
    'SELECT id, sku, name, quantity, minimum_quantity, reorder_quantity FROM products WHERE archived_at IS NULL',
  )
  for (const product of products) {
    if (product.quantity <= product.minimum_quantity) {
      await execute(
        `INSERT INTO alerts (product_id, alert_type, status, suggested_quantity, resolved_at)
         VALUES (?, 'LOW_STOCK', 'OPEN', ?, NULL)
         ON DUPLICATE KEY UPDATE status = 'OPEN', resolved_at = NULL, suggested_quantity = VALUES(suggested_quantity), updated_at = UTC_TIMESTAMP()`,
        [product.id, Math.max(product.reorder_quantity, product.minimum_quantity * 2 - product.quantity)],
      )
      const noticeBody = `${product.name} (${product.sku}) is low on stock: ${product.quantity} units remaining (min ${product.minimum_quantity})`
      await execute(
        `INSERT INTO notifications (user_id, type, title, body)
         SELECT id, 'LOW_STOCK', 'Low stock alert', ?
         FROM users WHERE role = 'admin'
         AND NOT EXISTS (
           SELECT 1 FROM notifications n WHERE n.user_id = users.id AND n.type = 'LOW_STOCK'
           AND n.created_at > UTC_TIMESTAMP() - INTERVAL 1 DAY AND n.body = ?
         )`,
        [noticeBody, noticeBody],
      )
    } else {
      await execute(
        `UPDATE alerts SET status = 'RESOLVED', resolved_at = UTC_TIMESTAMP() WHERE product_id = ? AND status IN ('OPEN', 'ACKNOWLEDGED')`,
        [product.id],
      )
    }
  }
}

