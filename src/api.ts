export type User = { id: number; email: string; name: string; role: 'admin' | 'inventory_manager' }

export type Product = {
  id: number
  sku: string
  name: string
  category: string
  quantity: number
  minimum_quantity: number
  reorder_quantity: number
  unit_price: number
  status: 'In Stock' | 'Low Stock' | 'Critical'
}

export type DashboardResponse = {
  kpis: { total_products: number; stock_value: number; low_stock_items: number; open_purchase_orders: number }
  products: Product[]
  activity: Array<{ month: string; sales: number; purchases: number }>
}

export type Category = { id: number; name: string }

export type Supplier = {
  id: number
  name: string
  email: string | null
  phone: string | null
  address: string | null
  is_demo: boolean
}

export type StockMovement = {
  id: number
  product_id: number
  product_name: string
  sku: string
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity: number
  reason: string
  quantity_after: number
  unit_price: number
  movement_date: string
  user_name: string | null
}

export type PurchaseOrderItem = {
  id: number
  product_id: number
  product_name?: string
  sku?: string
  quantity: number
  received_quantity: number
  unit_price: number
  line_total: number
}

export type PurchaseOrder = {
  id: number
  number: string
  supplier_id: number
  supplier: string
  supplier_email?: string | null
  created_by_name?: string | null
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'DISPATCHED' | 'PARTIALLY_RECEIVED' | 'RECEIVED'
  total_amount: number
  rejection_reason?: string | null
  approved_at?: string | null
  dispatched_at?: string | null
  created_at: string
  items?: PurchaseOrderItem[]
}

export type GoodsReceipt = {
  id: number
  number: string
  reference: string | null
  received_by: string
  supplier: string
  received_at: string
}

export type AuditLogEntry = {
  id: number
  action: string
  entity_type: string
  entity_id: number | null
  metadata_json: Record<string, unknown> | string
  created_at: string
  user_name: string | null
}

export type AppNotification = {
  id: number
  type: string
  title: string
  body: string
  read_at: string | null
  created_at: string
}

export type CompanySettings = {
  companyName: string
  tagline: string
  currency: string
  lowStockThresholdRatio: string
  contactEmail: string
}

export type ApiErrorResponse = {
  error?: string
  code?: string
  details?: unknown
}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  let response: Response
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } catch {
    throw new Error('Unable to reach the INVOMECH API. Start the API server and try again.')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorResponse | null
    if (body?.code === 'DATABASE_UNAVAILABLE') {
      throw new Error('The database is unavailable. Start MySQL 8 and try again.')
    }
    if (body?.code === 'DATABASE_NOT_INITIALIZED' || body?.code === 'DATABASE_AUTH_FAILED') {
      throw new Error(body?.error ?? 'Database error. Please check server configuration.')
    }
    throw new Error(body?.error ?? `Request failed (${response.status})`)
  }
  return response.status === 204 ? (undefined as unknown as T) : (response.json() as Promise<T>)
}

export const getCsrfToken = () => request<{ csrfToken: string }>('/api/auth/csrf')

export const getCurrentUser = () => request<{ user: User }>('/api/auth/me')

export const login = async (email: string, password: string) => {
  const csrf = await getCsrfToken()
  return request<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'x-csrf-token': csrf.csrfToken },
  })
}

export const logout = async () => {
  const csrf = await getCsrfToken()
  return request<void>('/api/auth/logout', {
    method: 'POST',
    headers: { 'x-csrf-token': csrf.csrfToken },
  })
}

export const getDashboard = () => request<DashboardResponse>('/api/dashboard')

export const getInventory = (search = '') =>
  request<{ products: Product[] }>(`/api/inventory${search ? `?search=${encodeURIComponent(search)}` : ''}`)

export const getCategories = () => request<{ categories: Category[] }>('/api/operations/categories')

export const createInventoryProduct = async (input: {
  sku: string
  name: string
  categoryId: number
  quantity: number
  minimumQuantity: number
  reorderQuantity: number
  unitPrice: number
}) => {
  const { csrfToken } = await getCsrfToken()
  return request<{ id: number }>('/api/inventory', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify(input),
  })
}

export const updateInventoryProduct = async (
  id: number,
  input: {
    sku?: string
    name?: string
    categoryId?: number
    minimumQuantity?: number
    reorderQuantity?: number
    unitPrice?: number
  },
) => {
  const { csrfToken } = await getCsrfToken()
  return request<void>(`/api/inventory/${id}`, {
    method: 'PATCH',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify(input),
  })
}

export const recordStockMovement = async (
  productId: number,
  input: {
    type: 'IN' | 'OUT' | 'ADJUSTMENT'
    quantity: number
    reason: string
  },
) => {
  const { csrfToken } = await getCsrfToken()
  return request<{ ok: boolean }>(`/api/inventory/${productId}/movements`, {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify(input),
  })
}

export const deleteInventoryProduct = async (id: number) => {
  const { csrfToken } = await getCsrfToken()
  return request<void>(`/api/inventory/${id}`, {
    method: 'DELETE',
    headers: { 'x-csrf-token': csrfToken },
  })
}

export const getStockMovements = (limit = 100) =>
  request<{ movements: StockMovement[] }>(`/api/inventory/movements?limit=${limit}`)

export const getSuppliers = () => request<{ suppliers: Supplier[] }>('/api/suppliers')

export const createSupplier = async (input: { name: string; email?: string; phone?: string; address?: string }) => {
  const { csrfToken } = await getCsrfToken()
  return request<{ id: number }>('/api/suppliers', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify(input),
  })
}

export const updateSupplier = async (id: number, input: { name?: string; email?: string; phone?: string; address?: string }) => {
  const { csrfToken } = await getCsrfToken()
  return request<void>(`/api/suppliers/${id}`, {
    method: 'PATCH',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify(input),
  })
}

export const deleteSupplier = async (id: number) => {
  const { csrfToken } = await getCsrfToken()
  return request<void>(`/api/suppliers/${id}`, {
    method: 'DELETE',
    headers: { 'x-csrf-token': csrfToken },
  })
}

export const getPurchaseOrders = () =>
  request<{ purchaseOrders: PurchaseOrder[] }>('/api/purchase-orders')

export const getPurchaseOrder = (id: number) =>
  request<{ purchaseOrder: PurchaseOrder }>('/api/purchase-orders/' + id)

export const createPurchaseOrder = async (input: {
  supplierId: number
  items: Array<{ productId: number; quantity: number; unitPrice: number }>
}) => {
  const { csrfToken } = await getCsrfToken()
  return request<{ id: number; number: string }>('/api/purchase-orders', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify(input),
  })
}

export const submitPurchaseOrder = async (id: number) => {
  const { csrfToken } = await getCsrfToken()
  return request<void>(`/api/purchase-orders/${id}/submit`, {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
  })
}

export const approvePurchaseOrder = async (id: number) => {
  const { csrfToken } = await getCsrfToken()
  return request<void>(`/api/purchase-orders/${id}/approve`, {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
  })
}

export const rejectPurchaseOrder = async (id: number, reason: string) => {
  const { csrfToken } = await getCsrfToken()
  return request<void>(`/api/purchase-orders/${id}/reject`, {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify({ reason }),
  })
}

export const dispatchPurchaseOrder = async (id: number) => {
  const { csrfToken } = await getCsrfToken()
  return request<void>(`/api/purchase-orders/${id}/dispatch`, {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
  })
}

export const downloadPurchaseOrderPdf = async (id: number, poNumber: string) => {
  const response = await fetch(`/api/purchase-orders/${id}/pdf`, {
    credentials: 'include',
  })
  if (!response.ok) throw new Error('Failed to download purchase order PDF')
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${poNumber}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export const getGoodsReceipts = () =>
  request<{ receipts: GoodsReceipt[] }>('/api/operations/goods-received')

export const createGoodsReceipt = async (input: {
  purchaseOrderId: number
  reference?: string
  items: Array<{ itemId: number; quantity: number }>
}) => {
  const { csrfToken } = await getCsrfToken()
  return request<{ ok: boolean }>('/api/operations/goods-received', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify(input),
  })
}

export const downloadInventoryCsv = async () => {
  const response = await fetch('/api/operations/reports/inventory.csv', {
    credentials: 'include',
  })
  if (!response.ok) throw new Error('Failed to download inventory CSV report')
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'invomech-inventory.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export const getAuditLogs = () =>
  request<{ entries: AuditLogEntry[] }>('/api/operations/audit-log')

export const getNotifications = () =>
  request<{ notifications: AppNotification[] }>('/api/operations/notifications')

export const markNotificationRead = async (id: number) => {
  const { csrfToken } = await getCsrfToken()
  return request<void>(`/api/operations/notifications/${id}/read`, {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
  })
}

export const getCompanySettings = () =>
  request<CompanySettings>('/api/operations/settings')

export const updateCompanySettings = async (input: Partial<CompanySettings>) => {
  const { csrfToken } = await getCsrfToken()
  return request<void>('/api/operations/settings', {
    method: 'PUT',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify(input),
  })
}
