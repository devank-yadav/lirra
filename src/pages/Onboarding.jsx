import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { cacheChildProfile } from '../lib/childrenApi'

export default function Onboarding() {
  const { isAuthed } = useAuth()
  const nav = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [childName, setChildName] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [language, setLanguage] = useState('en')
  const [hobbies, setHobbies] = useState('')
  const [condition, setCondition] = useState('')
  const [goal, setGoal] = useState('')

  // If user already has a child, skip onboarding
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!isAuthed) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { nav('/auth', { replace: true }); return }

        // If any child exists → go to dashboard
        const { count, error } = await supabase
          .from('children')
          .select('id', { head: true, count: 'exact' })
        if (error) throw error

        if ((count ?? 0) > 0) {
          nav('/dashboard', { replace: true })
          return
        }
      } catch (e) {
        console.warn(e)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [isAuthed, nav])

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      const payload = {
        user_id: user.id,
        name: childName.trim(),
        age: age ? Number(age) : null,
        gender: gender || null,
        hobbies: hobbies || null,
        condition: condition || null,
        goal: goal || null,
        language: language || 'en'
      }

      // Basic validation
      if (!payload.name) throw new Error('Please enter your child’s name.')

      // Insert first child
      const { data: child, error: cErr } = await supabase
        .from('children')
        .insert([payload])
        .select()
        .single()
      if (cErr) throw cErr

      cacheChildProfile(child)

      // Optional: mark profiles.onboarded = true
      try {
        await supabase.from('profiles')
          .update({ onboarded: true })
          .eq('id', user.id)
      } catch (e) {
        // ignore if the column doesn't exist
      }

      // Go to dashboard
      nav('/dashboard', { replace: true })
    } catch (e) {
      setErr(e.message || 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
          <b>Loading…</b>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
        <h2 className="h2">Tell us about your child</h2>
        <p className="p">We’ll personalize stories and exercises based on this info. You can edit later.</p>

        <form className="form" onSubmit={onSubmit}>
          <div className="row" style={{ gap: 16 }}>
            <div style={{ flex: 2 }}>
              <label>Child’s name</label>
              <input value={childName} onChange={e=>setChildName(e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <label>Age</label>
              <input type="number" min="1" max="17" value={age} onChange={e=>setAge(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Language</label>
              <select value={language} onChange={e=>setLanguage(e.target.value)}>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="hi">Hindi</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ar">Arabic</option>
                <option value="zh">Chinese</option>
                <option value="pt">Portuguese</option>
                <option value="bn">Bengali</option>
                <option value="ta">Tamil</option>
                {/* add more as needed */}
              </select>
            </div>
          </div>

          <div className="row" style={{ gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label>Gender (optional)</label>
              <select value={gender} onChange={e=>setGender(e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="girl">Girl</option>
                <option value="boy">Boy</option>
                <option value="nonbinary">Non-binary</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label>Hobbies / interests (optional)</label>
              <input placeholder="e.g. space, art, dogs" value={hobbies} onChange={e=>setHobbies(e.target.value)} />
            </div>
          </div>

          <div>
            <label>Health condition or focus (optional)</label>
            <input placeholder="e.g. asthma, anxiety, making friends" value={condition} onChange={e=>setCondition(e.target.value)} />
          </div>

          <div>
            <label>Your goal for these stories (optional)</label>
            <input placeholder="e.g. reduce fear of injections; better sleep" value={goal} onChange={e=>setGoal(e.target.value)} />
          </div>

          {err && <p className="p" style={{ color: 'var(--danger)' }}>{err}</p>}

          <div className="row" style={{ justifyContent:'flex-end', gap: 8 }}>
            <button type="button" className="btn-ghost" onClick={()=>nav('/dashboard')}>Skip for now</button>
            <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Continue'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
