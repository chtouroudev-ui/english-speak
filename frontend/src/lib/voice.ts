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
  fd.append('audio', blob, blob.type.includes('wav') ? 'audio.wav' : blob.type.includes('mp4') ? 'audio.mp4' : 'audio.webm')
  return api<Transcript>('/api/stt', { method: 'POST', body: fd })
}

/** Mono PCM chunks -> 16 kHz 16-bit WAV (small upload, and Whisper works at 16 kHz anyway). */
function toWav(chunks: Float32Array[], rate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const step = rate / 16000
  const n = Math.floor(total / step)
  const out = new Int16Array(n)
  const all = new Float32Array(total)
  let o = 0
  for (const c of chunks) { all.set(c, o); o += c.length }
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * step)
    const b = Math.max(a + 1, Math.floor((i + 1) * step))
    let sum = 0
    for (let k = a; k < b && k < total; k++) sum += all[k]
    const v = Math.max(-1, Math.min(1, sum / (b - a)))
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff
  }
  const buf = new ArrayBuffer(44 + out.byteLength)
  const d = new DataView(buf)
  const str = (off: number, t: string) => { for (let i = 0; i < t.length; i++) d.setUint8(off + i, t.charCodeAt(i)) }
  str(0, 'RIFF'); d.setUint32(4, 36 + out.byteLength, true); str(8, 'WAVE'); str(12, 'fmt ')
  d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, 16000, true)
  d.setUint32(28, 32000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); str(36, 'data')
  d.setUint32(40, out.byteLength, true)
  new Int16Array(buf, 44).set(out)
  return new Blob([buf], { type: 'audio/wav' })
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

  /** Send a finished recording: raw to the caller, or transcribed. */
  const deliver = useCallback(async (blob: Blob, duration: number) => {
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
    await deliver(blob, duration)
  }, [deliver])

  // Hands-free: the mic is always captured into memory. When you start to speak, the last
  // second before it is kept too, so the first word is never cut. After 1.2 s of silence the
  // clip is sent, without the silent tail (silence makes Whisper invent words like "Thank you").
  const hf = useRef<{ capturing: boolean; finish: (() => void) | null }>({ capturing: false, finish: null })
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
        const rate = ctx.sampleRate
        const src = ctx.createMediaStreamSource(stream)
        const an = ctx.createAnalyser()
        an.fftSize = 1024
        src.connect(an)
        // Raw samples (ScriptProcessor is old but works everywhere, also on iPhone).
        const proc = ctx.createScriptProcessor(2048, 1, 1)
        const mute = ctx.createGain()
        mute.gain.value = 0
        src.connect(proc)
        proc.connect(mute).connect(ctx.destination)
        const PRE = rate * 1.0
        let pre: Float32Array[] = []
        let preLen = 0
        let clip: Float32Array[] = []
        proc.onaudioprocess = (e) => {
          const x = new Float32Array(e.inputBuffer.getChannelData(0))
          if (hf.current.capturing) {
            clip.push(x)
          } else {
            pre.push(x)
            preLen += x.length
            while (preLen - pre[0].length > PRE) preLen -= pre.shift()!.length
          }
        }
        let capStart = 0
        const begin = () => {
          clip = pre
          pre = []
          preLen = 0
          capStart = performance.now()
          hf.current.capturing = true
          speaker.stop()
          setRecording(true)
        }
        const end = (silentMs: number) => {
          hf.current.capturing = false
          setRecording(false)
          const keep = clip.reduce((n, c) => n + c.length, 0) - Math.max(0, silentMs - 300) / 1000 * rate
          const out: Float32Array[] = []
          let n = 0
          for (const c of clip) {
            if (n >= keep) break
            const part = n + c.length > keep ? c.subarray(0, Math.max(0, Math.floor(keep - n))) : c
            out.push(part)
            n += part.length
          }
          clip = []
          const seconds = n / rate
          if (seconds < 0.5 || performance.now() - capStart < 300) return
          deliver(toWav(out, rate), seconds)
        }
        hf.current.finish = () => end(0)
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
          if (speaker.speaking || busyRef.current || optsRef.current.paused || rec.current) {
            loud = quiet = 0
            if (hf.current.capturing && !rec.current) {
              hf.current.capturing = false
              clip = []
              setRecording(false)
            }
            return
          }
          if (!hf.current.capturing) {
            loud = rms > threshold ? loud + 50 : 0
            if (loud >= 150) {
              loud = 0
              begin()
            }
          } else {
            quiet = rms < threshold ? quiet + 50 : 0
            if (quiet >= 1200) {
              end(quiet)
              quiet = 0
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
      hf.current.capturing = false
      hf.current.finish = null
      ctx?.close()
      if (rec.current) stop()
    }
  }, [opts.handsFree, deliver, stop])

  const toggle = () => {
    if (hf.current.capturing && hf.current.finish) return hf.current.finish()
    return rec.current ? stop() : start()
  }

  return { start, stop, recording, busy, level, toggle }
}
