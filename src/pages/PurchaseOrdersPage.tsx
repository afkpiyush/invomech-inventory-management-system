import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Check,
  Download,
  Eye,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Send,
  ShoppingCart,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import {
  approvePurchaseOrder,
  createPurchaseOrder,
  dispatchPurchaseOrder,
  downloadPurchaseOrderPdf,
  getInventory,
  getPurchaseOrder,
  getPurchaseOrders,
  getSuppliers,
  rejectPurchaseOrder,
  submitPurchaseOrder,
  type Product,
  type PurchaseOrder,
  type Supplier,
} from '../api'

const inr = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function PurchaseOrdersPage({ isAdmin }: { isAdmin: boolean }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailsOrder, setDetailsOrder] = useState<PurchaseOrder | null>(null)
  const [rejectingOrder, setRejectingOrder] = useState<PurchaseOrder | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(() => {
    Promise.all([getPurchaseOrders(), getSuppliers(), getInventory()])
      .then(([ordersRes, supRes, invRes]) => {
        setOrders(ordersRes.purchaseOrders)
        setSuppliers(supRes.suppliers)
        setProducts(invRes.products)
        setError('')
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleRefresh = () => {
    setLoading(true)
    load()
  }

  useEffect(() => {
    load()
  }, [load])

  const handleAction = async (actionFn: () => Promise<unknown>, successMsg: string) => {
    setActionLoading(true)
    setError('')
    try {
      await actionFn()
      setSuccess(successMsg)
      load()
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  const openDetails = async (id: number) => {
    try {
      const res = await getPurchaseOrder(id)
      setDetailsOrder(res.purchaseOrder)
    } catch (err: unknown) {
      setError((err as Error).message)
    }
  }

  const filteredOrders = orders.filter((po) => statusFilter === 'all' || po.status === statusFilter)

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'DRAFT':
        return <span className="status" style={{ background: '#f1f5f9', color: '#64748b' }}>Draft</span>
      case 'PENDING_APPROVAL':
        return <span className="status low-stock">Pending Approval</span>
      case 'APPROVED':
        return <span className="status in-stock">Approved</span>
      case 'DISPATCHED':
        return <span className="status" style={{ background: '#e0f2fe', color: '#0369a1' }}>Dispatched</span>
      case 'PARTIALLY_RECEIVED':
        return <span className="status low-stock">Partially Received</span>
      case 'RECEIVED':
        return <span className="status in-stock">Received</span>
      case 'REJECTED':
        return <span className="status critical">Rejected</span>
      default:
        return <span className="status">{status}</span>
    }
  }

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <div>
          <span className="eyebrow">PROCUREMENT</span>
          <h2>Purchase Orders</h2>
          <p>Track requisitions, supplier approvals, and order delivery lifecycles.</p>
        </div>
        <div className="heading-actions">
          <button className="date-button" onClick={handleRefresh} title="Refresh orders">
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="primary-button" onClick={() => { setSuccess(''); setCreateOpen(true) }}>
            <Plus size={16} /> New purchase order
          </button>
        </div>
      </div>

      {success && <div className="success-banner" role="status">{success}</div>}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={handleRefresh}>Retry</button>
        </div>
      )}

      <div className="card filter-panel">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter status">
          <option value="all">All statuses ({orders.length})</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="DISPATCHED">Dispatched</option>
          <option value="PARTIALLY_RECEIVED">Partially Received</option>
          <option value="RECEIVED">Received</option>
          <option value="REJECTED">Rejected</option>
        </select>
        {statusFilter !== 'all' && (
          <button className="clear-filter" onClick={() => setStatusFilter('all')}>
            <Filter size={14} /> Clear filters
          </button>
        )}
      </div>

      <div className="card table-card">
        {loading ? (
          <div className="table-state">Loading purchase orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="table-state">
            <ShoppingCart size={28} />
            <strong>No purchase orders found</strong>
            <span>Create a new PO to begin procurement replenishment.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Created Date</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((po) => (
                  <tr key={po.id}>
                    <td>
                      <div className="product-cell">
                        <span className="product-thumb">
                          <FileText size={16} />
                        </span>
                        <div>
                          <strong>{po.number}</strong>
                          <span>By: {po.created_by_name ?? 'Manager'}</span>
                        </div>
                      </div>
                    </td>
                    <td>{po.supplier}</td>
                    <td>{formatDate(po.created_at)}</td>
                    <td>
                      <strong>{inr(po.total_amount)}</strong>
                    </td>
                    <td>{getStatusBadge(po.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          className="date-button"
                          style={{ height: 28, padding: '0 8px', fontSize: 10 }}
                          onClick={() => openDetails(po.id)}
                          title="View order details"
                        >
                          <Eye size={12} /> View
                        </button>

                        <button
                          className="date-button"
                          style={{ height: 28, padding: '0 8px', fontSize: 10 }}
                          onClick={() => downloadPurchaseOrderPdf(po.id, po.number)}
                          title="Download PDF"
                        >
                          <Download size={12} /> PDF
                        </button>

                        {po.status === 'DRAFT' && (
                          <button
                            className="primary-button"
                            style={{ height: 28, padding: '0 10px', fontSize: 10 }}
                            disabled={actionLoading}
                            onClick={() => handleAction(() => submitPurchaseOrder(po.id), `Order ${po.number} submitted for approval.`)}
                          >
                            <Send size={12} /> Submit
                          </button>
                        )}

                        {po.status === 'PENDING_APPROVAL' && isAdmin && (
                          <>
                            <button
                              className="primary-button"
                              style={{ height: 28, padding: '0 10px', fontSize: 10, background: '#0e9f74' }}
                              disabled={actionLoading}
                              onClick={() => handleAction(() => approvePurchaseOrder(po.id), `Order ${po.number} approved.`)}
                            >
                              <Check size={12} /> Approve
                            </button>
                            <button
                              className="date-button"
                              style={{ height: 28, padding: '0 8px', fontSize: 10, color: '#dc2626' }}
                              disabled={actionLoading}
                              onClick={() => setRejectingOrder(po)}
                            >
                              <XCircle size={12} /> Reject
                            </button>
                          </>
                        )}

                        {po.status === 'APPROVED' && isAdmin && (
                          <button
                            className="primary-button"
                            style={{ height: 28, padding: '0 10px', fontSize: 10 }}
                            disabled={actionLoading}
                            onClick={() => handleAction(() => dispatchPurchaseOrder(po.id), `Order ${po.number} marked as dispatched to supplier.`)}
                          >
                            <Send size={12} /> Dispatch
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && (
        <CreatePurchaseOrderDialog
          suppliers={suppliers}
          products={products}
          onClose={() => setCreateOpen(false)}
          onSubmit={async (input) => {
            setActionLoading(true)
            try {
              const res = await createPurchaseOrder(input)
              setCreateOpen(false)
              setSuccess(`Purchase Order ${res.number} created successfully as Draft.`)
              load()
            } catch (err: unknown) {
              setError((err as Error).message)
            } finally {
              setActionLoading(false)
            }
          }}
        />
      )}

      {detailsOrder && (
        <OrderDetailsDialog order={detailsOrder} onClose={() => setDetailsOrder(null)} />
      )}

      {rejectingOrder && (
        <RejectOrderDialog
          order={rejectingOrder}
          onClose={() => setRejectingOrder(null)}
          onSubmit={async (reason) => {
            await handleAction(() => rejectPurchaseOrder(rejectingOrder.id, reason), `Order ${rejectingOrder.number} rejected.`)
            setRejectingOrder(null)
          }}
        />
      )}
    </section>
  )
}

function CreatePurchaseOrderDialog({
  suppliers,
  products,
  onClose,
  onSubmit,
}: {
  suppliers: Supplier[]
  products: Product[]
  onClose: () => void
  onSubmit: (input: { supplierId: number; items: Array<{ productId: number; quantity: number; unitPrice: number }> }) => Promise<void>
}) {
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id.toString() ?? '')
  const [items, setItems] = useState<Array<{ productId: number; quantity: number; unitPrice: number }>>([
    { productId: products[0]?.id ?? 0, quantity: products[0]?.reorder_quantity || 10, unitPrice: products[0]?.unit_price || 0 },
  ])
  const [validation, setValidation] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const addItem = () => {
    const firstProd = products[0]
    if (firstProd) {
      setItems([...items, { productId: firstProd.id, quantity: firstProd.reorder_quantity || 5, unitPrice: firstProd.unit_price }])
    }
  }

  const removeItem = (idx: number) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItem = (idx: number, field: string, val: number) => {
    const next = [...items]
    if (field === 'productId') {
      const prod = products.find((p) => p.id === val)
      next[idx] = { ...next[idx], productId: val, unitPrice: prod?.unit_price ?? 0 }
    } else if (field === 'quantity') {
      next[idx] = { ...next[idx], quantity: val }
    } else if (field === 'unitPrice') {
      next[idx] = { ...next[idx], unitPrice: val }
    }
    setItems(next)
  }

  const grandTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!supplierId) {
      setValidation('Please choose a supplier.')
      return
    }
    if (items.some((item) => item.quantity <= 0)) {
      setValidation('All item quantities must be greater than zero.')
      return
    }
    setSubmitting(true)
    onSubmit({ supplierId: Number(supplierId), items }).finally(() => setSubmitting(false))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        style={{ width: 'min(640px, 100%)' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">PURCHASE ORDER</span>
            <h2>Create purchase requisition</h2>
            <p>Generate a formal procurement order for suppliers.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>

        {validation && <div className="form-error">{validation}</div>}

        <label>
          Supplier / Vendor
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ margin: '14px 0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 12 }}>Order Line Items</strong>
          <button
            type="button"
            className="text-button"
            style={{ fontSize: 11 }}
            onClick={addItem}
          >
            <Plus size={13} /> Add item
          </button>
        </div>

        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 14 }}>
          {items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.8fr 0.8fr 1fr auto',
                gap: 8,
                alignItems: 'center',
                padding: '6px 0',
                borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <select
                value={item.productId}
                onChange={(e) => updateItem(idx, 'productId', Number(e.target.value))}
                style={{ fontSize: 11, padding: 6 }}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                style={{ fontSize: 11, padding: 6 }}
                placeholder="Qty"
                required
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(e) => updateItem(idx, 'unitPrice', Number(e.target.value))}
                style={{ fontSize: 11, padding: 6 }}
                placeholder="Unit INR"
                required
              />
              <button
                type="button"
                className="date-button"
                style={{ height: 32, width: 32, padding: 0, justifyContent: 'center' }}
                onClick={() => removeItem(idx)}
                title="Remove item"
              >
                <Trash2 size={13} style={{ color: '#ef4444' }} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
          <span>Total PO Valuation:</span>
          <strong style={{ fontSize: 16, color: 'var(--blue)' }}>{inr(grandTotal)}</strong>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Generating...' : 'Create draft order'}
          </button>
        </div>
      </form>
    </div>
  )
}

function OrderDetailsDialog({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 'min(640px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">ORDER DETAILS</span>
            <h2>{order.number}</h2>
            <p>Supplier: {order.supplier} &bull; Status: {order.status}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>

        {order.rejection_reason && (
          <div className="error-banner" style={{ marginBottom: 12 }}>
            <strong>Rejection reason:</strong> {order.rejection_reason}
          </div>
        )}

        <div className="table-scroll" style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 14 }}>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Ordered Qty</th>
                <th>Received</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.product_name}</strong>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{item.sku}</div>
                  </td>
                  <td>{item.quantity} units</td>
                  <td>{item.received_quantity} units</td>
                  <td>{inr(item.unit_price)}</td>
                  <td>
                    <strong>{inr(item.line_total)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <button
            className="date-button"
            onClick={() => downloadPurchaseOrderPdf(order.id, order.number)}
          >
            <Download size={14} /> Download PDF document
          </button>
          <strong style={{ fontSize: 15 }}>Total: {inr(order.total_amount)}</strong>
        </div>
      </div>
    </div>
  )
}

function RejectOrderDialog({
  order,
  onClose,
  onSubmit,
}: {
  order: PurchaseOrder
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    setSubmitting(true)
    onSubmit(reason.trim()).finally(() => setSubmitting(false))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow" style={{ color: '#ef4444' }}>REJECTION</span>
            <h2>Reject {order.number}</h2>
            <p>Provide a reason for returning this requisition to draft/rejected.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>

        <label>
          Reason for rejection
          <textarea
            style={{ width: '100%', minHeight: 90, border: '1px solid var(--border)', borderRadius: 7, padding: 8, background: 'var(--bg)', color: 'var(--text)' }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Price exceeds budgeted threshold for Q4 engineering spares"
            required
          />
        </label>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" style={{ background: '#ef4444' }} disabled={submitting}>
            {submitting ? 'Rejecting...' : 'Confirm rejection'}
          </button>
        </div>
      </form>
    </div>
  )
}
