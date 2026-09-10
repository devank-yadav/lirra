from pathlib import Path
from typing import Optional


def text_to_speech_labs(text: str, output_path: Optional[str] = None) -> Optional[str]:
  """
  Placeholder ElevenLabs integration.

  Returns ``None`` to signal that the alternative provider is not configured.
  """
  _ = text  # keep signature consistent
  if output_path:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
  return None
