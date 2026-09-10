// src/pages/NewStory.jsx
import React, { useEffect, useRef, useState } from 'react'
import { getCachedChildProfile, fetchChildProfile } from '../lib/childrenApi'
import { submitRecording } from '../lib/storyApi'
import { useAudioPlayer } from '../player/AudioPlayerProvider'

export default function NewStory() {
  const { addToQueue, setQueue, play } = useAudioPlayer()
  const [child, setChild] = useState(() => getCachedChildProfile() || {})

  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState('')
  const [supportedType, setSupportedType] = useState('')
  const [processing, setProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [story, setStory] = useState('')
  const [storyAudio, setStoryAudio] = useState('')

  const recRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const tickRef = useRef(null)

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const profile = await fetchChildProfile()
        if (isMounted && profile) setChild(profile)
      } catch (e) {
        console.warn('Unable to load child profile', e)
      }
    })()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (window.MediaRecorder) {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        setSupportedType('audio/webm;codecs=opus')
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        setSupportedType('audio/mp4')
      } else {
        setSupportedType('')
      }
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  const start = async () => {
    if (processing) return
    if (!supportedType) { setStatus('Recording not supported in this browser'); return }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream
    chunksRef.current = []
    const mr = new MediaRecorder(stream, { mimeType: supportedType })
    recRef.current = mr
    mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = handleStop
    mr.start()
    setIsRecording(true)
    setElapsed(0)
    tickRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000)
  }

  const stop = () => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
    setIsRecording(false)
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }

  const handleStop = async () => {
    const blob = new Blob(chunksRef.current, { type: supportedType || 'audio/webm' })
    setProcessing(true)
    setStatus('Processing…')
    setTranscript('')
    setStory('')
    setStoryAudio('')

    try {
      const result = await submitRecording({
        blob,
        mimeType: blob.type,
        child
      })

      setStatus('Story ready')
      setTranscript(result.transcript || '')
      setStory(result.story || '')
      const audioUrl = result.audio_url || result.audioUrl
      if (audioUrl) {
        setStoryAudio(audioUrl)
        const trackId = result.recording_id || `story-${Date.now()}`
        const track = {
          id: trackId,
          title: result.story_title || `${child.name || 'Child'} Story`,
          src: audioUrl,
          cover: result.cover_url || null
        }
        if (typeof addToQueue === 'function') addToQueue(track)
        else if (typeof setQueue === 'function') setQueue([track])
        if (typeof play === 'function') play(track.id)
      }
    } catch (err) {
      console.error(err)
      setStatus(err.message || 'Unable to process recording')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
      <div className="container" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '70vh', 
        textAlign: 'center',
        padding: '0 20px' // To avoid any padding issues for small screens
      }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 className="h2">Record a Story</h1>

          <p className="help" style={{ marginTop: '20px', fontSize: '18px' }}>
            {isRecording ? `Recording… ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}` : 'Tap the button to start'}
          </p>

          <div style={{ marginTop: '16px', minHeight: 24 }}>
            {status && <span className="help">{status}</span>}
          </div>
        </div>

        {/* Floating circular action button with microphone icon */}
        <button
          className="play-btn"
          onClick={isRecording ? stop : start}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          style={{
            width: '220px', // Increased size
            height: '220px', // Increased size
            borderRadius: '50%',
            background: 'var(--primary)',
            border: 'none',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(88, 204, 2, 0.3)',
            transition: 'all 0.2s ease',
            fontSize: '30px', // Increased font size for the icon
            fontWeight: 'bold'
          }}
          disabled={processing}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(88, 204, 2, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(88, 204, 2, 0.3)'
          }}
        >
          {/* Microphone Icon */}
          <i className="fas fa-microphone" style={{ fontSize: '50px' }}></i> {/* Increased icon size */}
        </button>

        {(transcript || story) && (
          <div className="card" style={{ marginTop: 32, maxWidth: 640, width: '100%', textAlign: 'left', padding: 24 }}>
            {transcript && (
              <div style={{ marginBottom: 16 }}>
                <h3 className="h2" style={{ fontSize: 20 }}>Transcript</h3>
                <p className="p" style={{ whiteSpace: 'pre-wrap' }}>{transcript}</p>
              </div>
            )}
            {story && (
              <div>
                <h3 className="h2" style={{ fontSize: 20 }}>Story</h3>
                <p className="p" style={{ whiteSpace: 'pre-wrap' }}>{story}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
