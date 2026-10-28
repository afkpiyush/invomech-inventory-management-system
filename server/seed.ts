import bcrypt from 'bcryptjs'
import { execute, pool } from './db.js'

const seed = async () => {
  const adminHash = await bcrypt.hash('Invomech@Admin123!', 12)
  const managerHash = await bcrypt.hash('Invomech@Manager123!', 12)
  await execute(`INSERT INTO users (email, name, role, password_hash) VALUES
    ('admin@invomech.local', 'Devon King', 'admin', ?),
    ('manager@invomech.local', 'Inventory Manager', 'inventory_manager', ?)
    ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), password_hash = VALUES(password_hash), active = 1`, [adminHash, managerHash])
  await execute(`INSERT INTO categories (name) VALUES ('Pneumatics'), ('Raw Material'), ('Electronics'), ('Components') ON DUPLICATE KEY UPDATE name = VALUES(name)`)
  await execute(`INSERT INTO suppliers (name, email, is_demo) VALUES
    ('Demo Industrial Components Co.', NULL, 1),
    ('Demo Precision Metals Supplier', NULL, 1),
    ('Demo Automation Parts Partner', NULL, 1)
    ON DUPLICATE KEY UPDATE is_demo = VALUES(is_demo)`)
  const categories = await (await import('./db.js')).query<{ id: number; name: string }[]>('SELECT id, name FROM categories')
  const categoryId = Object.fromEntries(categories.map((category) => [category.name, category.id]))
  const demoProducts = [
    ['INV-PC-0050', 'Pneumatic Cylinder 50mm', 'Pneumatics', 18, 25, 30, 2450],
    ['MAT-SS-304-2M', 'Stainless Steel Sheet 304', 'Raw Material', 42, 20, 40, 7850],
    ['ELEC-PLC-1200', 'PLC Control Module', 'Electronics', 8, 12, 15, 18500],
    ['CON-BLT-3000', 'Conveyor Belt 3m', 'Components', 31, 15, 25, 6200],
    ['ELEC-SRV-0750', 'Servo Motor 750W', 'Electronics', 4, 8, 12, 24800],
  ]
  for (const product of demoProducts) {
    await execute(`INSERT INTO products (sku, name, category_id, quantity, minimum_quantity, reorder_quantity, unit_price, is_demo)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE name = VALUES(name), quantity = VALUES(quantity), minimum_quantity = VALUES(minimum_quantity), reorder_quantity = VALUES(reorder_quantity), unit_price = VALUES(unit_price), archived_at = NULL`,
    [product[0], product[1], categoryId[product[2] as string], product[3], product[4], product[5], product[6]])
  }
}

seed().then(() => pool.end()).catch((error) => { console.error(error); process.exitCode = 1 })
