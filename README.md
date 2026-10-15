# Speak English

A web app (phone and computer) to practise **speaking** English with your own local AI model.
You talk, Whisper turns your voice into text, your model answers, and Piper reads the answer out loud.
Everything runs on one server. Nothing goes to a cloud service.

## What is inside

| Page | What you can do |
|---|---|
| **Talk** | Free talk, role-plays (12 situations), topic of the day, debate, job English. Gentle corrections under each message, words/min, pauses, "uh/um", unclear words in orange, "Help me say it", translate, tap a word to save it, end-of-talk summary. Tap-to-talk or hands-free. |
| **Practice** | "Repeat after me": listen (normal/slow), read aloud, see good / unclear / wrong / missed words, a words score and a sounds score, listen to yourself. |
| **Picture** | Take or choose a photo: describe it, answer questions about it, or read the text in it aloud. Needs a model that can read images. |
| **Review** | Flashcards with spaced repetition, all your mistakes grouped by type, your word notebook. |
| **Progress** | Today vs your daily goal, streak, minutes per day, mistakes per 100 words, pronunciation trend, past talks. |
| **Settings** | Model server (OpenAI-compatible or Ollama), voice, accent, speed, speech engine, level, correction style, your language and job, goal, reminder, dark mode. |

Install it on your phone: open the site, then "Add to Home screen".

## Install on an Ubuntu server (one command)

Made for an Oracle Cloud free server (ARM, 2 CPU, 12 GB RAM), works on any Ubuntu 22.04/24.04.

1. **Oracle Cloud console**: Networking › Virtual Cloud Networks › your VCN › Security Lists › Default ›
   *Add Ingress Rules*: source `0.0.0.0/0`, TCP, destination ports `80,443`.
2. **On the server** (SSH):

   ```bash
   git clone <this repo> english-speak    # or copy the folder to the server
   cd english-speak
   bash deploy/install.sh
   ```

3. Open the address it prints (like `https://1-2-3-4.sslip.io`) and log in with the user and password it prints.

The script installs Docker, adds swap, opens ports 80/443 in the server firewall, gets a free HTTPS
certificate (needed for the microphone), starts the app, and downloads the models.

Options:

```bash
bash deploy/install.sh --domain english.example.com     # your own domain (DNS A record → server IP)
bash deploy/install.sh --model llama3.2:3b               # another chat model
bash deploy/install.sh --vision-model ""                 # no image model (saves RAM and disk)
bash deploy/install.sh --external-llm http://host.docker.internal:11434/v1   # use a model server you already run on this machine
bash deploy/install.sh --password 'my-password'          # choose the password
```

You can also change the model later in the app: **Settings › Model**.

### Models for a 2-CPU server

| Use | Default | Size | Notes |
|---|---|---|---|
| Chat | `qwen2.5:3b` | ~2 GB | about 5–10 words/second on 2 ARM CPUs |
| Pictures | `gemma3:4b` | ~3.3 GB | slower; only used on the Picture page |
| Speech to text | Whisper `base` (int8) | ~150 MB | `small` is more accurate, about 3× slower |
| Voice | Piper `en_US-lessac-medium` / `en_GB-alan-medium` | ~60 MB each | |

7B+ models work but feel slow without a GPU.

## Everyday commands

```bash
cd english-speak
sudo docker compose logs -f app          # see what the app is doing
sudo docker compose restart app
git pull && sudo docker compose up -d --build   # update
sudo docker compose exec ollama ollama pull llama3.2:3b   # add a model
```

Your data (talks, words, progress) is in the Docker volume `appdata` (SQLite file `/data/app.db`).
Backup: `sudo docker compose cp app:/data/app.db ./backup.db`

## Develop on your computer

```bash
# model: any OpenAI-compatible server, e.g. Ollama on localhost:11434
cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
LLM_BASE_URL=http://localhost:11434/v1 uvicorn app.main:app --reload --port 8000
cd frontend && npm install && npm run dev     # http://localhost:5173
```

## How it works

```
phone / browser ──HTTPS──> Caddy (password, certificate) ──> app (FastAPI)
                                                              ├─ Whisper (speech → text, word scores)
                                                              ├─ Piper (text → voice, sounds for scoring)
                                                              ├─ SQLite (talks, mistakes, cards, progress)
                                                              └─> Ollama or any OpenAI-compatible server
```

Notes:
- The **sounds score** compares the sounds (IPA) of the target sentence with the sounds of what Whisper
  understood. It is a cheap guide that fits a small CPU, not a real acoustic phoneme test.
- **Reminders** show when the app is open or installed and you have not reached your daily goal.
- **Browser built-in speech recognition** (Settings) is fast, but in Chrome it sends audio to Google.
