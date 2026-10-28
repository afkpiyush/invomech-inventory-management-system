import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Building2, Mail, MapPin, Phone, Plus, RefreshCw, Search, Truck, X } from 'lucide-react'
import { createSupplier, getSuppliers, type Supplier } from '../api'

export default function SuppliersPage({ isAdmin }: { isAdmin: boolean }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    getSuppliers()
      .then((res) => {
        setSuppliers(res.suppliers)
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

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
      (s.phone && s.phone.includes(search)) ||
      (s.address && s.address.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <div>
          <span className="eyebrow">PROCUREMENT</span>
          <h2>Suppliers & Vendors</h2>
          <p>{suppliers.length} authorized engineering and raw material suppliers.</p>
        </div>
        <div className="heading-actions">
          <button className="date-button" onClick={handleRefresh} title="Refresh suppliers">
            <RefreshCw size={14} /> Refresh
          </button>
          {isAdmin && (
            <button className="primary-button" onClick={() => setDialogOpen(true)}>
              <Plus size={16} /> Add supplier
            </button>
          )}
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
            placeholder="Search suppliers by company name, email, or city..."
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
          <div className="table-state">Loading suppliers directory...</div>
        ) : filtered.length === 0 ? (
          <div className="table-state">
            <Truck size={28} />
            <strong>No suppliers found</strong>
            <span>Add a supplier to connect products and generate purchase orders.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Contact Email</th>
                  <th>Phone</th>
                  <th>Registered Address</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="product-cell">
                        <span className="product-thumb">
                          <Building2 size={16} />
                        </span>
                        <div>
                          <strong>{s.name}</strong>
                          <span>Supplier #{s.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {s.email ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Mail size={13} style={{ color: 'var(--muted)' }} /> {s.email}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {s.phone ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Phone size={13} style={{ color: 'var(--muted)' }} /> {s.phone}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {s.address ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <MapPin size={13} style={{ color: 'var(--muted)' }} /> {s.address}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`status ${s.is_demo ? 'low-stock' : 'in-stock'}`}>
                        {s.is_demo ? 'Demo Partner' : 'Active Vendor'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialogOpen && (
        <AddSupplierDialog
          saving={saving}
          onClose={() => setDialogOpen(false)}
          onSubmit={async (input) => {
            setSaving(true)
            try {
              await createSupplier(input)
              setDialogOpen(false)
              load()
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

function AddSupplierDialog({
  saving,
  onClose,
  onSubmit,
}: {
  saving: boolean
  onClose: () => void
  onSubmit: (input: { name: string; email?: string; phone?: string; address?: string }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [validation, setValidation] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setValidation('Supplier company name is required.')
      return
    }
    onSubmit({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">NEW VENDOR</span>
            <h2>Add supplier</h2>
            <p>Register a new components or raw materials provider.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>

        {validation && <div className="form-error">{validation}</div>}

        <label>
          Company / Supplier Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Apex Pneumatics & Controls"
            required
          />
        </label>

        <div className="form-grid">
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sales@supplier.com"
            />
          </label>
          <label>
            Phone number
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </label>
        </div>

        <label>
          Office / Facility Address
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Plot 42, GIDC Industrial Estate, Vatva, Ahmedabad"
          />
        </label>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Saving...' : 'Add supplier'}
          </button>
        </div>
      </form>
    </div>
  )
}
