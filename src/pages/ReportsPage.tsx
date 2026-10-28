import { useEffect, useMemo, useState } from 'react'
import { Download, FileBarChart, PieChart, RefreshCw } from 'lucide-react'
import { downloadInventoryCsv, getCategories, getInventory, type Category, type Product } from '../api'

const inr = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

export default function ReportsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    Promise.all([getInventory(), getCategories()])
      .then(([invRes, catRes]) => {
        setProducts(invRes.products)
        setCategories(catRes.categories)
        setError('')
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  const handleRefresh = () => {
    setLoading(true)
    load()
  }

  useEffect(() => {
    load()
  }, [])

  const handleDownloadCsv = async () => {
    setDownloading(true)
    try {
      await downloadInventoryCsv()
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setDownloading(false)
    }
  }

  const categoryStats = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {}
    categories.forEach((c) => {
      map[c.name] = { count: 0, value: 0 }
    })
    products.forEach((p) => {
      const cat = p.category || 'Other'
      if (!map[cat]) map[cat] = { count: 0, value: 0 }
      map[cat].count += 1
      map[cat].value += p.quantity * p.unit_price
    })
    const totalVal = products.reduce((sum, p) => sum + p.quantity * p.unit_price, 0)
    return Object.entries(map).map(([name, data]) => ({
      name,
      count: data.count,
      value: data.value,
      percentage: totalVal > 0 ? ((data.value / totalVal) * 100).toFixed(1) : '0',
    }))
  }, [products, categories])

  const totalValue = products.reduce((sum, p) => sum + p.quantity * p.unit_price, 0)
  const totalUnits = products.reduce((sum, p) => sum + p.quantity, 0)
  const lowStockCount = products.filter((p) => p.status !== 'In Stock').length
  const healthyCount = products.length - lowStockCount

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <div>
          <span className="eyebrow">ANALYTICS & EXPORTS</span>
          <h2>Inventory & Valuation Reports</h2>
          <p>Financial breakdown of plant assets, raw materials, and components.</p>
        </div>
        <div className="heading-actions">
          <button className="date-button" onClick={handleRefresh} title="Refresh reports">
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="primary-button" onClick={handleDownloadCsv} disabled={downloading}>
            <Download size={16} /> {downloading ? 'Downloading...' : 'Export Inventory (CSV)'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={handleRefresh}>Retry</button>
        </div>
      )}

      <div className="kpi-grid">
        <div className="card kpi-card">
          <div className="kpi-icon green">
            <PieChart />
          </div>
          <div className="kpi-label">Total Inventory Valuation</div>
          <strong className="kpi-value">{inr(totalValue)}</strong>
          <div className="kpi-change">
            <span className="positive">Live Asset Value</span> <small>across warehouse</small>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon blue">
            <FileBarChart />
          </div>
          <div className="kpi-label">Total Units on Hand</div>
          <strong className="kpi-value">{totalUnits.toLocaleString()} units</strong>
          <div className="kpi-change">
            <span>{products.length} distinct SKUs</span>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon orange">
            <FileBarChart />
          </div>
          <div className="kpi-label">Stock Health Ratio</div>
          <strong className="kpi-value">
            {products.length > 0 ? Math.round((healthyCount / products.length) * 100) : 100}%
          </strong>
          <div className="kpi-change">
            <span className={lowStockCount > 0 ? 'negative' : 'positive'}>
              {healthyCount} normal / {lowStockCount} alert
            </span>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon purple">
            <Download />
          </div>
          <div className="kpi-label">Ready for Audit Export</div>
          <strong className="kpi-value">CSV Format</strong>
          <div className="kpi-change">
            <span className="positive" style={{ cursor: 'pointer' }} onClick={handleDownloadCsv}>
              Click to download
            </span>
          </div>
        </div>
      </div>

      <div className="card table-card" style={{ marginBottom: 20 }}>
        <div className="card-heading">
          <div>
            <h2>Category Valuation Breakdown</h2>
            <p>Asset allocation across component families</p>
          </div>
        </div>
        {loading ? (
          <div className="table-state">Calculating valuation reports...</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>SKU Count</th>
                  <th>Total Valuation (INR)</th>
                  <th>Valuation Share</th>
                  <th>Portfolio Distribution</th>
                </tr>
              </thead>
              <tbody>
                {categoryStats.map((c) => (
                  <tr key={c.name}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>{c.count} items</td>
                    <td>
                      <strong>{inr(c.value)}</strong>
                    </td>
                    <td>{c.percentage}%</td>
                    <td>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: 160,
                          height: 6,
                          background: 'var(--border)',
                          borderRadius: 3,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${c.percentage}%`,
                            height: '100%',
                            background: 'var(--blue)',
                            borderRadius: 3,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
