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

# One hero game per week. The learner is always the hero; the AI is the game master
# and plays every other character.
GAMES = {
    1: {"emoji": "🕵️", "name": "The Morning Detective",
        "story": "You are Detective {hero}, the best in London. A diamond vanished from the museum. Every suspect has a daily routine, and the truth hides in what people do every day.",
        "master": "You play the witnesses and suspects. The hero solves the case by asking do/does questions and describing routines."},
    2: {"emoji": "⏳", "name": "The Time Machine",
        "story": "Captain {hero}, your time machine works! You jump to yesterday to see what happened, and to the future to warn the city about what will happen.",
        "master": "You are the ship's computer and the people the hero meets in the past and the future."},
    3: {"emoji": "🛸", "name": "Drone Spy",
        "story": "Agent {hero}, your drone flies over the city. Report what everyone is doing right now, and find out what the suspects were doing last night.",
        "master": "You are mission control and the suspects who need an alibi ('What were you doing at 9 pm?')."},
    4: {"emoji": "🚀", "name": "Space Explorer",
        "story": "Commander {hero}, you are back from 6 months on Mars. The space agency wants to know everything you have done, and what you haven't done yet.",
        "master": "You are the space agency chief and the reporters at the press conference."},
    5: {"emoji": "🧩", "name": "Stop the Heist",
        "story": "Inspector {hero}, a bank was robbed at midnight. Put the events in order to catch the thief, and plan what you will have done by sunrise to stop the next heist.",
        "master": "You are the witnesses, the security guard and the thief who tries to confuse the timeline."},
    6: {"emoji": "🏝️", "name": "Survival Island",
        "story": "{hero}, your plane landed on a wild island. The rescue team calls you on the radio. Tell them how long you have been surviving and what you have been doing.",
        "master": "You are the rescue team on the radio and a strange parrot on the island."},
    7: {"emoji": "🔮", "name": "The Mystery Box",
        "story": "Sherlock {hero}, a mysterious box arrived with clues inside. Use your logic: it must be, it might be, it can't be. You can solve it before anyone else.",
        "master": "You present clues one by one; the hero deduces with must / might / could / can't."},
    8: {"emoji": "🏰", "name": "Knight of the Kingdom",
        "story": "Sir {hero}, the Queen just made you a knight. You must learn the rules of the palace, ask the Queen for permission politely, and give advice to the people.",
        "master": "You are the Queen (very formal), the old knight teacher and the villagers who need advice."},
    9: {"emoji": "🚒", "name": "City Rescue Team",
        "story": "Captain {hero}, you lead the rescue team. Cars break down, people fall behind, plans fall through. Every emergency needs the right phrasal verb.",
        "master": "You are the emergency radio dispatcher who sends new emergencies."},
    10: {"emoji": "🕶️", "name": "Double Agent",
        "story": "Agent {hero}, you live two lives: casual talk with your spy friends, and formal talk with the ambassador. One wrong word and your cover is blown!",
        "master": "You switch between a relaxed spy friend and a very formal ambassador. The hero must change register."},
    11: {"emoji": "👻", "name": "The Haunted House",
        "story": "{hero}, you are the ghost hunter. Ghosts wake people up, invite them in, and trick them. Only the right particle and pronoun position can break the spell.",
        "master": "You are the ghosts and the scared family. Sentences with the wrong pronoun position make the ghost stronger."},
    12: {"emoji": "📰", "name": "Breaking News",
        "story": "{hero}, you are the star reporter. There was a break-in, a mix-up, and a big breakthrough today. Your headlines will make you famous.",
        "master": "You are the news editor and the people you interview."},
    13: {"emoji": "🐉", "name": "Dragon Diplomat",
        "story": "{hero}, a dragon speaks only in riddles where words have double meanings. Understand the metaphors and the dragon will become your ally.",
        "master": "You are the ancient dragon who speaks in literal and metaphorical meanings."},
    14: {"emoji": "📜", "name": "The Legend of {hero}",
        "story": "A bard is writing the epic legend of {hero}. Tell your adventures in every tense, full of phrasal verbs, and become a legend.",
        "master": "You are the bard who asks about the hero's past, present and future adventures."},
    15: {"emoji": "👑", "name": "The Final Trial",
        "story": "{hero}, the Council of Masters will test everything you learned. Speak casually to the crowd and formally to the Council. Win, and you become a Master of English.",
        "master": "You are the Council (formal) and the excited crowd (casual). This is the final boss battle."},
}

# The 5 levels of every game (Mon-Fri).
DAYS = [
    {"day": 1, "name": "Level 1", "title": "Training", "what": "Learn the week's grammar inside the story, one small rule at a time."},
    {"day": 2, "name": "Level 2", "title": "Speed challenge", "what": "Fast prompts: answer quickly with the right form. Every right answer gives XP."},
    {"day": 3, "name": "Level 3", "title": "Phrasal verb quest", "what": "Each phrasal verb is a key to the next room. They go to your flashcards."},
    {"day": 4, "name": "Level 4", "title": "Your legend", "what": "Mix the game with your real life: answer as yourself, using the week's grammar."},
    {"day": 5, "name": "Level 5", "title": "Boss battle", "what": "10 questions against the boss, with earlier weeks too. 3 hearts. Win the badge!"},
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


def game(wn, hero="Hero"):
    g = GAMES.get(wn)
    if not g:
        return None
    return {**g, "name": g["name"].format(hero=hero), "story": g["story"].format(hero=hero)}


def lesson_prompt(lesson_id, hero="Hero"):
    wn, dn = parse_id(lesson_id)
    w = week(wn)
    g = game(wn, hero)
    if not w or not g or not 1 <= dn <= 5:
        return ""
    grammar = "; ".join(w["grammar"])
    pv = ", ".join(w["phrasal"])
    words = ", ".join(w["words"])
    earlier = [p for x in WEEKS if x["week"] < wn for p in x["phrasal"]][-12:]
    head = (
        f" This is a SPOKEN ADVENTURE GAME on a phone call. Game: '{g['name']}'. Story: {g['story']} "
        f"You are the game master: {g['master']} The learner is the HERO, called {hero}. Make them feel brave and "
        "important, describe the scene in one vivid sentence, and keep the story moving. "
        f"The game secretly trains this grammar: {grammar}. Phrasal verbs: {pv}. "
        + (f"Useful words: {words}. " if words else "")
        + "Every challenge must make the hero SPEAK using that grammar. "
        "If the hero makes a mistake with the grammar, the story reacts (a door stays locked, the suspect laughs), "
        "you say the correct sentence once, and give them another try. "
        "SCORING: at the very end of every reply, after the hero answered a challenge, add exactly one tag: "
        "[XP+10] for a correct answer, [XP+5] for almost correct, or [MISS] for wrong. "
        "Do not add a tag in your first message. Never explain the tags. "
        "Your first message sets the scene in two short sentences and gives the first challenge."
    )
    tasks = {
        1: " LEVEL 1 - TRAINING: a mentor character teaches the rules one by one inside the story: one rule in one "
        "simple sentence with an example from the story, then a challenge where the hero must use it. After two good "
        "answers, the next rule. End with: 'Training complete, hero!'",
        2: " LEVEL 2 - SPEED CHALLENGE: a countdown game. Each turn give ONE quick prompt from the story (a subject + a "
        "verb, 'make it negative', 'turn it into a question', 'change the time'). The hero answers, you react in a few "
        "words and give the next prompt at once. Every 5 prompts announce the combo.",
        3: " LEVEL 3 - PHRASAL VERB QUEST: each phrasal verb is a magic key. For each one: a 2-sentence scene that uses it, "
        "the hero guesses what it means, then the hero must say a sentence with it to open the door to the next room.",
        4: " LEVEL 4 - YOUR LEGEND: the characters ask the hero about their REAL life (work, family, plans, memories) "
        "as if it were part of the legend. Questions need this week's grammar. Every few turns, ask them to use a "
        "specific phrasal verb of the week.",
        5: " LEVEL 5 - BOSS BATTLE: the main villain or judge attacks with 10 questions: 6 on this week, 4 on earlier "
        "phrasal verbs" + (f" ({', '.join(earlier)})" if earlier else "") + ". The hero has 3 hearts; each [MISS] costs a "
        "heart. Describe each hit dramatically. After question 10, announce victory (or a heroic defeat) and the 2 "
        "things to train more.",
    }
    return head + tasks[dn]
