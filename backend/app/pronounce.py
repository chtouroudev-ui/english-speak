"""Compare what the learner said with the sentence they had to read (proposals 17 and 18)."""
import difflib
import re

FILLERS = {"uh", "um", "umm", "uhm", "er", "erm", "hmm", "ah", "eh", "mm"}


def norm(word):
    return re.sub(r"[^a-z0-9']", "", word.lower().replace("’", "'"))


def compare_words(target, heard_words):
    """heard_words: list of {"word", "prob"} from Whisper."""
    t_words = [w for w in target.split() if norm(w)]
    t_norm = [norm(w) for w in t_words]
    h_norm = [norm(w["word"]) for w in heard_words]
    keep = [i for i, w in enumerate(h_norm) if w and w not in FILLERS]
    h_norm = [h_norm[i] for i in keep]
    heard = [heard_words[i] for i in keep]

    result = []
    extra = []
    sm = difflib.SequenceMatcher(a=t_norm, b=h_norm, autojunk=False)
    for op, a1, a2, b1, b2 in sm.get_opcodes():
        if op == "equal":
            for k in range(a2 - a1):
                prob = heard[b1 + k].get("prob", 1.0)
                status = "ok" if prob >= 0.6 else "unclear"
                result.append({"word": t_words[a1 + k], "status": status, "heard": heard[b1 + k]["word"], "prob": prob})
        elif op == "replace":
            for k in range(a2 - a1):
                h = heard[b1 + k]["word"] if b1 + k < b2 else ""
                result.append({"word": t_words[a1 + k], "status": "wrong" if h else "missed", "heard": h})
            extra += [heard[j]["word"] for j in range(b1 + (a2 - a1), b2)]
        elif op == "delete":
            for k in range(a1, a2):
                result.append({"word": t_words[k], "status": "missed", "heard": ""})
        elif op == "insert":
            extra += [heard[j]["word"] for j in range(b1, b2)]
    return {"words": result, "extra": extra, "score": word_score(result)}


def word_score(result):
    good = sum(1 for r in result if r["status"] == "ok") + 0.5 * sum(1 for r in result if r["status"] == "unclear")
    return round(100 * good / max(len(result), 1))


def sound_similarity(target_ph, heard_ph):
    """Approximate sound-level score: compares the phonemes of the target text with the
    phonemes of what Whisper heard. Not acoustic scoring, but cheap enough for a 2-CPU server."""
    a = "".join(target_ph)
    b = "".join(heard_ph)
    if not a:
        return None
    return round(100 * difflib.SequenceMatcher(a=a, b=b, autojunk=False).ratio())
