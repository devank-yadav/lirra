import base64
import os
import uuid
import tempfile
from datetime import datetime
from typing import Optional

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydub import AudioSegment
from supabase import Client, create_client

from utils.llm_agent import LLMClient
from utils.speech_input_utils import record_and_transcribe
from utils.fish_audio_tts import fish_text_to_speech
from utils.labs_tts import text_to_speech_labs
from utils.infer_emotion import classify_emotion
from utils.speech_emotion import predict_voice_emotion

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()  # loads .env

def load_supabase() -> Client:
    url = os.environ.get('SUPABASE_URL') or os.environ.get('VITE_SUPABASE_URL')
    key = (
        os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
        or os.environ.get('SUPABASE_ANON_KEY')
        or os.environ.get('VITE_SUPABASE_ANON_KEY')
    )
    if not url or not key:
        raise RuntimeError('Supabase credentials are not configured')
    return create_client(url, key)


supabase = load_supabase()

app = FastAPI()

allowed_origins = os.environ.get('CORS_ALLOW_ORIGINS', '*')
allow_origins = [o.strip() for o in allowed_origins.split(',')] if allowed_origins else ['*']

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


def get_storyteller_prompt(text, emotion, v_emotion, confidence, emoji, name, age):
    common_instructions = (
        "You are a creative storyteller AI. Speak in an engaging narrative style. "
        "Your goal is to identify information about the user, their characteristics, "
        "and emotional state to craft an interesting, personalized, and immersive story. "
        "You should ask the user for their name and age if you do not already know them."
    )

    instructions = (
        f"{common_instructions} Use the user's information to tailor the story. "
        "Create the entire story, weaving in elements of their information, and "
        "make it interactive, occasionally prompting the user. Prepend the current time "
        "to every sentence. Do not end on a statement where no response is expected; "
        "instead, invite the user to continue. After finishing, ask whether they would "
        "like to continue or end. "
        f"The user's name is {name or 'Unknown'}, age {age or 'Unknown'}, and their "
        f"text emotion is {emotion} ({emoji}) with confidence {confidence:.4f}. "
        f"Their voice emotion appears to be {v_emotion}. "
        "Prefix each sentence with the dominant emotion in parentheses. "
        "Use the following emotions when appropriate: "
        "(happy), (sad), (angry), (excited), (calm), (nervous), (confident), "
        "(surprised), (empathetic), (sarcastic), (grateful), (curious), "
        "(frustrated), (proud)."
    )

    user_context = (
        f'User input: "{text}"\n'
        f"Detected emotion: {emotion} {emoji}\n"
        f"Emotion confidence: {confidence:.4f}\n"
        f"User name: {name or 'Not provided'}\n"
        f"User age: {age or 'Not provided'}\n"
    )

    return instructions, user_context


async def save_uploaded_audio(upload: UploadFile) -> str:
    suffix = ''
    if upload.filename and '.' in upload.filename:
        suffix = '.' + upload.filename.rsplit('.', 1)[1]
    elif upload.content_type:
        if 'webm' in upload.content_type:
            suffix = '.webm'
        elif 'mpeg' in upload.content_type:
            suffix = '.mp3'
        elif 'wav' in upload.content_type:
            suffix = '.wav'
        elif 'ogg' in upload.content_type:
            suffix = '.ogg'

    data = await upload.read()
    if not data:
        raise HTTPException(status_code=400, detail='Empty audio upload')

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        return tmp.name


def ensure_wav(path: str) -> str:
    if path.endswith('.wav'):
        return path
    audio = AudioSegment.from_file(path)
    wav_path = f"{path}.wav"
    audio.export(wav_path, format='wav')
    return wav_path


def upload_to_storage(bucket: str, path: str, file_path: str, content_type: str):
    with open(file_path, 'rb') as fh:
        data = fh.read()
    response = supabase.storage.from_(bucket).upload(path, data, {
        'content-type': content_type,
        'cache-control': '3600',
        'upsert': True
    })
    if getattr(response, 'error', None):
        raise RuntimeError(response.error)


def get_signed_url(bucket: str, path: str, expires_in: int = 60 * 60 * 24 * 7):
    response = supabase.storage.from_(bucket).create_signed_url(path, expires_in)
    if getattr(response, 'error', None):
        raise RuntimeError(response.error)
    return response.get('signedURL') or response.get('signed_url')


def verify_user(access_token: Optional[str]):
    if not access_token:
        raise HTTPException(status_code=401, detail='Missing access token')
    try:
        result = supabase.auth.get_user(access_token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail='Invalid access token') from exc
    user = getattr(result, 'user', None) or result.get('user') if isinstance(result, dict) else None
    if not user:
        raise HTTPException(status_code=401, detail='Unauthorized')
    return user


@app.post('/story')
async def generate_story(
    audio: UploadFile = File(...),
    child_name: Optional[str] = Form(None),
    child_age: Optional[str] = Form(None),
    child_language: Optional[str] = Form(None),
    child_id: Optional[str] = Form(None),
    provider: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None),
):
    access_token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == 'bearer':
            access_token = parts[1]
    user = verify_user(access_token)
    user_id = user['id'] if isinstance(user, dict) else user.id

    uploaded_path = await save_uploaded_audio(audio)
    wav_path = ensure_wav(uploaded_path)

    # Ensure downstream utils have access to a standard path
    standard_path = os.path.join(tempfile.gettempdir(), 'recorded_audio.wav')
    AudioSegment.from_file(wav_path).export(standard_path, format='wav')

    try:
        transcribed_text = record_and_transcribe(standard_path)
    except TypeError:
        transcribed_text = record_and_transcribe()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Transcription failed: {exc}') from exc

    if not transcribed_text:
        raise HTTPException(status_code=400, detail='Could not transcribe audio')

    try:
        emotion, confidence, emoji = classify_emotion(transcribed_text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Emotion classification failed: {exc}') from exc

    try:
        v_emotion = predict_voice_emotion(standard_path)
    except Exception as exc:
        v_emotion = 'unknown'
        confidence = float(confidence) if confidence else 0.0
        emoji = emoji or ''
        print(f"Voice emotion classification failed: {exc}")

    story_provider = provider or os.environ.get('STORY_PROVIDER', 'openai')
    llm_client = LLMClient(provider=story_provider)

    system_prompt, user_prompt = get_storyteller_prompt(
        transcribed_text,
        emotion,
        v_emotion,
        confidence,
        emoji,
        child_name,
        child_age,
    )

    try:
        story_response = llm_client.generate_response(system_prompt, user_prompt)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'LLM generation failed: {exc}') from exc

    if not story_response:
        raise HTTPException(status_code=500, detail='LLM returned an empty story')

    output_mp3_path = os.path.join(tempfile.gettempdir(), f'{uuid.uuid4()}.mp3')
    try:
        fish_text_to_speech(story_response, output_mp3_path)
    except Exception:
        alt_path = text_to_speech_labs(story_response)
        if alt_path:
            output_mp3_path = alt_path

    with open(output_mp3_path, 'rb') as fh:
        audio_bytes = fh.read()
    audio_b64 = base64.b64encode(audio_bytes).decode('ascii')

    response_payload = {
        'transcript': transcribed_text,
        'story': story_response,
        'audio_base64': audio_b64,
        'mime_type': 'audio/mpeg',
        'emotion': emotion,
        'voice_emotion': v_emotion,
        'confidence': confidence,
        'emoji': emoji,
        'story_title': f"{child_name or 'Child'}'s Story",
    }

    return JSONResponse(response_payload)
