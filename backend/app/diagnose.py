"""Checks each part of the app and how fast it is on this server.
Run on the server:  sudo docker compose exec app python -m app.diagnose
"""
import asyncio
import tempfile
import time
import traceback

from . import db, llm, stt, tts


def step(name, fn):
    t = time.time()
    try:
        out = fn()
        print(f"OK    {name}  ({time.time() - t:.1f}s)  {out if out is not None else ''}", flush=True)
        return out
    except Exception as e:  # noqa: BLE001
        print(f"FAIL  {name}  ({time.time() - t:.1f}s)  {type(e).__name__}: {e}", flush=True)
        traceback.print_exc(limit=2)
        return None


async def model_speed(s):
    t = time.time()
    first = None
    n = 0
    async for _ in llm.stream_chat(
        s, [{"role": "user", "content": "Say one short friendly sentence about the weather."}], max_tokens=40
    ):
        if first is None:
            first = time.time() - t
        n += 1
    total = time.time() - t
    return f"first word after {first:.1f}s, about {n / max(total - (first or 0), 0.01):.1f} pieces/s"


def main():
    s = db.get_settings()
    print(f"Model server: {s['llm_base_url']}  ({s['llm_api']})  chat model: {s['llm_model']}  whisper: {s['whisper_model']}\n")
    step("Model list", lambda: asyncio.run(llm.list_models(s)))
    step("Model answer (1st run includes loading the model)", lambda: asyncio.run(model_speed(s)))
    step("Model answer (2nd run)", lambda: asyncio.run(model_speed(s)))
    step("Piper voice load", lambda: tts.get_voice(s["accent"]) and "loaded")
    wav = step("Piper speak", lambda: tts.synthesize("Hello, I went to the market yesterday.", s["accent"], 1.0))
    step("Whisper load", lambda: stt._model(s["whisper_model"]) and "loaded")
    if wav:
        f = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        f.write(wav)
        f.close()
        step("Whisper listen", lambda: stt.transcribe(f.name, s["whisper_model"])["text"])


if __name__ == "__main__":
    main()
