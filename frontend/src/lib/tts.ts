import type { Settings } from './settings'

type Listener = (speaking: boolean) => void

/** Plays AI text out loud, sentence by sentence, so speech starts before the full answer is written. */
class Speaker {
  private chain: Promise<void> = Promise.resolve()
  private gen = 0
  private pending = 0
  private audio: HTMLAudioElement | null = null
  private listeners = new Set<Listener>()
  settings: Pick<Settings, 'tts_engine' | 'accent' | 'voice_speed'> = { tts_engine: 'piper', accent: 'us', voice_speed: 1 }

  onChange(l: Listener) {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  get speaking() {
    return this.pending > 0
  }
  private emit() {
    this.listeners.forEach((l) => l(this.pending > 0))
  }

  stop() {
    this.gen++
    this.audio?.pause()
    this.audio = null
    if ('speechSynthesis' in window) speechSynthesis.cancel()
    this.chain = Promise.resolve()
    this.pending = 0
    this.emit()
  }

  speak(text: string, speed?: number) {
    const clean = text.replace(/[*_#`]/g, '').trim()
    if (!clean) return
    const gen = this.gen
    const s = { ...this.settings, voice_speed: speed ?? this.settings.voice_speed }
    const audioUrl = s.tts_engine === 'piper' ? this.fetchAudio(clean, s) : Promise.resolve(null)
    this.pending++
    this.emit()
    this.chain = this.chain
      .then(async () => {
        if (gen !== this.gen) return
        const url = await audioUrl
        if (gen !== this.gen) return
        if (url) await this.playUrl(url)
        else await this.browserSpeak(clean, s)
      })
      .catch(() => {})
      .finally(() => {
        if (gen === this.gen) {
          this.pending = Math.max(0, this.pending - 1)
          this.emit()
        }
      })
  }

  /** Feed streamed text; complete sentences are spoken right away. */
  stream() {
    let buf = ''
    return {
      push: (piece: string) => {
        buf += piece
        const re = /^(.+?[.!?]+["')\]]?)\s+/s
        let m
        while ((m = re.exec(buf)) && m[1].length > 1) {
          this.speak(m[1])
          buf = buf.slice(m[0].length)
        }
      },
      end: () => {
        if (buf.trim()) this.speak(buf)
        buf = ''
      },
    }
  }

  private async fetchAudio(text: string, s: Speaker['settings']): Promise<string | null> {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, accent: s.accent, speed: s.voice_speed }),
      })
      if (!res.ok) return null
      return URL.createObjectURL(await res.blob())
    } catch {
      return null
    }
  }

  playUrl(url: string) {
    return new Promise<void>((resolve) => {
      const a = new Audio(url)
      this.audio = a
      a.onended = a.onerror = () => resolve()
      a.play().catch(() => resolve())
    })
  }

  private browserSpeak(text: string, s: Speaker['settings']) {
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) return resolve()
      const u = new SpeechSynthesisUtterance(text)
      const lang = s.accent === 'uk' ? 'en-GB' : 'en-US'
      u.lang = lang
      u.rate = s.voice_speed
      const voice = speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-') === lang)
      if (voice) u.voice = voice
      u.onend = u.onerror = () => resolve()
      speechSynthesis.speak(u)
    })
  }
}

export const speaker = new Speaker()
