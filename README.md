# StoryCure

Turns a child's spoken words into a narrated, illustrated therapeutic story.

A child records how their day went. The app transcribes it, reads the emotion behind
it — from both the words and the sound of the voice — and generates a short story that
answers that emotion, narrated aloud and displayed as a comic that reveals panel by
panel in time with the audio.

Built for children living with illness, disability, or anxiety, where the right story
at the right moment does more than a screen full of features. The child sees a story
and a play button. The caregiver sees everything else.

## How it works

```
recording → transcription → emotion (text + voice) → story → narration → comic playback
```

1. **Record.** The browser captures audio with `MediaRecorder`, detecting a supported
   codec at runtime. The clip uploads to Supabase storage and gets a signed URL.
2. **Transcribe.** The backend converts to WAV and transcribes with OpenAI Whisper.
3. **Read the emotion.** Two independent signals:
   - *Text* — `classify_emotion` scores the transcript across 15 labels (happy, sad,
     nervous, frustrated, proud, curious, grateful, and more), returning a confidence
     and an emoji.
   - *Voice* — `predict_voice_emotion` measures RMS loudness in dB and maps it to
     `calm` / `neutral` / `excited`, independent of what was actually said.
4. **Generate.** `get_storyteller_prompt` builds a system and user prompt from the
   transcript, both emotion signals, the confidence, and the child's name, age, and
   language. `LLMClient` sends it to OpenAI (`gpt-4o-mini`) or Anthropic
   (`claude-3-5-sonnet-latest`), selectable per request.
5. **Narrate.** Fish Audio synthesises the narration, falling back to the Labs
   provider if it fails.
6. **Play.** The immersive player runs a six-panel comic grid (`A`–`F`) driven by
   timestamped cues — each cue names the panels that change at a given second, so
   artwork reveals in step with the narration.

## Stack

**Frontend** — React 19, Vite, React Router, Chart.js, FontAwesome
**Backend** — FastAPI, Supabase (auth, Postgres, storage), OpenAI, Anthropic, pydub
**Auth** — Supabase passwordless magic link / OTP, enforced on both ends

## Run it

Two processes: the Vite frontend and the FastAPI backend.

```bash
cp .env.example .env     # fill in your values first
```

**Backend**

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn merged_app:app --reload --port 8000
```

**Frontend**

```bash
npm install
npm run dev
```

The app runs without the backend — auth, onboarding, recording, and the player all
work. Story generation is the only thing that needs it, and the UI disables that
path when `VITE_STORY_API_URL` is unset.

### Environment

Everything is documented in [`.env.example`](.env.example). The split matters:

| | Variable | Notes |
|---|---|---|
| **Frontend** | `VITE_SUPABASE_URL` | |
| | `VITE_SUPABASE_ANON_KEY` | The **anon** key. It ships to the browser — that is expected. Protect data with row-level security, never by hiding this. |
| | `VITE_STORY_API_URL` | Where the backend is running |
| **Backend** | `SUPABASE_URL` | |
| | `SUPABASE_SERVICE_ROLE_KEY` | **Server-side only.** Bypasses row-level security entirely. Never expose it to the client. |
| | `STORY_PROVIDER` | `openai` or `anthropic` |
| | `OPENAI_API_KEY` | Also used for Whisper transcription |
| | `ANTHROPIC_API_KEY` | Only when `STORY_PROVIDER=anthropic` |
| | `CORS_ALLOW_ORIGINS` | Your frontend origin |

### Supabase setup

Tables: `profiles`, `children`, `audio`, and `stories` — the last one is defined in
[`supabase/stories.sql`](supabase/stories.sql), including its row-level security
policies. Run that file in the SQL editor.

Storage: a bucket named `audio`. It can stay private; the app reads through signed
URLs.

Enable RLS on every table and scope each policy to `auth.uid()`. The backend verifies
the caller's bearer token against Supabase before it will generate anything.

## API

**`POST /story`** — multipart form.

| Field | | |
|---|---|---|
| `audio` | file | required |
| `child_name`, `child_age`, `child_language`, `child_id` | form | optional |
| `provider` | form | overrides `STORY_PROVIDER` for this request |
| `Authorization` | header | `Bearer <supabase access token>`, required |

Returns the transcript, both emotion readings with confidence, the generated story,
and a signed URL for the narration audio.

## Routes

| Route | Access | |
|---|---|---|
| `/` | public | Landing |
| `/auth` | public | Magic-link / OTP sign-in |
| `/immersive` | public | Full-screen comic player |
| `/onboarding` | private | Child profile — name, age, language, interests, focus, goal |
| `/dashboard` | private | Home |
| `/new` | private | Record a story |
| `/library` | private | Saved stories |
| `/progress` | private | Mood over time |
| `/settings` | private | Account |

## Adding a storyboard

Put panel images under `public/comics/<slug>/scene-<n>-<Panel>.jpg`, then add cues to
`src/storyboards/localStoryboards.js`:

```js
export const MY_STORYBOARD = {
  id: 'my-story',
  titleMatch: /alex|hospital/i,   // auto-selects when a track title matches
  cues: [
    { at: 0,  panels: { A: '/comics/my-story/scene-1-A.jpg', B: '...' } },
    { at: 12, panels: { C: '/comics/my-story/scene-2-C.jpg' } },
    { at: 18, panels: { B: null } },   // null clears that panel
  ],
}
```

`at` is seconds into the audio. Only the panels named in a cue change; the rest hold.

## Status

The generation pipeline is end-to-end working. Two things still run on sample data:

- **Library** falls back to `src/data/sampleStories.js` when nothing is saved.
- **Progress** charts a hardcoded mood dataset rather than real sessions.

Storyboards are static and currently all resolve to the one sample storyboard —
generated stories are narrated, but not yet illustrated automatically.

## License

<!-- TODO: no LICENSE file yet. MIT would match glanceos. -->
