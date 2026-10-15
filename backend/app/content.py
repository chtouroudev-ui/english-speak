"""Ready-made scenarios, topics and practice sentences (no model call needed)."""
import datetime

SCENARIOS = [
    {"id": "job-interview", "title": "Job interview", "you": "a candidate", "ai": "a friendly interviewer for a software developer job", "start": "Hello, thanks for coming in today. Can you tell me a little about yourself?"},
    {"id": "restaurant", "title": "Ordering at a restaurant", "you": "a customer", "ai": "a waiter in a busy restaurant", "start": "Good evening! Welcome. Are you ready to order, or do you need a few more minutes?"},
    {"id": "airport", "title": "At the airport", "you": "a traveller checking in", "ai": "an airline check-in agent", "start": "Hi there, where are you flying to today? Can I see your passport, please?"},
    {"id": "doctor", "title": "Calling a doctor", "you": "a patient calling the clinic", "ai": "a clinic receptionist", "start": "Good morning, City Health Clinic. How can I help you?"},
    {"id": "client", "title": "Meeting a client", "you": "a developer presenting a project", "ai": "a client who wants a new website", "start": "Nice to meet you. So, tell me, how can your team help my business?"},
    {"id": "small-talk", "title": "Small talk with a colleague", "you": "a new colleague", "ai": "a friendly colleague at the coffee machine", "start": "Hey! You're new here, right? How's your first week going?"},
    {"id": "hotel", "title": "Hotel check-in", "you": "a hotel guest", "ai": "a hotel receptionist", "start": "Good afternoon, welcome to the Grand Hotel. Do you have a reservation?"},
    {"id": "shopping", "title": "Returning a product", "you": "a customer with a broken product", "ai": "a shop assistant", "start": "Hi, how can I help you today?"},
    {"id": "standup", "title": "Daily stand-up meeting", "you": "a developer in the team", "ai": "a scrum master running the daily stand-up", "start": "Good morning everyone. Let's start. What did you work on yesterday?"},
    {"id": "explain-code", "title": "Explaining your code", "you": "a developer", "ai": "a senior developer reviewing your pull request", "start": "I'm looking at your pull request now. Can you walk me through what this change does?"},
    {"id": "directions", "title": "Asking for directions", "you": "a tourist", "ai": "a local person in London", "start": "You look a bit lost. Can I help you find something?"},
    {"id": "landlord", "title": "Talking to a landlord", "you": "a tenant", "ai": "a landlord", "start": "Hello, you called about a problem in the apartment?"},
]

TOPICS = [
    {"topic": "Travel", "question": "What is the best trip you have ever taken?", "words": ["destination", "itinerary", "sightseeing", "to book a flight", "jet lag", "souvenir"]},
    {"topic": "Food", "question": "What is a typical dish from your country, and how do you make it?", "words": ["ingredients", "recipe", "spicy", "to bake", "flavour", "leftovers"]},
    {"topic": "Work", "question": "What do you like most about your job?", "words": ["deadline", "colleague", "to be in charge of", "workload", "remote work", "promotion"]},
    {"topic": "Technology", "question": "Which app or tool could you not live without?", "words": ["device", "to download", "user-friendly", "update", "privacy", "to rely on"]},
    {"topic": "Health", "question": "What do you do to stay healthy?", "words": ["to work out", "balanced diet", "to get enough sleep", "stress", "routine", "to cut down on"]},
    {"topic": "Hobbies", "question": "What do you do in your free time?", "words": ["to be into something", "to take up", "spare time", "relaxing", "skill", "passionate"]},
    {"topic": "Family", "question": "Tell me about someone in your family you admire.", "words": ["to get along with", "to look up to", "relatives", "to raise", "close", "generation"]},
    {"topic": "Movies and series", "question": "What is the last series you watched? Did you like it?", "words": ["plot", "episode", "character", "to recommend", "ending", "binge-watch"]},
    {"topic": "Learning", "question": "How do you learn new things best?", "words": ["to practise", "to improve", "mistake", "progress", "motivation", "to give up"]},
    {"topic": "City life", "question": "Do you prefer living in a city or in the countryside? Why?", "words": ["crowded", "traffic jam", "neighbourhood", "peaceful", "commute", "facilities"]},
    {"topic": "Money", "question": "Are you a saver or a spender?", "words": ["to save up", "budget", "to afford", "expensive", "bargain", "to waste money"]},
    {"topic": "The future", "question": "Where do you see yourself in five years?", "words": ["goal", "to achieve", "ambitious", "to plan", "career", "to look forward to"]},
    {"topic": "Weather and seasons", "question": "What is your favourite season and why?", "words": ["chilly", "humid", "heatwave", "forecast", "to pour with rain", "mild"]},
    {"topic": "Sport", "question": "Do you play or watch any sport?", "words": ["team", "to score", "match", "fan", "competitive", "to train"]},
]

PRACTICE_SENTENCES = {
    "A2": [
        "I usually wake up at seven o'clock.",
        "She went to the market yesterday.",
        "Can I have a glass of water, please?",
        "We are going to the beach this weekend.",
        "My brother works in a big hospital.",
        "There are three bedrooms in my house.",
        "I think it will rain this afternoon.",
        "What time does the train leave?",
    ],
    "B1": [
        "I have been learning English for three years.",
        "If I had more time, I would travel around the world.",
        "The weather was so bad that we stayed at home.",
        "Could you tell me where the nearest station is?",
        "I'm thinking about changing my job next year.",
        "She told me that she had already finished the project.",
        "Three thin thieves thought about the theatre.",
        "We should have booked the tickets earlier.",
    ],
    "B2": [
        "Despite the heavy traffic, we managed to arrive on time.",
        "I would rather work from home than commute every day.",
        "The results were not as good as we had expected.",
        "Had I known about the meeting, I would have prepared better.",
        "It's worth considering the long-term consequences of this decision.",
        "The thoroughly thought-through theory was eventually accepted.",
        "Whether or not we agree, we need to reach a decision today.",
        "She's been working on the same problem for weeks.",
    ],
    "C1": [
        "Notwithstanding the setbacks, the team delivered a remarkable product.",
        "It's hardly surprising that the proposal met with considerable resistance.",
        "The particularly rural regulations were reluctantly reviewed.",
        "Were it not for her persistence, the project would have collapsed.",
        "I can't help thinking that we've overlooked something crucial.",
        "The architecture is deliberately designed to accommodate future growth.",
    ],
}


def topic_of_day(day: datetime.date | None = None):
    day = day or datetime.date.today()
    return TOPICS[day.toordinal() % len(TOPICS)]


def scenario(sid):
    return next((s for s in SCENARIOS if s["id"] == sid), None)
