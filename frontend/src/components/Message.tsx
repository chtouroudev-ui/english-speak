import { useState } from 'react'
import { api, type Correction, type Transcript } from '../lib/api'
import { speaker } from '../lib/tts'
import { TappableText } from './WordPopup'
import { Icon, Spinner } from './ui'

export type Msg = {
  key: string
  role: 'user' | 'assistant'
  text: string
  id?: number
  image?: string
  speech?: Transcript
  audioUrl?: string | null
  correction?: Correction | null
  correcting?: boolean
  streaming?: boolean
}

export function Message({ m, onWord, slowSpeed }: { m: Msg; onWord: (w: string) => void; slowSpeed: number }) {
  const [translation, setTranslation] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const [savedCard, setSavedCard] = useState(false)

  const translate = async () => {
    if (translation !== null) return setTranslation(null)
    setTranslating(true)
    try {
      const r = await api<{ translation: string }>('/api/translate', { method: 'POST', json: { text: m.text } })
      setTranslation(r.translation)
    } finally {
      setTranslating(false)
    }
  }

  if (m.role === 'assistant') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[88%] space-y-2">
          <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <TappableText text={m.text} onWord={onWord} />
            {m.streaming && <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-indigo-500 align-middle" />}
            {translation && <p className="mt-2 border-t border-slate-200 pt-2 text-sm text-slate-500 dark:border-slate-700">{translation}</p>}
          </div>
          {!m.streaming && (
            <div className="flex gap-1">
              <button className="btn-ghost btn-small" onClick={() => speaker.speak(m.text)}><Icon name="play" className="h-3.5 w-3.5" /> Repeat</button>
              <button className="btn-ghost btn-small" onClick={() => speaker.speak(m.text, slowSpeed)}><Icon name="slow" className="h-3.5 w-3.5" /> Slow</button>
              <button className="btn-ghost btn-small" onClick={translate}>{translating ? <Spinner className="h-3 w-3" /> : <Icon name="translate" className="h-3.5 w-3.5" />} Translate</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const unclear = new Set<number>()
  if (m.speech?.words?.length) {
    // Only mark words when the transcript and the word list line up.
    const real = m.speech.words.filter((w) => w.word.trim())
    if (real.length === m.text.split(/\s+/).filter(Boolean).length) real.forEach((w, i) => w.prob < 0.6 && unclear.add(i))
  }
  const c = m.correction
  const s = m.speech
  const saveSentence = async () => {
    if (!c?.corrected) return
    await api('/api/cards', { method: 'POST', json: { kind: 'sentence', front: c.corrected, back: m.text, example: c.mistakes.map((x) => x.why).filter(Boolean).join(' ') } })
    setSavedCard(true)
  }

  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] space-y-2">
        <div className="rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-3 text-white shadow-sm">
          {m.image && <img src={m.image} alt="" className="mb-2 max-h-48 rounded-xl" />}
          <TappableText text={m.text} onWord={onWord} unclear={unclear} />
        </div>
        {(s || m.audioUrl) && (
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-slate-500">
            {s && s.wpm > 0 && <span title="Words per minute. Natural speech is about 120 to 150.">{s.wpm} words/min</span>}
            {s && s.pauses.length > 0 && <span title={s.pauses.map((p) => `${p.seconds}s after “${p.after}”`).join(', ')}>{s.pauses.length} long pause{s.pauses.length > 1 ? 's' : ''}</span>}
            {s && s.fillers > 0 && <span>{s.fillers} “uh/um”</span>}
            {unclear.size > 0 && <span className="text-amber-600">{unclear.size} unclear word{unclear.size > 1 ? 's' : ''}</span>}
            {m.audioUrl && <button className="btn-ghost btn-small" onClick={() => speaker.playUrl(m.audioUrl!)}><Icon name="ear" className="h-3.5 w-3.5" /> Me</button>}
          </div>
        )}
        {m.correcting && <div className="flex items-center justify-end gap-2 text-xs text-slate-500"><Spinner className="h-3 w-3" /> Checking…</div>}
        {c && !c.ok && c.mistakes.length > 0 && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900">
            {c.corrected && (
              <p className="mb-1">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Better: </span>
                {c.corrected}
                <button className="ml-2 align-middle text-slate-500" onClick={() => speaker.speak(c.corrected)} aria-label="Listen"><Icon name="play" className="inline h-3.5 w-3.5" /></button>
              </p>
            )}
            <ul className="space-y-0.5 text-slate-700 dark:text-slate-300">
              {c.mistakes.map((x, i) => (
                <li key={i}>
                  <span className="text-red-600 line-through dark:text-red-400">{x.wrong}</span> → <span className="font-medium text-emerald-700 dark:text-emerald-400">{x.right}</span>
                  {x.why && <span className="text-slate-500"> · {x.why}</span>}
                </li>
              ))}
            </ul>
            <button className="btn-ghost btn-small mt-2" onClick={saveSentence} disabled={savedCard}><Icon name="save" className="h-3.5 w-3.5" /> {savedCard ? 'Added to flashcards' : 'Add to flashcards'}</button>
          </div>
        )}
        {c && c.ok && <div className="text-right text-xs text-emerald-600">✓ Good sentence</div>}
      </div>
    </div>
  )
}
