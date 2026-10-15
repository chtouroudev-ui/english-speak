import { useState } from 'react'
import { api } from '../lib/api'
import { useSettings } from '../lib/settings'
import { speaker } from '../lib/tts'
import { useVoice, type VoiceResult } from '../lib/voice'
import { MicButton } from './MicButton'
import { ErrorBox, Icon } from './ui'

type WordResult = { word: string; status: 'ok' | 'unclear' | 'wrong' | 'missed'; heard: string; prob?: number }
type Check = {
  words: WordResult[]
  extra: string[]
  score: number
  sound_score: number | null
  word_sounds: { word: string; expected: string; heard: string }[]
  transcript: { text: string; wpm: number; duration: number }
}

const COLORS: Record<WordResult['status'], string> = {
  ok: 'text-emerald-700 dark:text-emerald-400',
  unclear: 'bg-amber-200/70 dark:bg-amber-500/30',
  wrong: 'bg-red-200/70 text-red-800 dark:bg-red-500/30 dark:text-red-200',
  missed: 'text-slate-400 line-through',
}

/** "Repeat after me" with word and sound feedback (proposals 17, 18, 19). */
export function ReadAloud({ target }: { target: string }) {
  const { settings } = useSettings()
  const [check, setCheck] = useState<Check | null>(null)
  const [mine, setMine] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const onResult = async (r: VoiceResult) => {
    if (!r.blob) return
    setMine(r.audioUrl)
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('audio', r.blob, r.blob.type.includes('mp4') ? 'a.mp4' : 'a.webm')
      fd.append('target', target)
      setCheck(await api<Check>('/api/practice/check', { method: 'POST', body: fd }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const voice = useVoice({ engine: 'server', rawOnly: true, onResult, onError: setError })

  const scoreColor = (n: number) => (n >= 85 ? 'text-emerald-600' : n >= 60 ? 'text-amber-600' : 'text-red-600')

  return (
    <div className="space-y-4">
      <div className="card text-center">
        <p className="text-xl leading-relaxed sm:text-2xl">
          {check
            ? check.words.map((w, i) => (
                <span key={i} className={`rounded px-0.5 ${COLORS[w.status]}`} title={w.status === 'wrong' ? `I heard “${w.heard}”` : w.status}>
                  {w.word}{' '}
                </span>
              ))
            : target}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button className="btn-ghost btn-small" onClick={() => speaker.speak(target)}><Icon name="play" className="h-4 w-4" /> Listen</button>
          <button className="btn-ghost btn-small" onClick={() => speaker.speak(target, Math.max(0.6, (settings?.voice_speed || 1) * 0.7))}><Icon name="slow" className="h-4 w-4" /> Slow</button>
          {mine && <button className="btn-ghost btn-small" onClick={() => speaker.playUrl(mine)}><Icon name="ear" className="h-4 w-4" /> Listen to me</button>}
          <button className="btn-ghost btn-small" disabled={saved} onClick={async () => { await api('/api/cards', { method: 'POST', json: { kind: 'sentence', front: target } }); setSaved(true) }}>
            <Icon name="save" className="h-4 w-4" /> {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex justify-center">
        <MicButton recording={voice.recording} busy={busy} onClick={voice.toggle} level={voice.level} />
      </div>
      <ErrorBox msg={error} onClose={() => setError(null)} />

      {check && (
        <div className="card space-y-3">
          <div className="flex justify-around text-center">
            <div><div className={`text-3xl font-bold ${scoreColor(check.score)}`}>{check.score}</div><div className="text-xs text-slate-500">words score</div></div>
            {check.sound_score !== null && <div><div className={`text-3xl font-bold ${scoreColor(check.sound_score)}`}>{check.sound_score}</div><div className="text-xs text-slate-500">sounds score</div></div>}
            <div><div className="text-3xl font-bold">{check.transcript.wpm}</div><div className="text-xs text-slate-500">words/min</div></div>
          </div>
          <p className="text-sm"><span className="text-slate-500">I heard:</span> “{check.transcript.text}”</p>
          {check.word_sounds.length > 0 && (
            <div className="text-sm">
              <div className="label">Sounds to check</div>
              <ul className="space-y-1">
                {check.word_sounds.map((w, i) => (
                  <li key={i}><b>{w.word}</b>: should sound like <code className="rounded bg-emerald-100 px-1 dark:bg-emerald-900/40">/{w.expected}/</code>, you said something like <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">/{w.heard}/</code></li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="text-emerald-700 dark:text-emerald-400">■ good</span>
            <span className="text-amber-600">■ not clear</span>
            <span className="text-red-600">■ wrong word</span>
            <span className="line-through">missed</span>
          </div>
          <p className="text-xs text-slate-400">The sounds score compares the sounds of the sentence with the sounds of what the computer understood. It is a guide, not a perfect test.</p>
        </div>
      )}
    </div>
  )
}
