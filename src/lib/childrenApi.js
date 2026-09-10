import { supabase } from './supabaseClient'

const STORAGE_KEY = 'childProfile'

/**
 * Fetch the current user's child profile from Supabase.
 * Returns null if the user is not signed in or no profile exists yet.
 */
export async function fetchChildProfile() {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) return null

  const { data, error, status } = await supabase
    .from('children')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error && status !== 406) throw error

  if (data) {
    cacheChildProfile(data)
  }

  return data
}

/**
 * Insert or update the child profile for the current user.
 * Accepts a partial profile object; user_id is inferred from the session.
 */
export async function saveChildProfile(updates) {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not signed in')

  const payload = {
    name: updates.name?.trim() || null,
    age: updates.age != null && updates.age !== '' ? Number(updates.age) : null,
    gender: updates.gender || null,
    hobbies: updates.hobbies || null,
    condition: updates.condition || null,
    goal: updates.goal || null,
    language: updates.language || 'en',
    user_id: updates.user_id || user.id
  }

  // Preserve id when updating an existing child record
  if (updates.id) payload.id = updates.id

  const query = supabase.from('children')
  const action = updates.id ? query.update(payload).eq('id', updates.id) : query.insert([payload])

  const { data, error } = await action.select().maybeSingle()
  if (error) throw error

  if (data) {
    cacheChildProfile(data)
  }

  return data
}

export function getCachedChildProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    console.warn('Failed to read child profile from storage', e)
    return null
  }
}

export function cacheChildProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch (e) {
    console.warn('Failed to write child profile to storage', e)
  }
}
