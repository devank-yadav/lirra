import { supabase } from './supabaseClient'

const API_BASE_URL = import.meta.env.VITE_STORY_API_URL

function guessExtension(mimeType) {
  if (!mimeType) return 'webm'
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('mpeg')) return 'mp3'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

export async function submitRecording({ blob, mimeType, child }) {
  if (!API_BASE_URL) {
    throw new Error('VITE_STORY_API_URL is not configured')
  }
  if (!(blob instanceof Blob)) {
    throw new Error('Recording blob is required')
  }

  const { data: sessionData, error } = await supabase.auth.getSession()
  if (error) throw error

  const accessToken = sessionData?.session?.access_token

  const form = new FormData()
  const ext = guessExtension(mimeType)
  form.append('audio', blob, `recording.${ext}`)
  if (child?.name) form.append('child_name', child.name)
  if (child?.age != null && child.age !== '') form.append('child_age', String(child.age))
  if (child?.language) form.append('child_language', child.language)
  if (child?.id) form.append('child_id', child.id)

  const headers = {}
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/story`, {
    method: 'POST',
    headers,
    body: form
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(detail || 'Story API returned an error')
  }

  const result = await res.json()

  if (result.audio_base64) {
    const binary = atob(result.audio_base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    const type = result.mime_type || 'audio/mpeg'
    result.audio_blob = new Blob([bytes], { type })
    result.audio_url = URL.createObjectURL(result.audio_blob)
  }

  return result
}
