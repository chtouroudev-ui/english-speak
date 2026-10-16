"""Offline course games: questions built from the written lessons, no AI call.

Every level returns a list of questions the browser plays on its own:
  choice  - pick one option (which sentence is right, what a phrasal verb means, fill the gap)
  order   - tap the words to build the sentence
  write   - type a short answer (from the lesson quiz)
  speak   - say the sentence out loud (checked by Whisper, not by the language model)
"""

import random
import re

from . import course, lessons

IRREGULAR = {
    "abide": ["abode", "abided"], "be": ["am", "is", "are", "was", "were", "been", "being", "'m", "'s", "'re"],
    "break": ["broke", "broken"], "bring": ["brought"], "catch": ["caught"], "come": ["came"],
    "cut": ["cut"], "do": ["did", "done", "does"], "fall": ["fell", "fallen"], "get": ["got", "gotten"],
    "give": ["gave", "given"], "go": ["went", "gone", "goes"], "keep": ["kept"], "make": ["made"],
    "put": ["put"], "run": ["ran"], "see": ["saw", "seen"], "set": ["set"], "take": ["took", "taken"],
}

LEVEL_INFO = {
    1: {"title": "Training", "goal": "Answer the training questions. No hearts lost here."},
    2: {"title": "Speed challenge", "goal": "60 seconds. Answer as many as you can. Combos give bonus XP!"},
    3: {"title": "Phrasal verb quest", "goal": "Each phrasal verb is a locked door. Find its meaning and use it to open the door."},
    4: {"title": "Power words", "goal": "Build the sentences and say them out loud. Your voice is your power."},
    5: {"title": "Boss battle", "goal": "Beat the boss with 10 right answers. You have 3 hearts."},
}


def _forms(word):
    w = word.lower()
    out = {w, w + "s", w + "es", w + "ed", w + "d", w + "ing"}
    if w.endswith("e"):
        out |= {w[:-1] + "ing"}
    if w.endswith("y"):
        out |= {w[:-1] + "ies", w[:-1] + "ied"}
    if re.fullmatch(r".*[^aeiou][aeiou][bdgmnprt]", w):
        out |= {w + w[-1] + "ing", w + w[-1] + "ed"}
    out |= set(IRREGULAR.get(w, []))
    return out


def base(verb):
    """'be fed up (with)' -> 'be fed up'"""
    return re.sub(r"\s*\(.*?\)", "", verb).strip()


def blank(example, verb):
    """Replace the phrasal verb in the example with ___ (only when its words are together)."""
    parts = base(verb).lower().split()
    toks = re.findall(r"[A-Za-z']+|[^A-Za-z']+", example)
    words = [(i, t) for i, t in enumerate(toks) if re.fullmatch(r"[A-Za-z']+", t)]
    for k in range(len(words) - len(parts) + 1):
        first = words[k][1].lower()
        # "I'm" -> "'m" for the verb be
        if first not in _forms(parts[0]) and not (parts[0] == "be" and re.search(r"'(m|s|re)$", first)):
            continue
        if all(words[k + j][1].lower() == parts[j] for j in range(1, len(parts))):
            start, end = words[k][0], words[k + len(parts) - 1][0]
            if parts[0] == "be" and "'" in first:
                pre = toks[start][: toks[start].index("'")]
                return "".join(toks[:start]) + pre + " ___" + "".join(toks[end + 1:])
            return "".join(toks[:start]) + "___" + "".join(toks[end + 1:])
    return None


def _clean(s):
    """A sentence good for a word puzzle: no notes, 4 to 11 words."""
    if any(c in s for c in "()/:=…") or "..." in s or "→" in s:
        return None
    n = len(s.split())
    return s if 4 <= n <= 11 else None


def _pick(rng, items, k):
    items = list(items)
    rng.shuffle(items)
    return items[:k]


def _choice(rng, prompt, right, wrong, explain="", kind="choice", say=None):
    opts = [right] + [w for w in dict.fromkeys(wrong) if w != right][:3]
    rng.shuffle(opts)
    q = {"type": "choice", "kind": kind, "prompt": prompt, "options": opts, "answer": opts.index(right), "explain": explain}
    if say:
        q["say"] = say
    return q


def pools(wn, rng):
    """All the questions one week can make, by kind."""
    L = lessons.LESSONS[wn]
    pv = L["phrasal"]
    verbs = [base(p["verb"]) for p in pv]
    out = {"fix": [], "meaning": [], "gap": [], "order": [], "write": [], "speak": []}
    for m in L["mistakes"]:
        out["fix"].append(_choice(rng, "Which sentence is correct?", m["right"], [m["wrong"]], m["why"], "fix", say=m["right"]))
    for p in pv:
        v = base(p["verb"])
        others = [x["meaning"] for x in pv if x is not p]
        out["meaning"].append(_choice(rng, f"What does “{v}” mean?", p["meaning"], _pick(rng, others, 3),
                                      p["example"], "meaning", say=p["example"]))
        g = blank(p["example"], p["verb"])
        if g:
            out["gap"].append(_choice(rng, g, v, _pick(rng, [x for x in verbs if x != v], 3),
                                      p["example"], "gap", say=p["example"]))
    sentences = [m["right"] for m in L["mistakes"]]
    for s in L["sections"]:
        sentences += s.get("examples", [])
        for row in s.get("table", [])[1:]:
            sentences += [c for c in row if c.count(" ") >= 3]
    sentences += [p["example"] for p in pv]
    seen = set()
    for s in sentences:
        c = _clean(s.strip())
        if c and c not in seen:
            seen.add(c)
            out["order"].append({"type": "order", "kind": "order", "prompt": "Build the sentence", "answer": c})
            out["speak"].append({"type": "speak", "kind": "speak", "prompt": "Say it out loud", "answer": c})
    for q in L["quiz"]:
        out["write"].append({"type": "write", "kind": "write", "prompt": q["q"], "answer": q["a"]})
    return out


def level(wn, dn, seed=None):
    if wn not in lessons.LESSONS or dn not in LEVEL_INFO:
        return None
    rng = random.Random(seed)
    P = pools(wn, rng)
    take = lambda kind, k: _pick(rng, P[kind], k)  # noqa: E731
    if dn == 1:
        qs = take("fix", 3) + take("meaning", 2) + take("order", 2) + take("write", 4)
    elif dn == 2:
        # A big bag of quick choices; the browser loops over it until time runs out.
        qs = P["fix"] + P["meaning"] + P["gap"]
        rng.shuffle(qs)
    elif dn == 3:
        qs = []
        gaps = {q["options"][q["answer"]]: q for q in P["gap"]}
        for q in P["meaning"]:
            v = re.search(r"“(.+?)”", q["prompt"]).group(1)
            qs.append({**q, "door": v})
            if v in gaps:
                qs.append({**gaps[v], "door": v})
    elif dn == 4:
        n = min(4, len(P["order"]))
        qs = []
        for o in take("order", n):
            qs += [o, {"type": "speak", "kind": "speak", "prompt": "Now say it out loud", "answer": o["answer"]}]
    else:
        qs = take("fix", 2) + take("gap", 3) + take("meaning", 2) + take("write", 1) + take("order", 1)
        earlier = [w for w in lessons.LESSONS if w < wn]
        if earlier:
            ep = pools(rng.choice(earlier), rng)
            qs += take_from(rng, ep["meaning"] + ep["gap"], 3, "Old enemy returns! ")
        rng.shuffle(qs)
        qs = qs[:12]
    g = course.game(wn) or {}
    return {
        "week": wn, "level": dn, **LEVEL_INFO[dn], "questions": qs,
        "boss": g.get("boss"), "emoji": g.get("emoji"),
    }


def take_from(rng, items, k, tag):
    return [{**q, "tag": tag.strip()} for q in _pick(rng, items, k)]
