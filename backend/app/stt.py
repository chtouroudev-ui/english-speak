"""Speech-to-text with faster-whisper on the CPU."""
import re
import threading

from .config import DATA_DIR, WHISPER_COMPUTE, WHISPER_THREADS

_models = {}
_lock = threading.Lock()

FILLERS = {"uh", "um", "umm", "uhm", "er", "erm", "hmm", "ah", "eh", "mm"}
# A short prompt full of fillers makes Whisper keep "uh/um" instead of hiding them.
FILLER_PROMPT = "Umm, let me think, uh, like, hmm."
# Whisper often "hears" these in silence or noise at the end of a clip.
GHOSTS = {"thank you", "thanks", "thank you very much", "thanks for watching", "thank you for watching",
          "you", "bye", "subtitles by the amara org community"}


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


def transcribe(path, model_name="small.en", context=""):
    # Learners speak English here, so the English-only models are more accurate.
    name = {"tiny": "base.en", "tiny.en": "base.en", "base": "base.en", "small": "small.en"}.get(model_name, model_name)
    if name not in {"base.en", "small.en"}:
        name = "small.en"
    segments, info = _model(name).transcribe(
        str(path),
        language="en",
        beam_size=3,
        word_timestamps=True,
        vad_filter=True,
        # Softer voices still count as speech.
        vad_parameters={"threshold": 0.35, "speech_pad_ms": 500},
        # The question the learner answers is a strong hint for the words in the answer.
        initial_prompt=(context.strip() + " " + FILLER_PROMPT).strip() if context else FILLER_PROMPT,
        condition_on_previous_text=False,
        hallucination_silence_threshold=1.0,
        no_speech_threshold=0.5,
    )
    words = []
    text_parts = []
    for seg in segments:
        if _ghost(seg):
            continue
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


def _ghost(seg):
    """A made-up segment: a typical ghost phrase that Whisper is not sure about."""
    text = " ".join(_clean(w) for w in seg.text.split() if _clean(w))
    if not text:
        return True
    probs = [w.probability for w in seg.words or []]
    unsure = (sum(probs) / len(probs) < 0.6) if probs else True
    if text in GHOSTS and (unsure or seg.no_speech_prob > 0.3 or seg.avg_logprob < -0.6):
        return True
    return seg.no_speech_prob > 0.7 and seg.avg_logprob < -0.8


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
