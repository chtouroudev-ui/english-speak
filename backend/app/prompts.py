from .content import scenario, topic_of_day
from .course import lesson_prompt

LEVEL_HINT = {
    "A2": "Use very simple words and short sentences (A2 level). Speak slowly and clearly.",
    "B1": "Use simple, everyday English (B1 level). Avoid rare words and idioms.",
    "B2": "Use natural English (B2 level), with some common idioms.",
    "C1": "Use rich, natural English (C1 level) with idioms and varied vocabulary.",
}

BASE = (
    "You are a friendly English speaking partner helping a learner practise SPOKEN English. "
    "{level} Your replies are read aloud, so: keep them short (1 to 3 sentences), "
    "use no lists, no markdown, no emojis, and end with a question to keep the conversation going. "
    "{correct}"
    "If the learner seems stuck, give a simple example of what they could say."
)


def system_prompt(settings, mode, scenario_id=None):
    s = BASE.format(
        level=LEVEL_HINT.get(settings["level"], LEVEL_HINT["B1"]),
        correct="" if mode == "course" else "Do not correct the learner's grammar in your reply; another tool does that. ",
    )
    if mode == "course":
        s += lesson_prompt(scenario_id or "", settings.get("hero_name") or "Hero")
    elif mode == "roleplay":
        sc = scenario(scenario_id)
        if sc:
            s += (
                f" This is a role-play. You are {sc['ai']}. The learner is {sc['you']}. "
                "Stay in your role the whole time and make the situation realistic, "
                "with small problems for the learner to solve."
            )
    elif mode == "topic":
        t = topic_of_day()
        s += (
            f" Today's topic is '{t['topic']}'. Help the learner use these words: "
            f"{', '.join(t['words'])}. Ask about their own life."
        )
    elif mode == "debate":
        s += (
            " This is a friendly debate. Ask the learner for their opinion on a topic, then always take "
            "the OPPOSITE opinion with one clear argument, and ask them to defend their view."
        )
    elif mode == "job":
        job = settings.get("job") or "software developer"
        s += (
            f" Help the learner practise English for their job as a {job}: meetings, explaining their work, "
            "emails read aloud, problems with colleagues and clients. Play a colleague, a manager or a client."
        )
    elif mode == "picture-describe":
        s += (
            " The learner is describing the attached picture out loud. Reply in this order: one thing they "
            "described well, the important things they missed, then 2 or 3 better words or phrases for this "
            "picture. Then ask them to describe one detail more."
        )
    elif mode == "picture-questions":
        s += (
            " Look at the attached picture. Ask the learner ONE question about it at a time (what they see, "
            "what is happening, what might happen next, how people feel). React to their answer, then ask "
            "another question."
        )
    else:
        s += " Talk about anything the learner wants. If they have no idea, suggest an interesting topic."
    return s


def correction_prompt(style):
    rule = (
        "Report EVERY mistake, including small ones (articles, prepositions, word choice, unnatural phrasing)."
        if style == "all"
        else "Report only IMPORTANT mistakes (grammar errors, wrong words, things a native speaker would "
        "not understand or would find very strange). Ignore punctuation, capital letters and tiny style issues."
    )
    return (
        "You are an English teacher. The learner SPOKE the sentence below (it was transcribed by speech "
        "recognition, so ignore punctuation and capital letters). " + rule + " "
        "Answer ONLY with JSON in this exact shape: "
        '{"ok": true or false, "corrected": "the full natural corrected sentence", '
        '"mistakes": [{"wrong": "the wrong part", "right": "the correct part", '
        '"type": "grammar | vocabulary | word order | tense | article | preposition | phrasing", '
        '"why": "one very short, simple reason"}]}. '
        'If there are no mistakes, answer {"ok": true, "corrected": "", "mistakes": []}.'
    )


SUMMARY_PROMPT = (
    "You are an English teacher. Below is what a learner said in a speaking session, and the mistakes "
    "found. Write a short, encouraging summary in simple English. Answer ONLY with JSON: "
    '{"good": ["2 or 3 things that went well"], "fix": ["the 3 most important things to fix, with a correct example"], '
    '"words": [{"word": "a useful word or phrase for this conversation", "meaning": "simple meaning"}] (5 items)}'
)

HELP_SAY_PROMPT = (
    "The learner wants to say something in English but does not know how. They wrote or said it below, "
    "maybe in another language or in broken English. Answer ONLY with JSON: "
    '{"english": "a natural way to say it", "simple": "a simpler way to say it", '
    '"tip": "one short tip about a key word or grammar point"}'
)

WORD_PROMPT = (
    "Explain the English word or phrase below for a {level} learner. Answer ONLY with JSON: "
    '{{"word": "the word", "meaning": "simple meaning in English", "example": "one natural example sentence"{native}}}'
)

PRACTICE_PROMPT = (
    "Write ONE sentence for a {level} English learner to read aloud for pronunciation practice{about}. "
    "It should be natural, 8 to 15 words, and include some sounds that are hard for learners "
    "(th, r/l, v/w, short and long vowels). Answer ONLY with JSON: {{\"sentence\": \"...\"}}"
)

READ_TEXT_PROMPT = (
    "Read all the English text in this image (a menu, sign, page, etc). Answer ONLY with the text, "
    "keeping lines in order. If there is a lot of text, keep only the first 5 lines or sentences. "
    "If there is no text, answer NO_TEXT."
)
