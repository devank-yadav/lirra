import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  fetchChildProfile,
  saveChildProfile,
  getCachedChildProfile
} from '../lib/childrenApi'

export default function Settings() {
  const [child, setChild] = useState({})
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { logout } = useAuth()

  useEffect(() => {
    const cached = getCachedChildProfile()
    if (cached) setChild({ ...cached, age: cached.age ?? '' })

    let isMounted = true
    ;(async () => {
      try {
        const profile = await fetchChildProfile()
        if (!isMounted) return
        if (profile) setChild({ ...profile, age: profile.age ?? '' })
      } catch (e) {
        if (!isMounted) return
        setError(e.message || 'Unable to load profile')
      } finally {
        if (isMounted) setLoadingProfile(false)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [])

  const sessions = useMemo(() => JSON.parse(localStorage.getItem('sessionLogs') || '[]'), [])
  const stories = useMemo(() => JSON.parse(localStorage.getItem('stories') || '[]'), [])

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const updateField = (key, value) => {
    setChild(prev => ({ ...prev, [key]: value }))
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const saved = await saveChildProfile(child)
      if (saved) setChild({ ...saved, age: saved.age ?? '' })
      alert('Saved!')
    } catch (e) {
      setError(e.message || 'Unable to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* SETTINGS FORM */}
      <div
        className="container"
        style={{
          maxWidth: '720px',
          padding: '40px 0 170px',
          alignContent: 'center'
        }}
      >
        <div className="card" style={{ padding: '20px 24px 16px' }}>
          <h2 className="h2">Myself</h2>

          {/* Child Profile Form */}
          <form className="form" onSubmit={save}>
            <div className="two">
              <div>
                <label>Name</label>
                <input
                  value={child.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  disabled={loadingProfile}
                />
              </div>
              <div>
                <label>Age</label>
                <input
                  type="number"
                  value={child.age || ''}
                  onChange={(e) => updateField('age', e.target.value)}
                  disabled={loadingProfile}
                />
              </div>
            </div>
            <div className="two">
              <div>
                <label>Hobbies</label>
                <input
                  value={child.hobbies || ''}
                  onChange={(e) => updateField('hobbies', e.target.value)}
                  disabled={loadingProfile}
                />
              </div>
              <div>
                <label>Condition</label>
                <input
                  value={child.condition || ''}
                  onChange={(e) => updateField('condition', e.target.value)}
                  disabled={loadingProfile}
                />
              </div>
            </div>
            <div>
              <label>Preferred language</label>
              <select
                value={child.language || 'en'}
                  onChange={(e) => updateField('language', e.target.value)}
                  disabled={loadingProfile}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
              </select>
            </div>
            {error && (
              <p className="p" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            )}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" disabled={loadingProfile || saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>

        {/* PROGRESS SECTION */}
        <div className="card" style={{ padding: '24px', marginTop: '40px' }}>
          <h2 className="h2">Progress</h2>
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div className="card" style={{ padding: 16 }}>
              <h3 className="h2">Stories completed</h3>
              <p className="p">{sessions.length}</p>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <h3 className="h2">Stories created</h3>
              <p className="p">{stories.length}</p>
            </div>
          </div>
        </div>

        {/* ACCOUNT SECTION */}
        <div className="card" style={{ padding: '24px', marginTop: '40px' }}>
          <h2 className="h2">Account</h2>
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0' }}>
                Sign out from your current session
              </p>
            </div>
            <button
              className="btn"
              onClick={handleLogout}
              style={{
                background: 'var(--primary)',
                color: '#fff',
                boxShadow: '0 4px 0 var(--primary-700)',
                fontSize: '14px',
                fontWeight: '600',
                padding: '10px 16px',
                borderRadius: '12px',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                border: 'none',
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-1px)'
                e.target.style.boxShadow = '0 6px 0 var(--primary-700)'
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = '0 4px 0 var(--primary-700)'
              }}
            >
              <span style={{ fontSize: '16px' }}>↪️</span> Logout
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
