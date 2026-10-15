import datetime
import json
import random
import re
import tempfile
import threading
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import content, course, db, llm, prompts, pronounce, stt, tts
from .config import STATIC_DIR

app = FastAPI(title="Speak English")


@app.on_event("startup")
def warm_up():
    """Download and load Whisper and the Piper voice in the background, so the first talk is fast."""

    def load():
        s = db.get_settings()
        for step in (lambda: stt._model(s["whisper_model"]), lambda: tts.get_voice(s["accent"])):
            try:
                step()
            except Exception as e:  # noqa: BLE001 - offline at boot is fine; it retries on first use
                print("warm-up skipped:", e, flush=True)

    threading.Thread(target=load, daemon=True).start()


@app.exception_handler(llm.LLMError)
async def llm_error(_, exc):
    return JSONResponse({"detail": str(exc)}, status_code=502)


def settings():
    return db.get_settings()


# ---------- settings & model ----------


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/settings")
def get_settings():
    return settings()


@app.put("/api/settings")
def put_settings(values: dict):
    return db.save_settings(values)


@app.get("/api/models")
async def models():
    try:
        return {"models": await llm.list_models(settings())}
    except Exception as e:  # noqa: BLE001 - shown to the user on the Settings page
        raise HTTPException(502, f"Cannot reach the model server: {e}")


@app.get("/api/content")
def get_content():
    return {
        "scenarios": content.SCENARIOS,
        "topic": content.topic_of_day(),
        "levels": list(content.PRACTICE_SENTENCES.keys()),
    }


# ---------- speech ----------


async def _save_upload(file: UploadFile):
    suffix = Path(file.filename or "audio.webm").suffix or ".webm"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(await file.read())
    tmp.close()
    return Path(tmp.name)


@app.post("/api/stt")
async def speech_to_text(audio: UploadFile = File(...)):
    path = await _save_upload(audio)
    try:
        return await run_in_threadpool(stt.transcribe, path, settings()["whisper_model"])
    finally:
        path.unlink(missing_ok=True)


class TTSIn(BaseModel):
    text: str
    accent: str | None = None
    speed: float | None = None


@app.post("/api/tts")
async def text_to_speech(body: TTSIn):
    s = settings()
    text = body.text.strip()[:2000]
    if not text:
        raise HTTPException(400, "empty text")
    try:
        wav = await run_in_threadpool(
            tts.synthesize, text, body.accent or s["accent"], body.speed or s["voice_speed"]
        )
    except Exception as e:  # noqa: BLE001 - the browser falls back to its own voice
        raise HTTPException(503, f"Piper voice not ready: {e}")
    return Response(wav, media_type="audio/wav")


# ---------- conversation ----------


class SpeechInfo(BaseModel):
    audio_seconds: float = 0
    word_count: int = 0
    wpm: float | None = None
    avg_confidence: float | None = None


class ChatIn(BaseModel):
    session_id: int | None = None
    mode: str = "free"
    scenario_id: str | None = None
    text: str = ""
    image: str | None = None  # data URL
    speech: SpeechInfo | None = None
    start: bool = False  # ask the AI to speak first


def _history(session_id, limit=10):
    rows = db.query(
        "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?",
        (session_id, limit),
    )
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def _sse(obj):
    return f"data: {json.dumps(obj)}\n\n"


@app.post("/api/chat")
async def chat(body: ChatIn):
    s = settings()
    sid = body.session_id
    if not sid:
        sid = db.execute(
            "INSERT INTO sessions(mode, scenario) VALUES(?, ?)", (body.mode, body.scenario_id)
        )
    sess = db.query_one("SELECT * FROM sessions WHERE id = ?", (sid,))
    if not sess:
        raise HTTPException(404, "session not found")
    mode, scenario_id = sess["mode"], sess["scenario"]
    image = body.image if s["vision_enabled"] else None

    user_msg_id = None
    user_text = body.text.strip()
    if body.start:
        sc = content.scenario(scenario_id) if mode == "roleplay" else None
        if sc:
            # Role-plays open with a fixed line: no model call, instant start.
            mid = db.execute(
                "INSERT INTO messages(session_id, role, content) VALUES(?, 'assistant', ?)",
                (sid, sc["start"]),
            )

            async def opening():
                yield _sse({"type": "session", "session_id": sid, "user_message_id": None})
                yield _sse({"type": "delta", "text": sc["start"]})
                yield _sse({"type": "done", "message_id": mid})

            return StreamingResponse(opening(), media_type="text/event-stream")
        if mode == "course":
            wn, dn = course.parse_id(scenario_id)
            w = course.week(wn)
            if w and dn == 3:
                # Wednesday: this week's phrasal verbs go to the flashcards.
                for pv in w["phrasal"]:
                    db.execute(
                        "INSERT OR IGNORE INTO cards(kind, front, back, example) VALUES('word', ?, ?, '')",
                        (pv, f"Week {wn} phrasal verb"),
                    )
            user_text = "I'm ready. Start the game!"
        elif mode == "topic":
            t = content.topic_of_day()
            user_text = f"Let's talk about today's topic: {t['topic']}. Ask me: {t['question']}"
        elif mode.startswith("picture"):
            user_text = "Here is my picture."
        else:
            user_text = "Hi! Please start the conversation."
    if not user_text and not image:
        raise HTTPException(400, "empty message")

    sp = body.speech or SpeechInfo()
    user_msg_id = db.execute(
        "INSERT INTO messages(session_id, role, content, audio_seconds, word_count, wpm, avg_confidence, has_image, hidden) "
        "VALUES(?, 'user', ?, ?, ?, ?, ?, ?, ?)",
        (sid, user_text or "(picture)", sp.audio_seconds, sp.word_count, sp.wpm, sp.avg_confidence, 1 if image else 0,
         1 if body.start else 0),
    )

    history = _history(sid)
    if image:
        history[-1]["content"] = llm.with_image(history[-1]["content"], image)
    messages = [{"role": "system", "content": prompts.system_prompt(s, mode, scenario_id)}] + history
    model = llm.pick_model(s, bool(image))

    async def gen():
        yield _sse({"type": "session", "session_id": sid, "user_message_id": None if body.start else user_msg_id})
        parts = []
        try:
            async for piece in llm.stream_chat(s, messages, model=model, max_tokens=220 if mode == "course" else 150):
                parts.append(piece)
                yield _sse({"type": "delta", "text": piece})
        except Exception as e:  # noqa: BLE001 - reported to the browser
            yield _sse({"type": "error", "message": str(e)})
            return
        reply = "".join(parts).strip() or "Sorry, could you say that again?"
        mid = db.execute(
            "INSERT INTO messages(session_id, role, content) VALUES(?, 'assistant', ?)", (sid, reply)
        )
        yield _sse({"type": "done", "message_id": mid})

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"X-Accel-Buffering": "no"})


class CorrectIn(BaseModel):
    message_id: int | None = None
    text: str


@app.post("/api/correct")
async def correct(body: CorrectIn):
    s = settings()
    if s["correction_style"] == "off" or len(body.text.split()) < 2:
        return {"ok": True, "corrected": "", "mistakes": []}
    result = await llm.complete_json(
        s,
        [
            {"role": "system", "content": prompts.correction_prompt(s["correction_style"])},
            {"role": "user", "content": body.text},
        ],
        fallback={"ok": True, "corrected": "", "mistakes": []},
    )
    mistakes = [
        m for m in result.get("mistakes") or []
        if isinstance(m, dict) and m.get("wrong") and m.get("right")
        and pronounce.norm(m["wrong"]) != pronounce.norm(m["right"])
    ]
    result = {"ok": not mistakes, "corrected": result.get("corrected", "") if mistakes else "", "mistakes": mistakes}
    if body.message_id:
        db.execute("UPDATE messages SET correction = ? WHERE id = ?", (json.dumps(result), body.message_id))
        for m in mistakes:
            db.execute(
                "INSERT INTO mistakes(message_id, wrong, right, type, why, sentence, corrected) VALUES(?,?,?,?,?,?,?)",
                (body.message_id, m["wrong"], m["right"], m.get("type", ""), m.get("why", ""), body.text, result["corrected"]),
            )
    return result


@app.get("/api/sessions")
def list_sessions(limit: int = 30):
    return db.query(
        "SELECT s.*, (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id AND m.role='user' AND NOT m.hidden) AS turns, "
        "(SELECT content FROM messages m WHERE m.session_id = s.id AND m.role='user' AND NOT m.hidden ORDER BY m.id DESC LIMIT 1) AS last_text "
        "FROM sessions s WHERE EXISTS (SELECT 1 FROM messages m WHERE m.session_id = s.id AND m.role='user' AND NOT m.hidden) "
        "ORDER BY s.id DESC LIMIT ?",
        (limit,),
    )


@app.get("/api/sessions/{sid}")
def get_session(sid: int):
    sess = db.query_one("SELECT * FROM sessions WHERE id = ?", (sid,))
    if not sess:
        raise HTTPException(404)
    msgs = db.query("SELECT * FROM messages WHERE session_id = ? AND NOT hidden ORDER BY id", (sid,))
    for m in msgs:
        m["correction"] = json.loads(m["correction"]) if m["correction"] else None
    sess["summary"] = json.loads(sess["summary"]) if sess["summary"] else None
    return {"session": sess, "messages": msgs}


@app.post("/api/sessions/{sid}/end")
async def end_session(sid: int):
    s = settings()
    user_msgs = db.query("SELECT id, content FROM messages WHERE session_id = ? AND role='user' AND NOT hidden", (sid,))
    if not user_msgs:
        db.execute("UPDATE sessions SET ended_at = datetime('now') WHERE id = ?", (sid,))
        return {"good": [], "fix": [], "words": []}
    mistakes = db.query(
        "SELECT wrong, right, why FROM mistakes WHERE message_id IN (SELECT id FROM messages WHERE session_id = ?)",
        (sid,),
    )
    said = "\n".join(f"- {m['content']}" for m in user_msgs[-30:])
    found = "\n".join(f"- {m['wrong']} -> {m['right']} ({m['why']})" for m in mistakes[:30]) or "none"
    summary = await llm.complete_json(
        s,
        [
            {"role": "system", "content": prompts.SUMMARY_PROMPT},
            {"role": "user", "content": f"What the learner said:\n{said}\n\nMistakes found:\n{found}"},
        ],
        fallback={"good": ["You practised speaking today. Well done!"], "fix": [], "words": []},
    )
    stats = db.query_one(
        "SELECT COALESCE(SUM(audio_seconds),0) AS seconds, COALESCE(SUM(word_count),0) AS words, "
        "AVG(wpm) AS wpm FROM messages WHERE session_id = ? AND role='user'",
        (sid,),
    )
    summary["stats"] = {**stats, "mistakes": len(mistakes), "turns": len(user_msgs)}
    sess = db.query_one("SELECT mode, scenario FROM sessions WHERE id = ?", (sid,))
    if sess and sess["mode"] == "course":
        replies = db.query("SELECT content FROM messages WHERE session_id = ? AND role='assistant'", (sid,))
        xp = sum(int(n) for r in replies for n in re.findall(r"\[XP\+(\d+)\]", r["content"]))
        summary["xp"] = xp
        summary["stars"] = min(3, xp // 20)
        if len(user_msgs) >= 4:
            # Keep the best score of all tries.
            db.execute(
                "INSERT INTO course_progress(lesson, session_id, xp) VALUES(?, ?, ?) "
                "ON CONFLICT(lesson) DO UPDATE SET done_at = datetime('now'), session_id = excluded.session_id, "
                "xp = MAX(course_progress.xp, excluded.xp)",
                (sess["scenario"], sid, xp),
            )
            summary["lesson_done"] = sess["scenario"]
    db.execute(
        "UPDATE sessions SET ended_at = datetime('now'), summary = ? WHERE id = ?", (json.dumps(summary), sid)
    )
    return summary


# ---------- helpers: translate, help me say it, word info ----------


class TextIn(BaseModel):
    text: str


@app.post("/api/translate")
async def translate(body: TextIn):
    s = settings()
    lang = s.get("native_language") or "French"
    out = await llm.complete(
        s,
        [
            {"role": "system", "content": f"Translate the user's text into {lang}. Answer with the translation only."},
            {"role": "user", "content": body.text},
        ],
    )
    return {"language": lang, "translation": out}


@app.post("/api/help-say")
async def help_say(body: TextIn):
    return await llm.complete_json(
        settings(),
        [{"role": "system", "content": prompts.HELP_SAY_PROMPT}, {"role": "user", "content": body.text}],
        fallback={"english": "", "simple": "", "tip": "Sorry, I could not understand. Try again."},
    )


@app.post("/api/word")
async def word_info(body: TextIn):
    s = settings()
    native = (
        f', "translation": "translation in {s["native_language"]}"' if s.get("native_language") else ""
    )
    return await llm.complete_json(
        s,
        [
            {"role": "system", "content": prompts.WORD_PROMPT.format(level=s["level"], native=native)},
            {"role": "user", "content": body.text},
        ],
        fallback={"word": body.text, "meaning": "", "example": ""},
    )


# ---------- mistakes & flashcards ----------


@app.get("/api/mistakes")
def mistakes(limit: int = 200):
    rows = db.query("SELECT * FROM mistakes ORDER BY id DESC LIMIT ?", (limit,))
    by_type = db.query(
        "SELECT COALESCE(NULLIF(type,''),'other') AS type, COUNT(*) AS n FROM mistakes GROUP BY 1 ORDER BY n DESC"
    )
    return {"mistakes": rows, "by_type": by_type}


class CardIn(BaseModel):
    kind: str = "word"
    front: str
    back: str = ""
    example: str = ""


@app.get("/api/cards")
def cards(kind: str | None = None):
    if kind:
        return db.query("SELECT * FROM cards WHERE kind = ? ORDER BY id DESC", (kind,))
    return db.query("SELECT * FROM cards ORDER BY id DESC")


@app.post("/api/cards")
def add_card(card: CardIn):
    front = card.front.strip()
    if not front:
        raise HTTPException(400, "empty card")
    db.execute(
        "INSERT INTO cards(kind, front, back, example) VALUES(?,?,?,?) "
        "ON CONFLICT(kind, front) DO UPDATE SET back = excluded.back, example = excluded.example",
        (card.kind, front, card.back, card.example),
    )
    return db.query_one("SELECT * FROM cards WHERE kind = ? AND front = ?", (card.kind, front))


@app.delete("/api/cards/{cid}")
def delete_card(cid: int):
    db.execute("DELETE FROM cards WHERE id = ?", (cid,))
    return {"ok": True}


@app.get("/api/cards/due")
def due_cards(limit: int = 20):
    return db.query(
        "SELECT * FROM cards WHERE due_at <= datetime('now') ORDER BY due_at LIMIT ?", (limit,)
    )


class ReviewIn(BaseModel):
    grade: int  # 0 again, 1 hard, 2 good, 3 easy


@app.post("/api/cards/{cid}/review")
def review_card(cid: int, body: ReviewIn):
    """Simple SM-2 style spaced repetition (proposal 33)."""
    c = db.query_one("SELECT * FROM cards WHERE id = ?", (cid,))
    if not c:
        raise HTTPException(404)
    g = max(0, min(3, body.grade))
    ease = max(1.3, c["ease"] + [-0.3, -0.15, 0.0, 0.15][g])
    if g == 0:
        interval, reps = 0.007, 0  # about 10 minutes
    elif c["reps"] == 0:
        interval, reps = [0, 1, 1, 3][g], 1
    else:
        interval = max(1, c["interval_days"] * (ease if g >= 2 else 1.2) * (1.3 if g == 3 else 1))
        reps = c["reps"] + 1
    due = datetime.datetime.utcnow() + datetime.timedelta(days=interval)
    db.execute(
        "UPDATE cards SET ease=?, interval_days=?, reps=?, due_at=? WHERE id=?",
        (ease, interval, reps, due.strftime("%Y-%m-%d %H:%M:%S"), cid),
    )
    return db.query_one("SELECT * FROM cards WHERE id = ?", (cid,))


# ---------- pronunciation practice ----------


@app.get("/api/practice/sentence")
async def practice_sentence(ai: bool = False, about: str = ""):
    s = settings()
    level = s["level"] if s["level"] in content.PRACTICE_SENTENCES else "B1"
    if ai:
        about_txt = f" about {about}" if about else ""
        out = await llm.complete_json(
            s,
            [{"role": "user", "content": prompts.PRACTICE_PROMPT.format(level=level, about=about_txt)}],
            fallback={},
        )
        if isinstance(out.get("sentence"), str) and out["sentence"].strip():
            return {"sentence": out["sentence"].strip(), "source": "ai"}
    return {"sentence": random.choice(content.PRACTICE_SENTENCES[level]), "source": "list"}


@app.post("/api/practice/check")
async def practice_check(audio: UploadFile = File(...), target: str = Form(...), save: bool = Form(True)):
    s = settings()
    path = await _save_upload(audio)
    try:
        heard = await run_in_threadpool(stt.transcribe, path, s["whisper_model"])
    finally:
        path.unlink(missing_ok=True)
    cmp = pronounce.compare_words(target, heard["words"])
    sound = None
    word_sounds = []
    try:
        t_ph = await run_in_threadpool(tts.phonemes, target, s["accent"])
        h_ph = await run_in_threadpool(tts.phonemes, heard["text"], s["accent"]) if heard["text"] else []
        sound = pronounce.sound_similarity(t_ph, h_ph)
        for w in cmp["words"]:
            if w["status"] in ("wrong", "unclear") and w["heard"]:
                exp = await run_in_threadpool(tts.phonemes, w["word"], s["accent"])
                got = await run_in_threadpool(tts.phonemes, w["heard"], s["accent"])
                if exp == got:
                    # Same sounds, different spelling ("to" / "too"): the learner said it right.
                    w["status"] = "ok"
                    continue
                word_sounds.append({"word": w["word"], "expected": " ".join(exp), "heard": " ".join(got)})
        cmp["score"] = pronounce.word_score(cmp["words"])
    except Exception:  # noqa: BLE001 - phonemes are a bonus; keep the word check
        pass
    if save:
        db.execute(
            "INSERT INTO pron_attempts(target, heard, word_score, sound_score, audio_seconds) VALUES(?,?,?,?,?)",
            (target, heard["text"], cmp["score"], sound, heard["duration"]),
        )
    return {**cmp, "sound_score": sound, "word_sounds": word_sounds, "transcript": heard}


# ---------- pictures ----------


class ImageIn(BaseModel):
    image: str


@app.post("/api/image/read-text")
async def read_text(body: ImageIn):
    s = settings()
    if not s["vision_enabled"]:
        raise HTTPException(400, "Image features are turned off in Settings.")
    out = await llm.complete(
        s,
        [{"role": "user", "content": llm.with_image(prompts.READ_TEXT_PROMPT, body.image)}],
        model=llm.pick_model(s, True),
        temperature=0.0,
    )
    return {"text": "" if "NO_TEXT" in out else out}


# ---------- 15-week course ----------


@app.get("/api/course")
def get_course():
    done = {r["lesson"]: r for r in db.query("SELECT * FROM course_progress")}
    current = next(
        (f"w{w['week']}d{d['day']}" for w in course.WEEKS for d in course.DAYS if f"w{w['week']}d{d['day']}" not in done),
        None,
    )
    hero = db.get_settings().get("hero_name") or "Hero"
    games = {w["week"]: course.game(w["week"], hero) for w in course.WEEKS}
    total_xp = sum(r.get("xp") or 0 for r in done.values())
    return {
        "phases": course.PHASES, "weeks": course.WEEKS, "days": course.DAYS, "games": games,
        "done": done, "current": current, "hero": hero, "total_xp": total_xp,
    }


@app.post("/api/course/{lesson}/done")
def mark_lesson(lesson: str, done: bool = True):
    if done:
        db.execute("INSERT OR IGNORE INTO course_progress(lesson) VALUES(?)", (lesson,))
    else:
        db.execute("DELETE FROM course_progress WHERE lesson = ?", (lesson,))
    return {"ok": True}


# ---------- progress ----------


@app.get("/api/stats")
def stats(tz: int = 0):
    """tz = browser offset in minutes east of UTC, so days match the user's clock."""
    shift = f"{int(tz):+d} minutes"
    s = settings()
    activity = db.query(
        "SELECT day, SUM(sec) AS seconds FROM ("
        " SELECT date(created_at, ?) AS day, audio_seconds AS sec FROM messages WHERE role='user'"
        " UNION ALL SELECT date(created_at, ?) AS day, audio_seconds AS sec FROM pron_attempts"
        ") GROUP BY day ORDER BY day",
        (shift, shift),
    )
    today = (datetime.datetime.utcnow() + datetime.timedelta(minutes=tz)).date()
    by_day = {a["day"]: a["seconds"] or 0 for a in activity}
    days = []
    for i in range(29, -1, -1):
        d = (today - datetime.timedelta(days=i)).isoformat()
        days.append({"day": d, "minutes": round(by_day.get(d, 0) / 60, 1)})

    streak = 0
    d = today if today.isoformat() in by_day else today - datetime.timedelta(days=1)
    while d.isoformat() in by_day:
        streak += 1
        d -= datetime.timedelta(days=1)

    weekly = db.query(
        "SELECT strftime('%Y-%W', created_at, ?) AS week, SUM(word_count) AS words, AVG(avg_confidence) AS conf, "
        "(SELECT COUNT(*) FROM mistakes k WHERE strftime('%Y-%W', k.created_at, ?) = strftime('%Y-%W', m.created_at, ?)) AS mistakes "
        "FROM messages m WHERE role='user' GROUP BY week ORDER BY week DESC LIMIT 12",
        (shift, shift, shift),
    )
    for w in weekly:
        w["mistakes_per_100"] = round(100 * w["mistakes"] / w["words"], 1) if w["words"] else None
        w["conf"] = round(100 * w["conf"]) if w["conf"] is not None else None
    pron = db.query(
        "SELECT strftime('%Y-%W', created_at, ?) AS week, ROUND(AVG(word_score)) AS word_score, "
        "ROUND(AVG(sound_score)) AS sound_score, COUNT(*) AS attempts FROM pron_attempts GROUP BY week ORDER BY week DESC LIMIT 12",
        (shift,),
    )
    totals = db.query_one(
        "SELECT (SELECT COUNT(*) FROM sessions) AS sessions, "
        "(SELECT COALESCE(SUM(word_count),0) FROM messages WHERE role='user') AS words, "
        "(SELECT COUNT(*) FROM mistakes) AS mistakes, (SELECT COUNT(*) FROM cards) AS cards, "
        "(SELECT COUNT(*) FROM cards WHERE due_at <= datetime('now')) AS cards_due"
    )
    total_minutes = round(sum(by_day.values()) / 60, 1)
    return {
        "days": days,
        "today_minutes": days[-1]["minutes"],
        "goal_minutes": s["daily_goal_minutes"],
        "streak": streak,
        "total_minutes": total_minutes,
        "weekly": list(reversed(weekly)),
        "pronunciation": list(reversed(pron)),
        **totals,
    }


# ---------- web app ----------

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = STATIC_DIR / path
        if path and f.is_file() and STATIC_DIR in f.resolve().parents:
            return FileResponse(f)
        return FileResponse(STATIC_DIR / "index.html")
