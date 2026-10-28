import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CloudSun,
  FileBarChart,
  LayoutDashboard,
  Menu,
  Moon,
  PackageCheck,
  PackageSearch,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Sun,
  Truck,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  getCurrentUser,
  getDashboard,
  getNotifications,
  login,
  logout,
  markNotificationRead,
  type AppNotification,
  type DashboardResponse,
  type User,
} from './api'
import InventoryPage from './pages/InventoryPage'
import StockMovementsPage from './pages/StockMovementsPage'
import SuppliersPage from './pages/SuppliersPage'
import PurchaseOrdersPage from './pages/PurchaseOrdersPage'
import GoodsReceivedPage from './pages/GoodsReceivedPage'
import ReportsPage from './pages/ReportsPage'
import AuditLogPage from './pages/AuditLogPage'
import SettingsPage from './pages/SettingsPage'
import './App.css'

type NavItem = { label: string; path: string; icon: typeof LayoutDashboard; adminOnly?: boolean }

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Inventory', path: '/inventory', icon: Boxes },
  { label: 'Stock Movements', path: '/stock-movements', icon: PackageSearch },
  { label: 'Suppliers', path: '/suppliers', icon: Truck },
  { label: 'Purchase Orders', path: '/purchase-orders', icon: ShoppingCart },
  { label: 'Goods Received', path: '/goods-received', icon: PackageCheck },
  { label: 'Reports', path: '/reports', icon: FileBarChart },
  { label: 'Audit Log', path: '/audit-log', icon: ClipboardList, adminOnly: true },
  { label: 'Settings', path: '/settings', icon: Settings },
]

const inr = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement>(null)

  const activeNavItem =
    navItems.find((item) => item.path === location.pathname) ??
    (location.pathname === '/' ? navItems[0] : navItems[0])
  const activePage = activeNavItem.label

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('invomech-theme') === 'dark')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentYear] = useState(() => new Date().getFullYear())
  const [profileOpen, setProfileOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const role = user?.role === 'admin' ? 'Admin' : 'Inventory Manager'
  const isAdmin = user?.role === 'admin'

  const refreshData = () => {
    return Promise.all([getDashboard(), getNotifications().catch(() => ({ notifications: [] }))])
      .then(([data, notifRes]) => {
        setDashboard(data)
        setNotifications(notifRes.notifications)
      })
      .catch((err: Error) => setError(err.message))
  }

  useEffect(() => {
    getCurrentUser()
      .then(({ user: currentUser }) => {
        setUser(currentUser)
        return Promise.all([getDashboard(), getNotifications().catch(() => ({ notifications: [] }))])
      })
      .then(([data, notifRes]) => {
        setDashboard(data)
        setNotifications(notifRes.notifications)
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  // Keyboard shortcut Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const visibleNav = navItems.filter((item) => !item.adminOnly || isAdmin)

  const filteredProducts = useMemo(
    () =>
      (dashboard?.products ?? []).filter((product) =>
        `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [dashboard?.products, search],
  )

  const toggleTheme = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('invomech-theme', next ? 'dark' : 'light')
  }

  const handleReadNotification = async (notifId: number) => {
    try {
      await markNotificationRead(notifId)
      setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, read_at: new Date().toISOString() } : n)))
    } catch {
      // ignore
    }
  }

  if (loading) return <div className="loading-screen">Loading INVOMECH workspace...</div>
  if (!user || !dashboard) {
    return (
      <LoginScreen
        darkMode={darkMode}
        onLogin={(nextUser) => {
          setUser(nextUser)
          refreshData().catch((requestError: Error) => setError(requestError.message))
        }}
        error={error}
      />
    )
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return (
    <div className={`app-shell ${darkMode ? 'dark' : ''}`}>
      <aside className={`sidebar ${sidebarOpen ? 'expanded' : 'collapsed'}`}>
        <div className="brand">
          <img src="/invomech-logo.png" alt="Invomech logo" />
          {sidebarOpen && (
            <div>
              <strong>INVOMECH</strong>
              <span>Inventory Suite</span>
            </div>
          )}
        </div>
        <div className="sidebar-section-label">{sidebarOpen ? 'WORKSPACE' : '•••'}</div>
        <nav>
          {visibleNav.map((item) => {
            const Icon = item.icon
            const isActive = activePage === item.label
            return (
              <button
                key={item.label}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                title={item.label}
              >
                <Icon size={18} strokeWidth={1.8} />
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && item.label === 'Inventory' && (
                  <span className="nav-count">{dashboard.kpis.total_products}</span>
                )}
                {sidebarOpen && item.label === 'Purchase Orders' && dashboard.kpis.open_purchase_orders > 0 && (
                  <span className="nav-count" style={{ background: '#f0eaff', color: '#8657d9' }}>
                    {dashboard.kpis.open_purchase_orders}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          {sidebarOpen && (
            <div
              className="help-card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/settings')}
            >
              <CloudSun size={18} />
              <div>
                <strong>System Ready</strong>
                <span>INVOMECH Enterprise</span>
              </div>
              <ChevronRight size={15} />
            </div>
          )}
          <button className="collapse-button" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}{' '}
            {sidebarOpen && 'Collapse menu'}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
          >
            <Menu size={21} />
          </button>
          <div className="search-box">
            <Search size={17} />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search catalogue, orders, SKU... (⌘K)"
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={toggleTheme} title="Toggle theme">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button notification-button"
              onClick={() => setAlertOpen(!alertOpen)}
              title="Notifications"
            >
              <Bell size={18} />
              {(unreadCount > 0 || dashboard.kpis.low_stock_items > 0) && <span />}
            </button>
            <div className="profile-wrap">
              <button className="profile-button" onClick={() => setProfileOpen(!profileOpen)}>
                <div className="avatar">
                  {user.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div className="profile-copy">
                  <strong>{user.name}</strong>
                  <span>{role}</span>
                </div>
                <ChevronDown size={15} />
              </button>
              {profileOpen && (
                <div className="popover profile-popover">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                  <hr />
                  <button
                    onClick={() => {
                      setProfileOpen(false)
                      navigate('/settings')
                    }}
                  >
                    Account settings
                  </button>
                  <button
                    onClick={() =>
                      logout().then(() => {
                        setUser(null)
                        setDashboard(null)
                      })
                    }
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
          {alertOpen && (
            <div className="popover notification-popover" style={{ width: 340, maxHeight: 380, overflowY: 'auto' }}>
              <div className="popover-heading">
                <strong>Notifications ({unreadCount} new)</strong>
                <button onClick={() => setAlertOpen(false)} aria-label="Close notifications">
                  <X size={15} />
                </button>
              </div>
              {dashboard.kpis.low_stock_items > 0 && (
                <div
                  className="notification"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setAlertOpen(false)
                    navigate('/inventory')
                  }}
                >
                  <span className="alert-dot" />
                  <div>
                    <strong>{dashboard.kpis.low_stock_items} low-stock items detected</strong>
                    <span>Click to view inventory alerts and restock.</span>
                  </div>
                </div>
              )}
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="notification"
                    style={{ opacity: n.read_at ? 0.65 : 1, cursor: 'pointer' }}
                    onClick={() => handleReadNotification(n.id)}
                  >
                    <span className={n.read_at ? 'blue-dot' : 'alert-dot'} />
                    <div style={{ flex: 1 }}>
                      <strong>{n.title}</strong>
                      <span style={{ fontSize: 10, lineHeight: 1.4 }}>{n.body}</span>
                    </div>
                  </div>
                ))
              ) : dashboard.kpis.low_stock_items === 0 ? (
                <div className="notification">
                  <span className="blue-dot" />
                  <div>
                    <strong>All systems nominal</strong>
                    <span>No open warnings. Stock is within safety thresholds.</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="breadcrumb">
                Workspace <ChevronRight size={13} /> {activePage}
              </div>
              <h1>{activePage}</h1>
              <p>
                {activePage === 'Dashboard'
                  ? 'Real-time overview of INVOMECH plant inventory and procurement operations.'
                  : `Manage your ${activePage.toLowerCase()} and keep operations running smoothly.`}
              </p>
            </div>
            <div className="heading-actions">
              <button className="date-button">{currentYear} live overview</button>
              {activePage !== 'Inventory' && (
                <button className="primary-button" onClick={() => navigate('/inventory')}>
                  <Plus size={16} /> Add product
                </button>
              )}
            </div>
          </div>

          {activePage === 'Dashboard' && (
            <Dashboard
              products={filteredProducts}
              data={dashboard}
              onNavigate={navigate}
            />
          )}

          {activePage === 'Inventory' && (
            <InventoryPage
              key={search}
              initialSearch={search}
              isAdmin={isAdmin}
              onCreateComplete={refreshData}
            />
          )}

          {activePage === 'Stock Movements' && <StockMovementsPage />}

          {activePage === 'Suppliers' && <SuppliersPage isAdmin={isAdmin} />}

          {activePage === 'Purchase Orders' && <PurchaseOrdersPage isAdmin={isAdmin} />}

          {activePage === 'Goods Received' && <GoodsReceivedPage />}

          {activePage === 'Reports' && <ReportsPage />}

          {activePage === 'Audit Log' && <AuditLogPage />}

          {activePage === 'Settings' && (
            <SettingsPage user={user} darkMode={darkMode} toggleTheme={toggleTheme} />
          )}
        </div>
      </main>
    </div>
  )
}

function Dashboard({
  products,
  data,
  onNavigate,
}: {
  products: DashboardResponse['products']
  data: DashboardResponse
  onNavigate: (path: string) => void
}) {
  return (
    <>
      <section className="kpi-grid">
        <div style={{ cursor: 'pointer' }} onClick={() => onNavigate('/inventory')}>
          <KpiCard
            icon={<Boxes />}
            label="Total products"
            value={String(data.kpis.total_products)}
            change="Live"
            note="in catalogue"
            color="blue"
          />
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => onNavigate('/reports')}>
          <KpiCard
            icon={<PackageCheck />}
            label="Stock valuation"
            value={inr(data.kpis.stock_value)}
            change="Live"
            note="plant assets"
            color="green"
          />
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => onNavigate('/inventory')}>
          <KpiCard
            icon={<AlertTriangle />}
            label="Low stock items"
            value={String(data.kpis.low_stock_items)}
            change={data.kpis.low_stock_items > 0 ? 'Warning' : 'Good'}
            note="requires attention"
            color="orange"
          />
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => onNavigate('/purchase-orders')}>
          <KpiCard
            icon={<ShoppingCart />}
            label="Open purchase orders"
            value={String(data.kpis.open_purchase_orders)}
            change="Active"
            note="procurement flow"
            color="purple"
          />
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="card chart-card">
          <div className="card-heading">
            <div>
              <h2>Inventory activity</h2>
              <p>Monthly sales issues and purchase intake valuation</p>
            </div>
            <button className="select-button" onClick={() => onNavigate('/stock-movements')}>
              View movements <ChevronRight size={14} />
            </button>
          </div>
          <div className="legend">
            <span>
              <i className="legend-sales" /> Sales / Issues
            </span>
            <span>
              <i className="legend-purchases" /> Purchases / Receipts
            </span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.activity}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="purchaseFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#20b486" stopOpacity={0.17} />
                    <stop offset="100%" stopColor="#20b486" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  tickFormatter={(value) => `${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    color: 'var(--text)',
                  }}
                  formatter={(value) => inr(Number(value))}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#2563eb"
                  fill="url(#salesFill)"
                  strokeWidth={2.5}
                />
                <Area
                  type="monotone"
                  dataKey="purchases"
                  stroke="#20b486"
                  fill="url(#purchaseFill)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card alerts-card">
          <div className="card-heading">
            <div>
              <h2>Low stock alerts</h2>
              <p>Items below minimum threshold</p>
            </div>
            <button className="text-button" onClick={() => onNavigate('/inventory')}>
              View all <ChevronRight size={14} />
            </button>
          </div>
          <div className="alert-list">
            {products
              .filter((item) => item.status !== 'In Stock')
              .slice(0, 4)
              .map((item) => (
                <div
                  className="alert-row"
                  key={item.sku}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onNavigate('/inventory')}
                >
                  <div className="alert-icon">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="alert-info">
                    <strong>{item.name}</strong>
                    <span>{item.sku} &bull; {item.category}</span>
                  </div>
                  <div className="alert-stock">
                    <strong>{item.quantity} units left</strong>
                    <span>Min. {item.minimum_quantity}</span>
                  </div>
                </div>
              ))}
            {products.filter((item) => item.status !== 'In Stock').length === 0 && (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)', fontSize: 12 }}>
                <CheckCircle2 size={24} style={{ color: '#0e9f74', margin: '0 auto 8px', display: 'block' }} />
                <strong>All stock levels healthy</strong>
                <p style={{ margin: '4px 0 0', fontSize: 11 }}>No items are below minimum safety margins.</p>
              </div>
            )}
          </div>
          <button className="outline-button" onClick={() => onNavigate('/purchase-orders')}>
            <Plus size={15} /> Create purchase requisition
          </button>
        </div>
      </section>

      <section className="card table-card">
        <div className="card-heading">
          <div>
            <h2>Recent inventory</h2>
            <p>Latest catalogue items</p>
          </div>
          <button className="text-button" onClick={() => onNavigate('/inventory')}>
            View full catalogue <ChevronRight size={14} />
          </button>
        </div>
        <InventoryTable products={products} onNavigate={onNavigate} />
      </section>
    </>
  )
}

function KpiCard({
  icon,
  label,
  value,
  change,
  note,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  change: string
  note: string
  color: string
}) {
  return (
    <div className="card kpi-card">
      <div className={`kpi-icon ${color}`}>{icon}</div>
      <div className="kpi-label">{label}</div>
      <strong className="kpi-value">{value}</strong>
      <div className="kpi-change">
        <span className={change === 'Good' || change === 'Live' ? 'positive' : 'negative'}>
          {change}
        </span>{' '}
        <small>{note}</small>
      </div>
    </div>
  )
}

function InventoryTable({
  products,
  onNavigate,
}: {
  products: DashboardResponse['products']
  onNavigate: (path: string) => void
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>In stock</th>
            <th>Minimum level</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.sku}>
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
              <td>
                <span className={`status ${product.status.toLowerCase().replace(' ', '-')}`}>
                  {product.status}
                </span>
              </td>
              <td>
                <button
                  className="more-button"
                  onClick={() => onNavigate('/inventory')}
                  title="View in inventory"
                >
                  •••
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LoginScreen({
  darkMode,
  onLogin,
  error,
}: {
  darkMode: boolean
  onLogin: (user: User) => void
  error: string
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(error)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    login(email, password)
      .then(({ user }) => onLogin(user))
      .catch((requestError: Error) => setMessage(requestError.message))
      .finally(() => setSubmitting(false))
  }

  const fillAccount = (e: string, p: string) => {
    setEmail(e)
    setPassword(p)
  }

  return (
    <div className={`login-screen ${darkMode ? 'dark' : ''}`}>
      <div className="login-card">
        <img src="/invomech-logo.png" alt="Invomech logo" />
        <span className="login-eyebrow">INVOMECH INVENTORY SUITE</span>
        <h1>Welcome back</h1>
        <p>Sign in to manage plant inventory, procurement, and warehouse workflows.</p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@invomech.local"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {message && <div className="form-error">{message}</div>}
          <button className="primary-button" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in to workspace'}
          </button>
        </form>

        <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>
            Quick fill demo credentials:
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="date-button"
              style={{ fontSize: 10, height: 26 }}
              onClick={() => fillAccount('admin@invomech.local', 'Invomech@Admin123!')}
            >
              Admin
            </button>
            <button
              type="button"
              className="date-button"
              style={{ fontSize: 10, height: 26 }}
              onClick={() => fillAccount('manager@invomech.local', 'Invomech@Manager123!')}
            >
              Manager
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
