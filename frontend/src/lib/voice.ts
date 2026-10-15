import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type Transcript, type Word } from './api'
import { speaker } from './tts'
import type { Settings } from './settings'

export type VoiceResult = Transcript & { blob: Blob | null; audioUrl: string | null }

function pickMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  return types.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || ''
}

let sharedStream: MediaStream | null = null
async function micStream() {
  if (sharedStream && sharedStream.getTracks().some((t) => t.readyState === 'live')) return sharedStream
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('The microphone needs HTTPS (or localhost). Open the app with https://')
  }
  sharedStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
  return sharedStream
}

const FILLERS = new Set(['uh', 'um', 'umm', 'er', 'erm', 'hmm', 'ah'])
function textStats(text: string, duration: number): Transcript {
  const words: Word[] = text.split(/\s+/).filter(Boolean).map((w) => ({ word: w, prob: 1 }))
  const real = words.filter((w) => !FILLERS.has(w.word.toLowerCase().replace(/[^a-z]/g, '')))
  return {
    text,
    words,
    duration,
    wpm: duration > 0 ? Math.round(real.length / (duration / 60)) : 0,
    pauses: [],
    fillers: words.length - real.length,
    word_count: real.length,
    avg_confidence: null,
  }
}

// ---- in-browser Whisper (proposal 11), loaded only if chosen ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let whisperPipe: Promise<any> | null = null
async function browserWhisper(blob: Blob): Promise<Transcript> {
  if (!whisperPipe) {
    const url = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2'
    whisperPipe = import(/* @vite-ignore */ url).then((t) =>
      t.pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en'),
    )
  }
  const pipe = await whisperPipe
  const ctx = new AudioContext({ sampleRate: 16000 })
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
  await ctx.close()
  const out = await pipe(buf.getChannelData(0))
  return textStats(String(out.text || '').trim(), buf.duration)
}

// ---- browser speech recognition (proposal 12) ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

export async function transcribeBlob(blob: Blob, engine: Settings['stt_engine']): Promise<Transcript> {
  if (engine === 'browser-whisper') return browserWhisper(blob)
  const fd = new FormData()
  fd.append('audio', blob, blob.type.includes('mp4') ? 'audio.mp4' : 'audio.webm')
  return api<Transcript>('/api/stt', { method: 'POST', body: fd })
}

type Opts = {
  engine: Settings['stt_engine']
  handsFree?: boolean
  onResult: (r: VoiceResult) => void
  onError?: (msg: string) => void
  /** If set, return the raw recording without transcribing (the caller sends it to the server). */
  rawOnly?: boolean
  /** Hands-free mode does not start listening while this is true (e.g. the AI is still writing). */
  paused?: boolean
}

/** Push-to-talk recording, plus hands-free mode with simple voice activity detection (proposal 43). */
export function useVoice(opts: Opts) {
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [level, setLevel] = useState(0)
  const optsRef = useRef(opts)
  optsRef.current = opts
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const startedAt = useRef(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recog = useRef<any>(null)
  const recogText = useRef('')
  const busyRef = useRef(false)
  busyRef.current = busy

  const start = useCallback(async () => {
    if (rec.current) return
    try {
      speaker.stop()
      const stream = await micStream()
      const mime = pickMime()
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      r.start()
      rec.current = r
      startedAt.current = performance.now()
      if (optsRef.current.engine === 'browser-native' && SR && !optsRef.current.rawOnly) {
        const sr = new SR()
        sr.lang = 'en-US'
        sr.continuous = true
        sr.interimResults = false
        recogText.current = ''
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sr.onresult = (e: any) => {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) recogText.current += ' ' + e.results[i][0].transcript
          }
        }
        sr.start()
        recog.current = sr
      }
      setRecording(true)
    } catch (e) {
      optsRef.current.onError?.(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const stop = useCallback(async () => {
    const r = rec.current
    if (!r) return
    rec.current = null
    setRecording(false)
    const duration = (performance.now() - startedAt.current) / 1000
    const blob = await new Promise<Blob>((resolve) => {
      r.onstop = () => resolve(new Blob(chunks.current, { type: r.mimeType || 'audio/webm' }))
      r.stop()
    })
    if (duration < 0.4) return
    const audioUrl = URL.createObjectURL(blob)
    const o = optsRef.current
    if (o.rawOnly) {
      o.onResult({ ...textStats('', duration), blob, audioUrl })
      return
    }
    setBusy(true)
    try {
      let t: Transcript
      if (recog.current) {
        const sr = recog.current
        recog.current = null
        await new Promise<void>((resolve) => {
          sr.onend = () => resolve()
          sr.stop()
          setTimeout(resolve, 1500)
        })
        t = textStats(recogText.current.trim(), duration)
      } else {
        t = await transcribeBlob(blob, o.engine === 'browser-native' ? 'server' : o.engine)
      }
      if (t.text.trim()) o.onResult({ ...t, blob, audioUrl })
      else o.onError?.("I didn't hear anything. Try again, a bit louder.")
    } catch (e) {
      o.onError?.(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  // Hands-free: listen to the mic level, start when you speak, stop after 1.2 s of silence.
  useEffect(() => {
    if (!opts.handsFree) return
    let alive = true
    let ctx: AudioContext | null = null
    let timer = 0
    ;(async () => {
      try {
        const stream = await micStream()
        if (!alive) return
        ctx = new AudioContext()
        const src = ctx.createMediaStreamSource(stream)
        const an = ctx.createAnalyser()
        an.fftSize = 1024
        src.connect(an)
        const data = new Float32Array(an.fftSize)
        let floor = 0.01
        let loud = 0
        let quiet = 0
        const t0 = performance.now()
        timer = window.setInterval(() => {
          an.getFloatTimeDomainData(data)
          let sum = 0
          for (const v of data) sum += v * v
          const rms = Math.sqrt(sum / data.length)
          setLevel(rms)
          if (performance.now() - t0 < 600) {
            floor = Math.max(floor, rms)
            return
          }
          const threshold = Math.max(0.02, floor * 2.5)
          if (speaker.speaking || busyRef.current || optsRef.current.paused) {
            loud = quiet = 0
            return
          }
          if (!rec.current) {
            loud = rms > threshold ? loud + 50 : 0
            if (loud >= 150) {
              loud = 0
              start()
            }
          } else {
            quiet = rms < threshold ? quiet + 50 : 0
            if (quiet >= 1200) {
              quiet = 0
              stop()
            }
          }
        }, 50)
      } catch (e) {
        optsRef.current.onError?.(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      alive = false
      clearInterval(timer)
      ctx?.close()
      if (rec.current) stop()
    }
  }, [opts.handsFree, start, stop])

  return { start, stop, recording, busy, level, toggle: () => (rec.current ? stop() : start()) }
}
