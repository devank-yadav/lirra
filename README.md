<h1 align="center">Lirra</h1>
<p align="center"><strong>The empathetic storytelling buddy for kids.</strong><br>
Senses a child's emotions and preferences, then tells them a personalised, therapeutic story — in a parent's voice.</p>

<p align="center"><em>Built at Cal Hacks 12.0.</em></p>

## Why

Children carry stress, anxiety, and the strain of medical treatment without much language for any of
it. Story apps exist, but most are shallow: the same handful of tales, no sense of who is listening
or how their day went.

Lirra listens first. It hears how a child speaks — not only the words — infers what they are feeling,
and writes a story around it. Then it reads that story aloud in a voice the child already trusts.

## How it works

```
speech → transcription → emotion (text + voice) → child profile → story → narration → comic playback
```

1. **Listen.** The browser records with `MediaRecorder`, detecting a supported codec at runtime. The
   clip uploads to Supabase storage and gets a signed URL.
2. **Transcribe.** The backend converts to WAV and transcribes with Whisper.
3. **Read the emotion — twice.** Once from *what* was said, once from *how*:
   - `classify_emotion` scores the transcript across 15 labels — happy, sad, nervous, frustrated,
     proud, curious, grateful and more — returning a confidence and an emoji.
   - `predict_voice_emotion` measures RMS loudness in dB and maps it to `calm` / `neutral` /
     `excited`, independent of the words entirely.
4. **Know the child.** Onboarding captures name, age, language, interests, the health condition or
   focus, and the caregiver's goal — *"reduce fear of injections"*, *"better sleep"*. All of it
   conditions the prompt.
5. **Write.** `get_storyteller_prompt` assembles both emotion signals, the confidence, and the child
   profile into a system and user prompt. `LLMClient` sends it to Anthropic
   (`claude-3-5-sonnet-latest`) or OpenAI (`gpt-4o-mini`), selectable per request.
6. **Narrate.** Fish Audio synthesises the reading, falling back to the Labs provider if it fails.
7. **Show.** The immersive player runs a six-panel comic grid (`A`–`F`) driven by timestamped cues —
   each cue names the panels that change at a given second, so artwork reveals in step with the
   narration.

The interface is deliberately small. A child sees a story and a play button; the caregiver sees
everything else.

## Stack

**Frontend** — React 19 · Vite · React Router · Chart.js
**Backend** — FastAPI · Whisper · pydub
**Story** — Anthropic Claude or OpenAI, per request
**Voice** — Fish Audio TTS, Labs TTS fallback
**Data** — Supabase: passwordless auth, Postgres, audio storage

## Run it

Two processes — the Vite frontend and the FastAPI backend.

```bash
cp .env.example .env     # fill this in first
```

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn merged_app:app --reload --port 8000
```

```bash
npm install
npm run dev
```

Auth, onboarding, recording, and the player all work without the backend running. Story generation
is the only path that needs it, and the UI disables that when `VITE_STORY_API_URL` is unset.

### Environment

Everything is in [`.env.example`](.env.example). The split matters:

| | Variable | |
|---|---|---|
| **Frontend** | `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` | The **anon** key — it ships to the browser by design. Row-level security is what protects the data. |
| | `VITE_STORY_API_URL` | Where the backend runs |
| **Backend** | `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` | **Server-side only.** Bypasses row-level security entirely. |
| | `STORY_PROVIDER` | `openai` or `anthropic` |
| | `OPENAI_API_KEY` | Also used for Whisper |
| | `ANTHROPIC_API_KEY` | Only when `STORY_PROVIDER=anthropic` |
| | `CORS_ALLOW_ORIGINS` | Your frontend origin |

### Supabase

Tables `profiles`, `children`, `audio`, and `stories` — the last defined in
[`supabase/stories.sql`](supabase/stories.sql) with its row-level security policies. Run that file
in the SQL editor. Storage needs a private `audio` bucket; the app reads through signed URLs.

Enable RLS on every table and scope each policy to `auth.uid()`. The backend verifies the caller's
bearer token against Supabase before it generates anything — these are children's records.

## API

**`POST /story`** — multipart form.

| Field | | |
|---|---|---|
| `audio` | file | required |
| `child_name`, `child_age`, `child_language`, `child_id` | form | optional |
| `provider` | form | overrides `STORY_PROVIDER` for this request |
| `Authorization` | header | `Bearer <supabase access token>`, required |

Returns the transcript, both emotion readings with confidence, the story, and a signed URL for the
narration audio.

## Routes

| Route | Access | |
|---|---|---|
| `/` | public | Landing |
| `/auth` | public | Magic-link / OTP sign-in |
| `/immersive` | public | Full-screen comic player |
| `/onboarding` | private | Child profile |
| `/dashboard` · `/new` · `/library` · `/progress` · `/settings` | private | Home, record, saved stories, mood over time, account |

## Adding a storyboard

Panel images go under `public/comics/<slug>/scene-<n>-<Panel>.jpg`, then add cues to
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

`at` is seconds into the audio. Only the panels a cue names change; the rest hold.

## Status

This repository holds the app and the story pipeline. Some pieces of the Cal Hacks demo are not in
it: the trained emotion models (a BiLSTM for text, a CNN-Transformer for voice), generated comic art,
and parent voice cloning. The emotion reads here are a keyword classifier and a loudness heuristic,
storyboards are static, and narration uses Fish Audio without cloning.

Still on sample data: `Library` falls back to `src/data/sampleStories.js` when nothing is saved, and
`Progress` charts a hardcoded mood dataset rather than real sessions.

## Roadmap

Multilingual and culturally adaptive storytelling · mindfulness, journaling, and breathing
exercises · on-device models for privacy and offline use · clinical validation with psychologists
and hospitals · mobile apps, and AR/VR.

[Devpost](https://devpost.com/software/lirra)

## License

MIT — see [LICENSE](LICENSE).
