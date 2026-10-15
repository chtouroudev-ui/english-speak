import os
from pathlib import Path

DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR = Path(os.getenv("STATIC_DIR", Path(__file__).resolve().parent.parent / "static"))

# Defaults used until the user changes them on the Settings page.
DEFAULT_SETTINGS = {
    "llm_base_url": os.getenv("LLM_BASE_URL", "http://localhost:11434/v1"),
    "llm_api": os.getenv("LLM_API", "openai"),  # "openai" or "ollama"
    "llm_api_key": os.getenv("LLM_API_KEY", ""),
    "llm_model": os.getenv("LLM_MODEL", "qwen2.5:3b"),
    "vision_model": os.getenv("VISION_MODEL", ""),  # empty = same as llm_model
    "vision_enabled": os.getenv("VISION_ENABLED", "false").lower() == "true",
    "level": "B1",
    "correction_style": "big",  # all | big | off
    "accent": "us",  # us | uk
    "voice_speed": 1.0,
    "tts_engine": "piper",  # piper | browser
    "stt_engine": "server",  # server | browser-whisper | browser-native
    "whisper_model": os.getenv("WHISPER_MODEL", "base"),
    "native_language": "",
    "job": "",
    "daily_goal_minutes": 10,
    "reminder_time": "19:00",
    "talk_mode": "call",  # call (hands-free) | push
    "theme": "system",
}

WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE", "int8")
WHISPER_THREADS = int(os.getenv("WHISPER_THREADS", "2"))
PIPER_VOICES = {
    "us": os.getenv("PIPER_VOICE_US", "en_US-lessac-medium"),
    "uk": os.getenv("PIPER_VOICE_UK", "en_GB-alan-medium"),
}
