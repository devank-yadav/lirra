from typing import Tuple


EMOJI_MAP = {
  'happy': '😊',
  'sad': '😢',
  'angry': '😠',
  'excited': '🤩',
  'calm': '😌',
  'nervous': '😬',
  'confident': '😎',
  'surprised': '😮',
  'empathetic': '🤗',
  'sarcastic': '😏',
  'grateful': '🙏',
  'curious': '🤔',
  'frustrated': '😤',
  'proud': '🥰',
  'neutral': '😐',
}

KEYWORDS = {
  'happy': {'happy', 'glad', 'joy', 'fun', 'love', 'great', 'awesome'},
  'sad': {'sad', 'down', 'cry', 'upset', 'lonely'},
  'angry': {'angry', 'mad', 'furious', 'annoyed', 'irritated'},
  'excited': {'excited', 'thrilled', 'eager', 'can\'t wait'},
  'calm': {'calm', 'relaxed', 'peaceful', 'chill'},
  'nervous': {'nervous', 'anxious', 'worried', 'scared'},
  'confident': {'confident', 'capable', 'strong'},
  'surprised': {'surprised', 'shocked', 'astonished'},
  'empathetic': {'feel for', 'sorry for', 'understand you'},
  'grateful': {'grateful', 'thankful', 'appreciate'},
  'curious': {'curious', 'wonder', 'interested'},
  'frustrated': {'frustrated', 'stuck', 'annoying'},
  'proud': {'proud', 'accomplished', 'achieved'},
}


def classify_emotion(text: str) -> Tuple[str, float, str]:
  if not text:
    return 'neutral', 0.0, EMOJI_MAP['neutral']

  lowered = text.lower()
  scores = {emotion: 0 for emotion in KEYWORDS}

  for emotion, words in KEYWORDS.items():
    for word in words:
      if word in lowered:
        scores[emotion] += 1

  best_emotion = max(scores, key=scores.get)
  score = scores[best_emotion]

  if score == 0:
    return 'neutral', 0.0, EMOJI_MAP['neutral']

  total_hits = sum(scores.values()) or 1
  confidence = min(1.0, score / total_hits)
  emoji = EMOJI_MAP.get(best_emotion, EMOJI_MAP['neutral'])
  return best_emotion, confidence, emoji
