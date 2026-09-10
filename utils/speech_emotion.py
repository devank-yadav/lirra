import math
from typing import Literal

from pydub import AudioSegment

Emotion = Literal['calm', 'neutral', 'excited']


def predict_voice_emotion(audio_path: str) -> Emotion:
  try:
    segment = AudioSegment.from_file(audio_path)
  except Exception:
    return 'neutral'

  rms = segment.rms or 1
  loudness = 20 * math.log10(rms)

  if loudness > -15:
    return 'excited'
  if loudness < -35:
    return 'calm'
  return 'neutral'
