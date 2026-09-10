import os
from pathlib import Path

from openai import OpenAI


class TextToSpeechError(RuntimeError):
  """Raised when generating audio from text fails."""


def fish_text_to_speech(text: str, output_path: str) -> str:
  """
  Generate speech audio from text using OpenAI's TTS endpoint.

  Persists the audio to ``output_path`` and returns the absolute path.
  """
  if not text:
    raise TextToSpeechError('Cannot synthesise empty text')

  api_key = os.getenv('OPENAI_API_KEY')
  if not api_key:
    raise TextToSpeechError('OPENAI_API_KEY is not set')

  client = OpenAI(api_key=api_key)
  model = os.getenv('OPENAI_TTS_MODEL', 'gpt-4o-mini-tts')
  voice = os.getenv('OPENAI_TTS_VOICE', 'alloy')

  target = Path(output_path).expanduser().resolve()
  target.parent.mkdir(parents=True, exist_ok=True)

  try:
    with client.audio.speech.with_streaming_response.create(
      model=model,
      voice=voice,
      input=text,
      format=os.getenv('OPENAI_TTS_FORMAT', 'mp3'),
    ) as response:
      response.stream_to_file(target)
  except Exception as exc:
    raise TextToSpeechError(f'Failed to synthesise speech: {exc}') from exc

  return str(target)
