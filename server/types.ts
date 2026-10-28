export type Role = 'admin' | 'inventory_manager'

export type AuthUser = {
  id: number
  email: string
  name: string
  role: Role
}

export type Product = {
  id: number
  sku: string
  name: string
  category: string
  quantity: number
  minimumQuantity: number
  unitPrice: number
  status: 'In Stock' | 'Low Stock' | 'Critical'
}
