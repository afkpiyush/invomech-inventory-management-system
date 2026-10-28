import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2, PackageCheck, Plus, RefreshCw, Search, X } from 'lucide-react'
import {
  createGoodsReceipt,
  getGoodsReceipts,
  getPurchaseOrder,
  getPurchaseOrders,
  type GoodsReceipt,
  type PurchaseOrder,
} from '../api'

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export default function GoodsReceivedPage() {
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = useCallback(() => {
    Promise.all([getGoodsReceipts(), getPurchaseOrders()])
      .then(([recRes, poRes]) => {
        setReceipts(recRes.receipts)
        setOrders(poRes.purchaseOrders.filter((po) => ['APPROVED', 'DISPATCHED', 'PARTIALLY_RECEIVED'].includes(po.status)))
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

  const filtered = receipts.filter(
    (r) =>
      r.number.toLowerCase().includes(search.toLowerCase()) ||
      r.received_by.toLowerCase().includes(search.toLowerCase()) ||
      (r.reference && r.reference.toLowerCase().includes(search.toLowerCase())) ||
      (r.supplier && r.supplier.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <div>
          <span className="eyebrow">WAREHOUSE INTAKE</span>
          <h2>Goods Received Notes (GRN)</h2>
          <p>Verify incoming supplier shipments, update warehouse inventory, and close purchase orders.</p>
        </div>
        <div className="heading-actions">
          <button className="date-button" onClick={handleRefresh} title="Refresh receipts">
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="primary-button" onClick={() => { setSuccess(''); setDialogOpen(true) }}>
            <Plus size={16} /> Receive goods
          </button>
        </div>
      </div>

      {success && <div className="success-banner" role="status"><CheckCircle2 size={16} /> {success}</div>}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={handleRefresh}>Retry</button>
        </div>
      )}

      <div className="card filter-panel">
        <div className="filter-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by PO number, reference delivery challan, or recipient..."
          />
        </div>
        {search && (
          <button className="clear-filter" onClick={() => setSearch('')}>
            Clear search
          </button>
        )}
      </div>

      <div className="card table-card">
        {loading ? (
          <div className="table-state">Loading goods received notes...</div>
        ) : filtered.length === 0 ? (
          <div className="table-state">
            <PackageCheck size={28} />
            <strong>No goods receipts recorded</strong>
            <span>When an approved purchase order arrives at the warehouse, process its receipt here.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>GRN #</th>
                  <th>Purchase Order</th>
                  <th>Supplier</th>
                  <th>Delivery Challan / Ref</th>
                  <th>Received Date & Time</th>
                  <th>Inspected By</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>GRN-{String(r.id).padStart(5, '0')}</strong>
                    </td>
                    <td>
                      <span className="product-cell">
                        <strong>{r.number}</strong>
                      </span>
                    </td>
                    <td>{r.supplier}</td>
                    <td>
                      {r.reference ? (
                        <span style={{ fontWeight: 500, color: 'var(--text)' }}>{r.reference}</span>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td>{formatDate(r.received_at)}</td>
                    <td>{r.received_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialogOpen && (
        <ReceiveGoodsDialog
          orders={orders}
          onClose={() => setDialogOpen(false)}
          onSubmit={async (input) => {
            try {
              await createGoodsReceipt(input)
              setDialogOpen(false)
              setSuccess('Goods received recorded successfully. Warehouse stock levels updated.')
              load()
            } catch (err: unknown) {
              setError((err as Error).message)
            }
          }}
        />
      )}
    </section>
  )
}

function ReceiveGoodsDialog({
  orders,
  onClose,
  onSubmit,
}: {
  orders: PurchaseOrder[]
  onClose: () => void
  onSubmit: (input: { purchaseOrderId: number; reference?: string; items: Array<{ itemId: number; quantity: number }> }) => Promise<void>
}) {
  const [selectedPoId, setSelectedPoId] = useState<string>(orders[0]?.id.toString() ?? '')
  const [activeOrder, setActiveOrder] = useState<PurchaseOrder | null>(null)
  const [receivedQtyMap, setReceivedQtyMap] = useState<Record<number, number>>({})
  const [reference, setReference] = useState('')
  const [loadingItems, setLoadingItems] = useState(false)
  const [validation, setValidation] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!selectedPoId) return
    setLoadingItems(true)
    getPurchaseOrder(Number(selectedPoId))
      .then((res) => {
        setActiveOrder(res.purchaseOrder)
        const initialMap: Record<number, number> = {}
        res.purchaseOrder.items?.forEach((item) => {
          const remaining = Math.max(0, item.quantity - item.received_quantity)
          initialMap[item.id] = remaining
        })
        setReceivedQtyMap(initialMap)
      })
      .catch((err: Error) => setValidation(err.message))
      .finally(() => setLoadingItems(false))
  }, [selectedPoId])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!selectedPoId) {
      setValidation('Please choose a purchase order.')
      return
    }
    const items = Object.entries(receivedQtyMap)
      .map(([itemId, quantity]) => ({ itemId: Number(itemId), quantity: Number(quantity) }))
      .filter((item) => item.quantity > 0)

    if (items.length === 0) {
      setValidation('Please enter at least 1 unit to receive.')
      return
    }

    setSubmitting(true)
    onSubmit({
      purchaseOrderId: Number(selectedPoId),
      reference: reference.trim() || undefined,
      items,
    }).finally(() => setSubmitting(false))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        style={{ width: 'min(620px, 100%)' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">WAREHOUSE INTAKE</span>
            <h2>Receive Goods from PO</h2>
            <p>Inspect incoming items and update stock.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>

        {validation && <div className="form-error">{validation}</div>}

        <label>
          Purchase Order to Receive
          <select value={selectedPoId} onChange={(e) => setSelectedPoId(e.target.value)} required>
            {orders.map((po) => (
              <option key={po.id} value={po.id}>
                {po.number} — {po.supplier} ({po.status})
              </option>
            ))}
          </select>
        </label>

        <label>
          Delivery Challan / Invoice Reference
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. DC-2024-8842 / Transporter Bilty"
          />
        </label>

        <div style={{ margin: '14px 0 6px', fontWeight: 600, fontSize: 12 }}>Items in this order:</div>

        {loadingItems ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
            Loading PO line items...
          </div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 14 }}>
            {activeOrder?.items?.map((item) => {
              const pending = Math.max(0, item.quantity - item.received_quantity)
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 4px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ flex: 1, paddingRight: 10 }}>
                    <strong style={{ fontSize: 12 }}>{item.product_name}</strong>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {item.sku} &bull; Ordered: {item.quantity} | Already received: {item.received_quantity}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Receive:</span>
                    <input
                      type="number"
                      min="0"
                      max={pending}
                      value={receivedQtyMap[item.id] ?? 0}
                      onChange={(e) =>
                        setReceivedQtyMap({
                          ...receivedQtyMap,
                          [item.id]: Math.min(pending, Math.max(0, Number(e.target.value))),
                        })
                      }
                      style={{ width: 75, padding: 5, fontSize: 11 }}
                    />
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>/ {pending} max</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={submitting || loadingItems}>
            {submitting ? 'Confirming intake...' : 'Confirm goods receipt'}
          </button>
        </div>
      </form>
    </div>
  )
}
