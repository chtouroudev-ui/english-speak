"""The learner's 15-week semester plan, turned into daily speaking calls (Mon-Fri)."""

PHASES = [
    {"n": 1, "title": "The core tenses", "weeks": [1, 2, 3], "goal": "Talk about everyday actions in the present, past and future without conjugation mistakes."},
    {"n": 2, "title": "The perfect tenses", "weeks": [4, 5, 6], "goal": "Connect two points in time with have / has / had."},
    {"n": 3, "title": "Modal verbs and nuance", "weeks": [7, 8], "goal": "Express certainty, obligation, ability and polite requests like a native speaker."},
    {"n": 4, "title": "Phrasal verbs: mechanics and word building", "weeks": [9, 10, 11, 12, 13], "goal": "Work through the 5 Cambridge units one by one."},
    {"n": 5, "title": "High-frequency vocabulary and full integration", "weeks": [14, 15], "goal": "Combine all tenses, modals and phrasal verbs in fluent speech."},
]

WEEKS = [
    {
        "week": 1, "title": "Simple present",
        "grammar": [
            "Base verb for I/you/we/they (I take) and -s for he/she/it (she takes)",
            "Spelling: -y becomes -ies (fly → flies, but play → plays); add -es (passes, catches, fixes, pushes)",
            "Negatives and questions with do / does + base verb (She doesn't work. Does he work?)",
        ],
        "words": ["every day", "every week", "always", "sometimes", "never", "frequently", "currently"],
        "phrasal": ["abide by", "account for", "act on", "add up", "aim at", "act up", "add on", "agree with", "allow for", "answer back"],
        "book": "tenses.docx p.1 · ReaderVerbTenses.pdf p.1 · Complete-PV-list.pdf p.1–2",
    },
    {
        "week": 2, "title": "Simple past and simple future",
        "grammar": [
            "Regular past: add -ed or -d (played, danced, fried, studied)",
            "Irregular past verbs (took, gave, ran, caught)",
            "Future with will + base verb (I will learn)",
        ],
        "words": ["yesterday", "two days ago", "three years ago", "last week", "last month", "tomorrow", "next year"],
        "phrasal": ["back up", "back down", "back out", "back off", "be after", "be fed up", "be snowed under", "be up to", "be over", "be into"],
        "book": "tenses.docx p.1–2 · ReaderVerbTenses.pdf p.1, exercises 1–2 p.3–4 · Complete-PV-list.pdf p.2–5",
    },
    {
        "week": 3, "title": "Present, past and future progressive",
        "grammar": [
            "to be (am/is/are/was/were/will be) + verb-ing",
            "Contractions (I'm, you're, he's, aren't, isn't) and questions (Are you playing?)",
            "Uses: actions right now, temporary actions, trends, annoying habits with 'always'",
        ],
        "words": ["hammering", "watching", "introducing", "monitoring", "right now", "at the moment", "these days"],
        "phrasal": ["break down", "break in", "break off", "break out", "break through", "break up"],
        "book": "tenses.docx p.2–3 · ReaderVerbTenses.pdf p.2, exercise 4 p.6 · Complete-PV-list.pdf p.10",
    },
    {
        "week": 4, "title": "Present perfect",
        "grammar": [
            "have / has + past participle",
            "The reference point is now",
            "Unspecified time in the past (Sean has travelled to Mexico) and unfinished actions (It hasn't stopped raining yet)",
        ],
        "words": ["competed", "travelled", "finished", "lent", "worn", "donated", "run", "ever", "never", "already", "yet"],
        "phrasal": ["bring about", "bring back", "bring down", "bring up", "bring in", "bring out"],
        "book": "PerfectTenses_1.pdf p.1–3 · ReaderVerbTenses.pdf p.2 · Complete-PV-list.pdf p.11–12",
    },
    {
        "week": 5, "title": "Past perfect and future perfect",
        "grammar": [
            "Past perfect: had + participle, to put past events in order (Before she started college, Angela had competed...)",
            "Future perfect: will have + participle (By this time tomorrow, I will have finished...)",
        ],
        "words": ["before", "by the time", "by Friday", "by 2030", "when", "since", "yet"],
        "phrasal": ["call back", "call for", "call off", "call on", "call out", "call up"],
        "book": "PerfectTenses_1.pdf p.2–3 · ReaderVerbTenses.pdf exercise 3 p.5 · Complete-PV-list.pdf p.14–15",
    },
    {
        "week": 6, "title": "Perfect progressive tenses",
        "grammar": [
            "have/has/had/will have + been + verb-ing",
            "Duration up to a reference point (She has been grading since yesterday)",
            "Non-continuous verbs (know, like, own) use the simple perfect instead",
        ],
        "words": ["for two hours", "since this morning", "all day", "lately", "recently"],
        "phrasal": ["carry on", "carry out", "carry over", "catch on", "catch up with", "catch out"],
        "book": "PerfectTenses_1.pdf p.3 · ReaderVerbTenses.pdf p.1 chart, p.3 · Complete-PV-list.pdf p.15–17",
    },
    {
        "week": 7, "title": "Modals of possibility and ability",
        "grammar": [
            "Modal + base verb: no 'to', never -s (She can swim)",
            "Possibility from strongest to weakest: must, will → would, should, may → can, could, might",
            "Ability: can (strong), could (weaker or past); shall for suggestions",
        ],
        "words": ["must", "will", "would", "should", "may", "can", "could", "might", "shall"],
        "phrasal": ["come across", "come along", "come by", "come down with", "come up with", "come out"],
        "book": "Modal Verbs.pdf p.1–2, activity part I (Q1–10) · Complete-PV-list.pdf p.22–25",
    },
    {
        "week": 8, "title": "Modals of necessity and permission",
        "grammar": [
            "Must (strict obligation) vs should (advice)",
            "Requests: Modal + subject + verb? (Could you help me?)",
            "From formal to informal: May I...? → Could I...? → Can I...?",
        ],
        "words": ["have to", "must", "should", "may I", "could I", "can I", "would you mind"],
        "phrasal": ["cut back on", "cut down", "cut off", "cut out", "do away with", "do up", "do without"],
        "book": "Modal Verbs.pdf p.2–4, activity part II (Q11–20) · Complete-PV-list.pdf p.27–31",
    },
    {
        "week": 9, "title": "Phrasal verbs: the basics and object patterns",
        "grammar": [
            "Verb + particle (about, around, away, back, down, in, off, on, out, over, through, up...)",
            "No object (eat out), person object (ask someone out), thing object (bring something back)",
            "Three-part phrasal verbs (look forward to, put up with, get away with)",
        ],
        "words": ["look up", "go through", "make out", "look after", "ring back", "drop off", "send off", "turn up", "note down", "play up", "sort out", "mess about", "put off"],
        "phrasal": ["fall apart", "fall back on", "fall behind", "fall for", "fall out", "fall through"],
        "book": "Cambridge excerpt Unit 1 p.1–2, exercises 1.1–1.4 · Complete-PV-list.pdf p.35–36",
    },
    {
        "week": 10, "title": "Concrete vs abstract meanings, formal synonyms",
        "grammar": [
            "The same verb changes from a physical action (get on a bus) to an abstract meaning (Leo and Ella don't get on)",
            "Replace informal phrasal verbs with formal single verbs in serious speech",
        ],
        "words": ["put off = postpone", "take off = remove", "turn up = arrive", "brush aside = ignore", "fall for = believe", "make out = understand", "leave out = omit", "call off = cancel", "go down = decline", "get away = escape"],
        "phrasal": ["give in", "get on", "chase up", "put out", "see to", "brush aside"],
        "book": "Cambridge excerpt Unit 2 p.3–4, exercises 2.1–2.5",
    },
    {
        "week": 11, "title": "Particle meanings and pronoun position",
        "grammar": [
            "Particles change direction: invite out / in / over / round / up / along / back",
            "'over' = change of position (fall over, pull over) or thoroughly (read over, think over)",
            "Pronoun rule: woke them up, never 'woke up them'",
            "Three meanings of 'have on' (plans, a joke, wearing clothes)",
        ],
        "words": ["invite over", "think over", "talk over", "look over", "pull over", "have on"],
        "phrasal": ["get across", "get along with", "get around to", "get away with", "get by", "get down to", "get over", "get through", "get back", "get on with"],
        "book": "Cambridge excerpt Unit 3 p.5–6, exercises 3.1–3.4 · Complete-PV-list.pdf p.43–50",
    },
    {
        "week": 12, "title": "Nouns and adjectives from phrasal verbs",
        "grammar": [
            "Verb + particle nouns: break-in, check-in, mix-up, warm-up; dropout, rip-off, checkout, handout",
            "Plural on the particle: break-ins, dropouts (except goings-on)",
            "Particle + verb nouns: outset, downfall, onlooker, outcry, breakthrough, downturn, input",
            "Stress: a BREAK-in, a DROP-out, but the OUT-set, the DOWN-fall",
        ],
        "words": ["break-in", "mix-up", "show-off", "dropout", "rip-off", "outset", "breakthrough", "outgoing", "off-putting", "throwaway"],
        "phrasal": ["give away", "give back", "give in", "give off", "give out", "give up"],
        "book": "Cambridge excerpt Unit 4 p.7–8, exercises 4.1–4.5 · Complete-PV-list.pdf p.51–53",
    },
    {
        "week": 13, "title": "Metaphor, context clues and register",
        "grammar": [
            "Learn each meaning with a full sentence (get on a bus / get on with work / get on well)",
            "Literal → metaphorical: blow up a balloon → someone blows up in anger; switch off the radio → switch off in a boring lecture",
            "Formal vs informal, British vs American (clear up / tidy up)",
        ],
        "words": ["take in (6 meanings)", "slip up", "drive at", "drum into", "drown out", "let up"],
        "phrasal": ["go ahead", "go back on", "go down with", "go for", "go off", "go on", "go over", "go through"],
        "book": "Cambridge excerpt Unit 5 p.9–10, exercises 5.1–5.4 · Complete-PV-list.pdf p.53–59",
    },
    {
        "week": 14, "title": "Combining tenses and phrasal verbs",
        "grammar": [
            "One phrasal verb in every tense: he looks into → he is looking into → he had looked into → he will have looked into",
            "Tell a past story with past simple, past progressive, past perfect and 8 phrasal verbs",
        ],
        "words": [],
        "phrasal": ["keep at", "keep on", "keep up with", "look after", "look down on", "look forward to", "look into", "look up to", "make do with", "make up", "make up for"],
        "book": "ReaderVerbTenses.pdf p.1 chart · Complete-PV-list.pdf p.67–94",
    },
    {
        "week": 15, "title": "Academic vs conversational mastery",
        "grammar": [
            "Say the same idea casually (phrasal verbs, can/might) and formally (single verbs, may/must, perfect tenses)",
            "Final self-test across all tenses, modals and phrasal verbs",
        ],
        "words": [],
        "phrasal": ["pick up", "pick out", "put across", "put up with", "run into", "run out of", "set off", "set up", "take after", "take over", "turn down", "turn out"],
        "book": "PerfectTenses_1.pdf · Modal Verbs.pdf · Complete-PV-list.pdf p.86–130",
    },
]

DAYS = [
    {"day": 1, "name": "Monday", "title": "Learn it by talking", "what": "The grammar of the week, one small rule at a time, and you use each rule about your own life."},
    {"day": 2, "name": "Tuesday", "title": "Speed drills", "what": "Quick spoken drills: I give you a prompt, you answer fast with the right form, negatives and questions too."},
    {"day": 3, "name": "Wednesday", "title": "Phrasal verb stories", "what": "Each phrasal verb in a tiny story. Guess the meaning, then use it in your answer. They go to your flashcards."},
    {"day": 4, "name": "Thursday", "title": "Your life, your words", "what": "I interview you about your life. You must use this week's tense and phrasal verbs (instead of writing sentences)."},
    {"day": 5, "name": "Friday", "title": "Review quiz", "what": "A spoken quiz on this week, with some questions from earlier weeks, and your score at the end."},
]


def week(n):
    return next((w for w in WEEKS if w["week"] == n), None)


def parse_id(lesson_id):
    """'w3d2' -> (3, 2)"""
    try:
        w, d = lesson_id[1:].split("d")
        return int(w), int(d)
    except (ValueError, AttributeError, IndexError):
        return None, None


def lesson_prompt(lesson_id):
    wn, dn = parse_id(lesson_id)
    w = week(wn)
    if not w or not 1 <= dn <= 5:
        return ""
    grammar = "; ".join(w["grammar"])
    pv = ", ".join(w["phrasal"])
    words = ", ".join(w["words"])
    earlier = [p for x in WEEKS if x["week"] < wn for p in x["phrasal"]][-12:]
    head = (
        f" This is a PHONE CALL lesson: Week {wn} of a 15-week course, '{w['title']}'. "
        f"Grammar of the week: {grammar}. Phrasal verbs of the week: {pv}. "
        + (f"Useful words: {words}. " if words else "")
        + "Never give long lectures: one idea per turn, then make the learner SPEAK. "
        "Briefly correct the learner's mistake about this week's grammar before you go on "
        "(say the correct sentence once, kindly), because this is a lesson. "
        "Your first message welcomes them in one short sentence and starts the activity right away."
    )
    tasks = {
        1: " Today (Monday): teach the grammar by conversation. Take the rules one by one: say the rule in one "
        "simple sentence with one example, then ask a personal question that forces the learner to use it. When they "
        "get it right twice, move to the next rule. End by asking them to say 3 sentences of their own.",
        2: " Today (Tuesday): fast speaking drills on the grammar. Each turn give ONE short prompt (a subject + a verb, "
        "or 'make it negative', 'make it a question', 'change the time'), the learner answers, you say 'Correct!' or give "
        "the right form, then the next prompt immediately. Keep a score and say it every 5 prompts.",
        3: " Today (Wednesday): phrasal verbs. For each phrasal verb of the week: tell a 2-sentence mini-story that uses "
        "it, ask the learner what it means, confirm or explain, then ask a question that makes the learner use it in "
        "their answer. Then the next verb.",
        4: " Today (Thursday): interview the learner about their own life (work, family, plans, past experiences) with "
        "questions that need this week's tense. Every few turns, challenge them to use a specific phrasal verb of the "
        "week in their next answer.",
        5: " Today (Friday): a spoken review quiz of 10 questions: 6 on this week's grammar and phrasal verbs, 4 on "
        "earlier phrasal verbs" + (f" ({', '.join(earlier)})" if earlier else "") + ". Ask one question at a time, say "
        "if the answer is right, keep score, and at the end give the score and the 2 things to review.",
    }
    return head + tasks[dn]
