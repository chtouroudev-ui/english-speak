"""Speech-to-text with faster-whisper on the CPU."""
import re
import threading

from .config import DATA_DIR, WHISPER_COMPUTE, WHISPER_THREADS

_models = {}
_lock = threading.Lock()

FILLERS = {"uh", "um", "umm", "uhm", "er", "erm", "hmm", "ah", "eh", "mm"}
# A short prompt full of fillers makes Whisper keep "uh/um" instead of hiding them.
FILLER_PROMPT = "Umm, let me think, uh, like, hmm. Okay, so I went to the, uh, store."


def _model(name):
    from faster_whisper import WhisperModel

    with _lock:
        if name not in _models:
            _models.clear()  # keep only one Whisper model in RAM on a small server
            _models[name] = WhisperModel(
                name,
                device="cpu",
                compute_type=WHISPER_COMPUTE,
                cpu_threads=WHISPER_THREADS,
                download_root=str(DATA_DIR / "whisper"),
            )
        return _models[name]


def transcribe(path, model_name="base"):
    name = model_name if model_name in {"tiny", "base", "small", "tiny.en", "base.en", "small.en"} else "base"
    segments, info = _model(name).transcribe(
        str(path),
        language="en",
        beam_size=1,
        word_timestamps=True,
        vad_filter=True,
        initial_prompt=FILLER_PROMPT,
        condition_on_previous_text=False,
    )
    words = []
    text_parts = []
    for seg in segments:
        text_parts.append(seg.text)
        for w in seg.words or []:
            words.append(
                {
                    "word": w.word.strip(),
                    "start": round(w.start, 2),
                    "end": round(w.end, 2),
                    "prob": round(w.probability, 3),
                }
            )
    text = " ".join(t.strip() for t in text_parts).strip()
    return {"text": text, "words": words, "duration": round(info.duration, 2), **speech_stats(words)}


def speech_stats(words):
    """Words per minute, long pauses and filler words (proposal 20)."""
    if not words:
        return {"wpm": 0, "pauses": [], "fillers": 0, "word_count": 0, "avg_confidence": None}
    real = [w for w in words if _clean(w["word"]) not in FILLERS and _clean(w["word"])]
    speak_time = max(words[-1]["end"] - words[0]["start"], 0.5)
    pauses = []
    for a, b in zip(words, words[1:]):
        gap = b["start"] - a["end"]
        if gap >= 1.0:
            pauses.append({"after": a["word"], "seconds": round(gap, 1)})
    fillers = sum(1 for w in words if _clean(w["word"]) in FILLERS)
    avg = sum(w["prob"] for w in real) / len(real) if real else None
    return {
        "wpm": round(len(real) / (speak_time / 60)),
        "pauses": pauses,
        "fillers": fillers,
        "word_count": len(real),
        "avg_confidence": round(avg, 3) if avg is not None else None,
    }


def _clean(word):
    return re.sub(r"[^a-z']", "", word.lower())
