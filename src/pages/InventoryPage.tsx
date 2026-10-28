import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Boxes,
  CheckCircle2,
  Edit2,
  Filter,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  createInventoryProduct,
  deleteInventoryProduct,
  getCategories,
  getInventory,
  recordStockMovement,
  updateInventoryProduct,
  type Category,
  type Product,
} from '../api'

const inr = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

type Props = {
  initialSearch: string
  isAdmin?: boolean
  onCreateComplete: () => void
}

export default function InventoryPage({ initialSearch, isAdmin = false, onCreateComplete }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState(initialSearch)
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [movementProduct, setMovementProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(() => {
    Promise.all([getInventory(search), getCategories()])
      .then(([inventory, categoryResponse]) => {
        setProducts(inventory.products)
        setCategories(categoryResponse.categories)
        setError('')
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  const visibleProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          (category === 'all' || product.category === category) &&
          (status === 'all' || product.status === status),
      ),
    [products, category, status],
  )

  const clearFilters = () => {
    setSearch('')
    setCategory('all')
    setStatus('all')
  }

  const handleDelete = async (prod: Product) => {
    if (!window.confirm(`Are you sure you want to archive product "${prod.name}" (${prod.sku})?`)) return
    try {
      await deleteInventoryProduct(prod.id)
      setSuccess(`Product "${prod.name}" archived successfully.`)
      load()
      onCreateComplete()
    } catch (err: unknown) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <div>
          <span className="eyebrow">CATALOGUE</span>
          <h2>Inventory catalogue</h2>
          <p>{products.length} products currently tracked in the warehouse.</p>
        </div>
        <div className="heading-actions">
          <button className="date-button" onClick={load} title="Refresh inventory">
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="primary-button"
            onClick={() => {
              setSuccess('')
              setDialogOpen(true)
            }}
          >
            <Plus size={16} /> Add product
          </button>
        </div>
      </div>

      {success && (
        <div className="success-banner" role="status">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={load}>Retry</button>
        </div>
      )}

      <div className="card filter-panel">
        <div className="filter-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => {
              setLoading(true)
              setSearch(event.target.value)
            }}
            placeholder="Search by product name or SKU"
            aria-label="Search inventory"
          />
        </div>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option value={item.name} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by stock status"
        >
          <option value="all">All statuses</option>
          <option>In Stock</option>
          <option>Low Stock</option>
          <option>Critical</option>
        </select>
        {(category !== 'all' || status !== 'all' || search) && (
          <button className="clear-filter" onClick={clearFilters}>
            <Filter size={14} /> Clear filters
          </button>
        )}
      </div>

      <div className="card table-card inventory-table-card">
        {loading ? (
          <div className="table-state">Loading inventory catalogue...</div>
        ) : visibleProducts.length === 0 ? (
          <div className="table-state">
            <Boxes size={25} />
            <strong>No inventory records found</strong>
            <span>Adjust your filters or add a new product.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Product / SKU</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Minimum</th>
                  <th>Unit cost</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="product-cell">
                        <span className="product-thumb">
                          <Boxes size={16} />
                        </span>
                        <div>
                          <strong>{product.name}</strong>
                          <span>{product.sku}</span>
                        </div>
                      </div>
                    </td>
                    <td>{product.category}</td>
                    <td>
                      <strong>{product.quantity}</strong> units
                    </td>
                    <td>{product.minimum_quantity} units</td>
                    <td>{inr(product.unit_price)}</td>
                    <td>
                      <span className={`status ${product.status.toLowerCase().replace(' ', '-')}`}>
                        {product.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          className="date-button"
                          style={{ height: 28, padding: '0 8px', fontSize: 10 }}
                          onClick={() => setMovementProduct(product)}
                          title="Record Stock Movement / Adjustment"
                        >
                          <PackagePlus size={12} /> Move
                        </button>
                        <button
                          className="date-button"
                          style={{ height: 28, padding: '0 8px', fontSize: 10 }}
                          onClick={() => setEditingProduct(product)}
                          title="Edit product parameters"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        {isAdmin && (
                          <button
                            className="date-button"
                            style={{ height: 28, padding: '0 8px', fontSize: 10, color: '#ef4444' }}
                            onClick={() => handleDelete(product)}
                            title="Archive product"
                          >
                            <Trash2 size={12} />
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

      {dialogOpen && (
        <ProductDialog
          categories={categories}
          saving={saving}
          onClose={() => setDialogOpen(false)}
          onSubmit={(input) => {
            setSaving(true)
            setError('')
            createInventoryProduct(input)
              .then(() => {
                setDialogOpen(false)
                setSuccess('Product created and saved to the catalogue.')
                load()
                onCreateComplete()
              })
              .catch((requestError: Error) => setError(requestError.message))
              .finally(() => setSaving(false))
          }}
        />
      )}

      {editingProduct && (
        <EditProductDialog
          product={editingProduct}
          categories={categories}
          saving={saving}
          onClose={() => setEditingProduct(null)}
          onSubmit={async (input) => {
            setSaving(true)
            try {
              await updateInventoryProduct(editingProduct.id, input)
              setEditingProduct(null)
              setSuccess(`Product "${editingProduct.name}" updated successfully.`)
              load()
              onCreateComplete()
            } catch (err: unknown) {
              setError((err as Error).message)
            } finally {
              setSaving(false)
            }
          }}
        />
      )}

      {movementProduct && (
        <ProductMovementDialog
          product={movementProduct}
          saving={saving}
          onClose={() => setMovementProduct(null)}
          onSubmit={async (input) => {
            setSaving(true)
            try {
              await recordStockMovement(movementProduct.id, input)
              setMovementProduct(null)
              setSuccess(`Stock updated for "${movementProduct.name}".`)
              load()
              onCreateComplete()
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

function ProductDialog({
  categories,
  saving,
  onClose,
  onSubmit,
}: {
  categories: Category[]
  saving: boolean
  onClose: () => void
  onSubmit: (input: {
    sku: string
    name: string
    categoryId: number
    quantity: number
    minimumQuantity: number
    reorderQuantity: number
    unitPrice: number
  }) => void
}) {
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id.toString() ?? '')
  const [quantity, setQuantity] = useState('0')
  const [minimum, setMinimum] = useState('0')
  const [reorder, setReorder] = useState('1')
  const [unitPrice, setUnitPrice] = useState('0')
  const [validation, setValidation] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !sku.trim() || !categoryId) {
      setValidation('Product name, SKU, and category are required.')
      return
    }
    onSubmit({
      name: name.trim(),
      sku: sku.trim(),
      categoryId: Number(categoryId),
      quantity: Number(quantity),
      minimumQuantity: Number(minimum),
      reorderQuantity: Number(reorder),
      unitPrice: Number(unitPrice),
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal product-dialog"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">CATALOGUE</span>
            <h2>Add product</h2>
            <p>Save a new inventory record to the database.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>
        {validation && (
          <div className="form-error" role="alert">
            {validation}
          </div>
        )}
        <label>
          Product name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <div className="form-grid">
          <label>
            SKU
            <input value={sku} onChange={(event) => setSku(event.target.value)} required />
          </label>
          <label>
            Category
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
            >
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Opening quantity
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <label>
            Minimum quantity
            <input
              type="number"
              min="0"
              value={minimum}
              onChange={(event) => setMinimum(event.target.value)}
            />
          </label>
          <label>
            Reorder quantity
            <input
              type="number"
              min="1"
              value={reorder}
              onChange={(event) => setReorder(event.target.value)}
            />
          </label>
          <label>
            Unit cost (INR)
            <input
              type="number"
              min="0"
              step="0.01"
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Saving...' : 'Create product'}
          </button>
        </div>
      </form>
    </div>
  )
}

function EditProductDialog({
  product,
  categories,
  saving,
  onClose,
  onSubmit,
}: {
  product: Product
  categories: Category[]
  saving: boolean
  onClose: () => void
  onSubmit: (input: {
    sku?: string
    name?: string
    categoryId?: number
    minimumQuantity?: number
    reorderQuantity?: number
    unitPrice?: number
  }) => Promise<void>
}) {
  const [name, setName] = useState(product.name)
  const [sku, setSku] = useState(product.sku)
  const currentCat = categories.find((c) => c.name === product.category)
  const [categoryId, setCategoryId] = useState<string>(currentCat?.id.toString() ?? categories[0]?.id.toString() ?? '')
  const [minimum, setMinimum] = useState(String(product.minimum_quantity))
  const [reorder, setReorder] = useState(String(product.reorder_quantity || 1))
  const [unitPrice, setUnitPrice] = useState(String(product.unit_price))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({
      name: name.trim(),
      sku: sku.trim(),
      categoryId: Number(categoryId),
      minimumQuantity: Number(minimum),
      reorderQuantity: Number(reorder),
      unitPrice: Number(unitPrice),
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal product-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">EDIT RECORD</span>
            <h2>Edit {product.sku}</h2>
            <p>Update inventory rules, category, or pricing.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>
        <label>
          Product name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="form-grid">
          <label>
            SKU
            <input value={sku} onChange={(e) => setSku(e.target.value)} required />
          </label>
          <label>
            Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              {categories.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Minimum safety quantity
            <input
              type="number"
              min="0"
              value={minimum}
              onChange={(e) => setMinimum(e.target.value)}
            />
          </label>
          <label>
            Reorder batch quantity
            <input
              type="number"
              min="1"
              value={reorder}
              onChange={(e) => setReorder(e.target.value)}
            />
          </label>
          <label>
            Unit cost (INR)
            <input
              type="number"
              min="0"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Updating...' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

function ProductMovementDialog({
  product,
  saving,
  onClose,
  onSubmit,
}: {
  product: Product
  saving: boolean
  onClose: () => void
  onSubmit: (input: { type: 'IN' | 'OUT' | 'ADJUSTMENT'; quantity: number; reason: string }) => Promise<void>
}) {
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const [validation, setValidation] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const q = Number(quantity)
    if (isNaN(q) || (type !== 'ADJUSTMENT' && q <= 0) || (type === 'ADJUSTMENT' && q < 0)) {
      setValidation('Please enter a valid quantity.')
      return
    }
    if (type === 'OUT' && q > product.quantity) {
      setValidation(`Cannot issue ${q} units. Only ${product.quantity} in stock.`)
      return
    }
    if (!reason.trim()) {
      setValidation('Reason is required.')
      return
    }
    onSubmit({ type, quantity: q, reason: reason.trim() })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">STOCK ADJUSTMENT</span>
            <h2>{product.name}</h2>
            <p>SKU: {product.sku} &bull; Current stock: {product.quantity} units</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>

        {validation && <div className="form-error">{validation}</div>}

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
            {type === 'ADJUSTMENT' ? 'New absolute quantity' : 'Quantity'}
            <input
              type="number"
              min={type === 'ADJUSTMENT' ? '0' : '1'}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>
        </div>

        <label>
          Reason / Reference
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Audit reconciliation, damage disposal, machine build issue"
            required
          />
        </label>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Recording...' : 'Update stock'}
          </button>
        </div>
      </form>
    </div>
  )
}
