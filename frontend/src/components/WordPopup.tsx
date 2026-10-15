import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { speaker } from '../lib/tts'
import { Icon, Modal, Spinner } from './ui'

type Info = { word: string; meaning: string; example: string; translation?: string }

/** Tap a word: see its meaning and save it to the notebook (proposal 32). */
export function WordPopup({ word, onClose }: { word: string; onClose: () => void }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api<Info>('/api/word', { method: 'POST', json: { text: word } })
      .then(setInfo)
      .catch((e) => setErr(e.message))
  }, [word])

  const save = async () => {
    if (!info) return
    await api('/api/cards', {
      method: 'POST',
      json: { kind: 'word', front: info.word || word, back: [info.meaning, info.translation].filter(Boolean).join(' · '), example: info.example },
    })
    setSaved(true)
  }

  return (
    <Modal title={word} onClose={onClose}>
      {!info && !err && <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner /> Looking it up…</div>}
      {err && <p className="text-sm text-red-600">{err}</p>}
      {info && (
        <div className="space-y-3">
          <button className="btn-ghost btn-small" onClick={() => speaker.speak(info.word || word)}><Icon name="play" className="h-4 w-4" /> Listen</button>
          <p>{info.meaning}</p>
          {info.translation && <p className="text-sm text-slate-500">{info.translation}</p>}
          {info.example && <p className="text-sm italic text-slate-600 dark:text-slate-300">“{info.example}”</p>}
          <button className="btn-primary w-full" onClick={save} disabled={saved}>
            <Icon name="save" className="h-4 w-4" /> {saved ? 'Saved to your words' : 'Save to my words'}
          </button>
        </div>
      )}
    </Modal>
  )
}

/** Splits text into tappable words. */
export function TappableText({ text, onWord, unclear }: { text: string; onWord: (w: string) => void; unclear?: Set<number> }) {
  const parts = text.split(/(\s+)/)
  let idx = -1
  return (
    <>
      {parts.map((p, i) => {
        if (/^\s+$/.test(p) || !p) return p
        idx++
        const clean = p.replace(/^[^\p{L}']+|[^\p{L}']+$/gu, '')
        const isUnclear = unclear?.has(idx)
        return (
          <span
            key={i}
            onClick={() => clean && onWord(clean)}
            className={`cursor-pointer rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 ${isUnclear ? 'bg-amber-200/70 underline decoration-amber-500 decoration-wavy dark:bg-amber-500/30' : ''}`}
            title={isUnclear ? 'This word was not clear. Try to say it again.' : undefined}
          >
            {p}
          </span>
        )
      })}
    </>
  )
}
