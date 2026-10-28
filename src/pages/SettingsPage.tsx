import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2, Save, ShieldCheck } from 'lucide-react'
import { getCompanySettings, updateCompanySettings, type CompanySettings, type User } from '../api'

export default function SettingsPage({ user, darkMode, toggleTheme }: { user: User; darkMode: boolean; toggleTheme: () => void }) {
  const [settings, setSettings] = useState<CompanySettings>({
    companyName: 'INVOMECH PVT. LTD.',
    tagline: 'Manufacturer of all kind of packaging machines and Engineering solutions provider.',
    currency: 'INR',
    lowStockThresholdRatio: '1.0',
    contactEmail: 'contact@invomech.local',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const isAdmin = user.role === 'admin'

  const load = useCallback(() => {
    getCompanySettings()
      .then((data) => {
        setSettings(data)
        setError('')
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    setSaving(true)
    setSuccess('')
    setError('')
    try {
      await updateCompanySettings({
        companyName: settings.companyName,
        tagline: settings.tagline,
        contactEmail: settings.contactEmail,
      })
      setSuccess('Company settings saved successfully.')
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="workspace-page">
      <div className="workspace-toolbar">
        <div>
          <span className="eyebrow">SYSTEM & PREFERENCES</span>
          <h2>Settings & Configuration</h2>
          <p>Company details, security credentials, and application preferences.</p>
        </div>
      </div>

      {success && <div className="success-banner" role="status"><CheckCircle2 size={16} /> {success}</div>}
      {error && <div className="error-banner" role="alert">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(300px, 1fr)', gap: 20 }}>
        <form className="card" style={{ padding: 24 }} onSubmit={handleSubmit}>
          <div className="card-heading" style={{ marginBottom: 18 }}>
            <div>
              <h2>Organization Profile</h2>
              <p>Branding applied across documents and exported purchase orders</p>
            </div>
            {isAdmin && (
              <button type="submit" className="primary-button" disabled={saving || loading}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save changes'}
              </button>
            )}
          </div>

          <label>
            Company Legal Name
            <input
              value={settings.companyName}
              onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
              disabled={!isAdmin}
              required
            />
          </label>

          <label>
            Corporate Tagline / Description
            <textarea
              style={{
                width: '100%',
                minHeight: 70,
                border: '1px solid var(--border)',
                borderRadius: 7,
                padding: 10,
                background: 'var(--bg)',
                color: 'var(--text)',
                fontFamily: 'inherit',
                fontSize: 12,
                marginTop: 6,
                boxSizing: 'border-box',
              }}
              value={settings.tagline}
              onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
              disabled={!isAdmin}
            />
          </label>

          <div className="form-grid">
            <label>
              Default Currency
              <input value={settings.currency} disabled />
            </label>
            <label>
              Official Contact Email
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                disabled={!isAdmin}
              />
            </label>
          </div>

          {!isAdmin && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
              Note: Only administrators can update organization settings.
            </div>
          )}
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div className="card-heading" style={{ marginBottom: 14 }}>
              <div>
                <h2>Your Account</h2>
                <p>Authenticated session</p>
              </div>
              <span className="status in-stock" style={{ textTransform: 'capitalize' }}>
                {user.role.replace('_', ' ')}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div className="avatar" style={{ width: 42, height: 42, fontSize: 15 }}>
                {user.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
              </div>
              <div>
                <strong style={{ fontSize: 14, display: 'block' }}>{user.name}</strong>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{user.email}</span>
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span>Security role:</span>
              <strong style={{ color: 'var(--text)' }}>
                {isAdmin ? 'Full Administrative Access' : 'Warehouse Inventory Operations'}
              </strong>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="card-heading" style={{ marginBottom: 14 }}>
              <div>
                <h2>System & Environment</h2>
                <p>Platform status</p>
              </div>
              <ShieldCheck size={18} style={{ color: '#0e9f74' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--muted)' }}>Theme:</span>
                <button
                  type="button"
                  className="date-button"
                  style={{ height: 26, padding: '0 8px', fontSize: 10 }}
                  onClick={toggleTheme}
                >
                  {darkMode ? 'Dark theme active' : 'Light theme active'}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--muted)' }}>Database engine:</span>
                <strong>MySQL 8 (InnoDB)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--muted)' }}>API Security:</span>
                <strong>CSRF + HTTP-Only Session</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Version:</span>
                <strong>INVOMECH v1.0.0</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
