import os
from pathlib import Path
from typing import Optional

from openai import OpenAI


class TranscriptionError(RuntimeError):
  """Raised when speech transcription fails."""


def _get_openai_client() -> OpenAI:
  api_key = os.getenv('OPENAI_API_KEY')
  if not api_key:
    raise TranscriptionError('OPENAI_API_KEY is not set')
  return OpenAI(api_key=api_key)


def record_and_transcribe(audio_path: Optional[str] = None) -> str:
  """
  Transcribe the supplied audio file using OpenAI Whisper.

  The legacy CLI workflow recorded audio to `recorded_audio.wav`. For the web
  integration the path is supplied by the caller; if omitted we fall back to
  that default location.
  """
  path = Path(audio_path or 'recorded_audio.wav').expanduser().resolve()
  if not path.exists():
    raise TranscriptionError(f'Audio file not found: {path}')

  client = _get_openai_client()
  model = os.getenv('OPENAI_TRANSCRIPTION_MODEL', 'whisper-1')

  try:
    with path.open('rb') as audio_file:
      result = client.audio.transcriptions.create(
        model=model,
        file=audio_file,
        response_format='text',
      )
  except Exception as exc:
    raise TranscriptionError(f'Failed to transcribe audio: {exc}') from exc

  transcript = result if isinstance(result, str) else getattr(result, 'text', '')
  transcript = (transcript or '').strip()
  if not transcript:
    raise TranscriptionError('Transcription returned empty text')

  return transcript
