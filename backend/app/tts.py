"""Text-to-speech with Piper (fast and light on a small CPU)."""
import io
import re
import threading
import urllib.request
import wave

from .config import DATA_DIR, PIPER_VOICES

VOICE_DIR = DATA_DIR / "voices"
VOICE_DIR.mkdir(parents=True, exist_ok=True)
HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main"

_voices = {}
_lock = threading.Lock()


def _voice_url(name):
    # en_US-lessac-medium -> en/en_US/lessac/medium/en_US-lessac-medium.onnx
    lang, speaker, quality = name.split("-", 2)
    return f"{HF}/{lang.split('_')[0]}/{lang}/{speaker}/{quality}/{name}.onnx"


def _ensure_voice(name):
    onnx = VOICE_DIR / f"{name}.onnx"
    cfg = VOICE_DIR / f"{name}.onnx.json"
    if not onnx.exists() or not cfg.exists():
        url = _voice_url(name)
        urllib.request.urlretrieve(url + ".json", cfg)
        urllib.request.urlretrieve(url, str(onnx) + ".part")
        (VOICE_DIR / f"{name}.onnx.part").rename(onnx)
    return onnx


def get_voice(accent="us"):
    from piper import PiperVoice

    name = PIPER_VOICES.get(accent, PIPER_VOICES["us"])
    with _lock:
        if name not in _voices:
            _voices[name] = PiperVoice.load(_ensure_voice(name))
        return _voices[name]


def clean_for_speech(text):
    text = re.sub(r"\[(?:XP\+\d+|MISS)\]", "", text)
    text = re.sub(r"[*_#`>~]+", "", text)
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def synthesize(text, accent="us", speed=1.0):
    from piper import SynthesisConfig

    voice = get_voice(accent)
    speed = min(max(float(speed), 0.5), 2.0)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        voice.synthesize_wav(clean_for_speech(text), wav, syn_config=SynthesisConfig(length_scale=1.0 / speed))
    return buf.getvalue()


def phonemes(text, accent="us"):
    """IPA phonemes for each word, using Piper's built-in espeak-ng."""
    voice = get_voice(accent)
    out = []
    for sentence in voice.phonemize(text):
        word = []
        for p in sentence:
            if p == " ":
                if word:
                    out.append("".join(word))
                    word = []
            elif p not in {"ˈ", "ˌ", ".", ",", "?", "!", ";", ":"}:
                word.append(p)
        if word:
            out.append("".join(word))
    return out
