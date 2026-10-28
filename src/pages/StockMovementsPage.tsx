import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDownRight, ArrowUpRight, Filter, PackageSearch, Plus, RefreshCw, Search, X } from 'lucide-react'
import { getInventory, getStockMovements, recordStockMovement, type Product, type StockMovement } from '../api'

const inr = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', {
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

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(() => {
    Promise.all([getStockMovements(200), getInventory()])
      .then(([movRes, invRes]) => {
        setMovements(movRes.movements)
        setProducts(invRes.products)
        setError('')
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleRefresh = () => {
    setLoading(true)
    loadData()
  }

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const matchesType = filterType === 'all' || m.movement_type === filterType
      const query = search.toLowerCase()
      const matchesSearch =
        !query ||
        m.product_name.toLowerCase().includes(query) ||
        m.sku.toLowerCase().includes(query) ||
        m.reason.toLowerCase().includes(query) ||
        (m.user_name && m.user_name.toLowerCase().includes(query))
      return matchesType && matchesSearch
    })
  }, [movements, filterType, search])

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <div>
          <span className="eyebrow">OPERATIONS</span>
          <h2>Stock movements</h2>
          <p>Real-time audit log of all stock receipts, dispatches, and adjustments.</p>
        </div>
        <div className="heading-actions">
          <button className="date-button" onClick={handleRefresh} title="Refresh movements">
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="primary-button" onClick={() => setDialogOpen(true)}>
            <Plus size={16} /> Record movement
          </button>
        </div>
      </div>

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
            placeholder="Search by product, SKU, user, or reason..."
          />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} aria-label="Filter movement type">
          <option value="all">All movement types</option>
          <option value="IN">IN (Receipts)</option>
          <option value="OUT">OUT (Issues)</option>
          <option value="ADJUSTMENT">ADJUSTMENT (Audits)</option>
        </select>
        {(filterType !== 'all' || search) && (
          <button className="clear-filter" onClick={() => { setFilterType('all'); setSearch('') }}>
            <Filter size={14} /> Clear filters
          </button>
        )}
      </div>

      <div className="card table-card">
        {loading ? (
          <div className="table-state">Loading stock movement history...</div>
        ) : filteredMovements.length === 0 ? (
          <div className="table-state">
            <PackageSearch size={28} />
            <strong>No stock movements found</strong>
            <span>Record a stock movement to start building your ledger.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Product / SKU</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Balance After</th>
                  <th>Unit Valuation</th>
                  <th>Reason / Reference</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((m) => (
                  <tr key={m.id}>
                    <td>{formatDate(m.movement_date)}</td>
                    <td>
                      <div className="product-cell">
                        <div>
                          <strong>{m.product_name}</strong>
                          <span>{m.sku}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`status ${m.movement_type === 'IN' ? 'in-stock' : m.movement_type === 'OUT' ? 'critical' : 'low-stock'}`}>
                        {m.movement_type === 'IN' ? <ArrowDownRight size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> : m.movement_type === 'OUT' ? <ArrowUpRight size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> : null}
                        {m.movement_type}
                      </span>
                    </td>
                    <td>
                      <strong>{m.movement_type === 'OUT' ? `-${m.quantity}` : `+${m.quantity}`}</strong> units
                    </td>
                    <td>{m.quantity_after} units</td>
                    <td>{inr(m.unit_price)}</td>
                    <td>{m.reason}</td>
                    <td>{m.user_name ?? 'System / Admin'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialogOpen && (
        <RecordMovementDialog
          products={products}
          saving={saving}
          onClose={() => setDialogOpen(false)}
          onSubmit={async (productId, input) => {
            setSaving(true)
            try {
              await recordStockMovement(productId, input)
              setDialogOpen(false)
              loadData()
            } catch (err: unknown) {
              setError((err as Error).message)
            } finally {
              setSaving(false)
            }
          }}
        />
      )}
    </section>
  )
}

function RecordMovementDialog({
  products,
  saving,
  onClose,
  onSubmit,
}: {
  products: Product[]
  saving: boolean
  onClose: () => void
  onSubmit: (productId: number, input: { type: 'IN' | 'OUT' | 'ADJUSTMENT'; quantity: number; reason: string }) => Promise<void>
}) {
  const [productId, setProductId] = useState<string>(products[0]?.id.toString() ?? '')
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const [validation, setValidation] = useState('')

  const selectedProduct = products.find((p) => p.id === Number(productId))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!productId) {
      setValidation('Please select a product.')
      return
    }
    const q = Number(quantity)
    if (isNaN(q) || (type !== 'ADJUSTMENT' && q <= 0) || (type === 'ADJUSTMENT' && q < 0)) {
      setValidation('Please enter a valid quantity.')
      return
    }
    if (type === 'OUT' && selectedProduct && q > selectedProduct.quantity) {
      setValidation(`Cannot issue ${q} units. Only ${selectedProduct.quantity} units in stock.`)
      return
    }
    if (!reason.trim()) {
      setValidation('Reason or reference note is required.')
      return
    }
    onSubmit(Number(productId), { type, quantity: q, reason: reason.trim() })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">INVENTORY ADJUSTMENT</span>
            <h2>Record stock movement</h2>
            <p>Update inventory level with immediate ledger recording.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>

        {validation && <div className="form-error">{validation}</div>}

        <label>
          Select product
          <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku}) — Current: {p.quantity} units
              </option>
            ))}
          </select>
        </label>

        <div className="form-grid">
          <label>
            Movement type
            <select value={type} onChange={(e) => setType(e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT')}>
              <option value="IN">IN (Stock receipt / Purchase)</option>
              <option value="OUT">OUT (Production issue / Dispatch)</option>
              <option value="ADJUSTMENT">ADJUSTMENT (Cycle count / Audit)</option>
            </select>
          </label>
          <label>
            {type === 'ADJUSTMENT' ? 'New total count' : 'Quantity to move'}
            <input
              type="number"
              min={type === 'ADJUSTMENT' ? '0' : '1'}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>
        </div>

        {selectedProduct && (
          <div style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 14px' }}>
            Current stock: <strong>{selectedProduct.quantity} units</strong> &bull; After:{' '}
            <strong>
              {type === 'IN'
                ? selectedProduct.quantity + Number(quantity || 0)
                : type === 'OUT'
                ? Math.max(0, selectedProduct.quantity - Number(quantity || 0))
                : Number(quantity || 0)}{' '}
              units
            </strong>
          </div>
        )}

        <label>
          Reason / Reference
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Received from Supplier X, Machine Assembly Job #402"
            required
          />
        </label>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Recording...' : 'Record movement'}
          </button>
        </div>
      </form>
    </div>
  )
}
