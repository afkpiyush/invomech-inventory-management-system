import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Filter, RefreshCw, Search } from 'lucide-react'
import { getAuditLogs, type AuditLogEntry } from '../api'

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    getAuditLogs()
      .then((res) => {
        setEntries(res.entries)
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

  const actions = Array.from(new Set(entries.map((e) => e.action)))

  const filtered = entries.filter((e) => {
    const matchesAction = actionFilter === 'all' || e.action === actionFilter
    const query = search.toLowerCase()
    const matchesSearch =
      !query ||
      e.action.toLowerCase().includes(query) ||
      e.entity_type.toLowerCase().includes(query) ||
      (e.user_name && e.user_name.toLowerCase().includes(query)) ||
      JSON.stringify(e.metadata_json).toLowerCase().includes(query)
    return matchesAction && matchesSearch
  })

  const formatMeta = (meta: Record<string, unknown> | string) => {
    try {
      if (typeof meta === 'string') {
        return meta
      }
      const keys = Object.keys(meta)
      if (keys.length === 0) return '—'
      return JSON.stringify(meta)
    } catch {
      return String(meta)
    }
  }

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <div>
          <span className="eyebrow">COMPLIANCE & TRACEABILITY</span>
          <h2>System Audit Trail</h2>
          <p>Immutable event log of security, warehouse, and procurement modifications.</p>
        </div>
        <div className="heading-actions">
          <button className="date-button" onClick={handleRefresh} title="Refresh audit log">
            <RefreshCw size={14} /> Refresh
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
            placeholder="Search audit trail by user, action, entity..."
          />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} aria-label="Filter action">
          <option value="all">All actions ({entries.length})</option>
          {actions.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>
        {(actionFilter !== 'all' || search) && (
          <button className="clear-filter" onClick={() => { setActionFilter('all'); setSearch('') }}>
            <Filter size={14} /> Clear filters
          </button>
        )}
      </div>

      <div className="card table-card">
        {loading ? (
          <div className="table-state">Loading audit logs...</div>
        ) : filtered.length === 0 ? (
          <div className="table-state">
            <ClipboardList size={28} />
            <strong>No audit events found</strong>
            <span>All system changes will be automatically recorded here.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Target Entity</th>
                  <th>Entity ID</th>
                  <th>Parameters / Payload</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {formatDate(entry.created_at)}
                      </span>
                    </td>
                    <td>
                      <strong>{entry.user_name ?? 'System Service'}</strong>
                    </td>
                    <td>
                      <span
                        className="status"
                        style={{
                          background: entry.action.includes('ARCHIVE') || entry.action.includes('REJECT')
                            ? '#ffebed'
                            : entry.action.includes('CREATE') || entry.action.includes('APPROVE')
                            ? '#e5f8f2'
                            : '#eff5ff',
                          color: entry.action.includes('ARCHIVE') || entry.action.includes('REJECT')
                            ? '#dc2626'
                            : entry.action.includes('CREATE') || entry.action.includes('APPROVE')
                            ? '#0e9f74'
                            : '#2563eb',
                        }}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize' }}>{entry.entity_type}</span>
                    </td>
                    <td>
                      {entry.entity_id ? (
                        <span style={{ fontWeight: 600 }}>#{entry.entity_id}</span>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <code
                        style={{
                          fontSize: 10,
                          background: 'var(--bg)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          display: 'inline-block',
                          maxWidth: 320,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={formatMeta(entry.metadata_json)}
                      >
                        {formatMeta(entry.metadata_json)}
                      </code>
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
