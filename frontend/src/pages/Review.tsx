import { useEffect, useState } from 'react'
import { api, type Card } from '../lib/api'
import { speaker } from '../lib/tts'
import { Icon, Segmented, Spinner } from '../components/ui'

type Tab = 'cards' | 'mistakes' | 'words'
type MistakeRow = { id: number; wrong: string; right: string; type: string; why: string; sentence: string; corrected: string; created_at: string }

export function Review() {
  const [tab, setTab] = useState<Tab>('cards')
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { value: 'cards', label: 'Flashcards' },
        { value: 'mistakes', label: 'My mistakes' },
        { value: 'words', label: 'My words' },
      ]} />
      {tab === 'cards' && <Flashcards />}
      {tab === 'mistakes' && <Mistakes />}
      {tab === 'words' && <Words />}
    </div>
  )
}

/** Spaced repetition (proposal 33). */
function Flashcards() {
  const [due, setDue] = useState<Card[] | null>(null)
  const [flipped, setFlipped] = useState(false)
  const load = () => api<Card[]>('/api/cards/due').then(setDue)
  useEffect(() => { load() }, [])
  if (!due) return <Spinner />
  if (!due.length) return <div className="card text-center text-slate-500">No cards to review now 🎉<br /><span className="text-sm">Save words and corrected sentences while you talk, and they will come back here.</span></div>
  const c = due[0]
  const grade = async (g: number) => {
    await api(`/api/cards/${c.id}/review`, { method: 'POST', json: { grade: g } })
    setFlipped(false)
    setDue(due.slice(1))
    if (due.length === 1) load()
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">{due.length} card{due.length > 1 ? 's' : ''} to review. Say it out loud before you flip!</p>
      <button className="card w-full min-h-48 text-center" onClick={() => setFlipped(!flipped)}>
        <div className="label">{c.kind === 'word' ? 'Word' : 'Sentence'}</div>
        <p className="text-2xl font-medium">{c.front}</p>
        {flipped ? (
          <div className="mt-4 space-y-1 border-t border-slate-200 pt-4 dark:border-slate-700">
            {c.back && <p>{c.kind === 'sentence' ? <><span className="text-slate-500">You said: </span><span className="line-through">{c.back}</span></> : c.back}</p>}
            {c.example && <p className="text-sm italic text-slate-500">{c.example}</p>}
          </div>
        ) : <p className="mt-6 text-sm text-slate-400">Tap to flip</p>}
      </button>
      <div className="flex justify-center"><button className="btn-ghost btn-small" onClick={() => speaker.speak(c.front)}><Icon name="play" className="h-4 w-4" /> Listen</button></div>
      {flipped && (
        <div className="grid grid-cols-4 gap-2">
          {['Again', 'Hard', 'Good', 'Easy'].map((l, i) => (
            <button key={l} className={i === 2 ? 'btn-primary' : 'btn-ghost'} onClick={() => grade(i)}>{l}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/** All corrections, grouped by type (proposal 31). */
function Mistakes() {
  const [data, setData] = useState<{ mistakes: MistakeRow[]; by_type: { type: string; n: number }[] } | null>(null)
  const [added, setAdded] = useState<Set<number>>(new Set())
  useEffect(() => { api<typeof data>('/api/mistakes').then(setData) }, [])
  if (!data) return <Spinner />
  if (!data.mistakes.length) return <div className="card text-center text-slate-500">No mistakes saved yet. Start talking!</div>
  return (
    <div className="space-y-3">
      <div className="card">
        <div className="label">Your most common mistakes</div>
        <div className="flex flex-wrap gap-2">
          {data.by_type.map((t) => <span key={t.type} className="rounded-full bg-amber-100 px-3 py-1 text-sm dark:bg-amber-900/40">{t.type} · {t.n}</span>)}
        </div>
      </div>
      {data.mistakes.map((m) => (
        <div key={m.id} className="card text-sm">
          <p><span className="text-red-600 line-through dark:text-red-400">{m.wrong}</span> → <b className="text-emerald-700 dark:text-emerald-400">{m.right}</b> {m.type && <span className="ml-1 rounded bg-slate-100 px-1.5 text-xs dark:bg-slate-800">{m.type}</span>}</p>
          {m.why && <p className="text-slate-500">{m.why}</p>}
          {m.corrected && <p className="mt-1 text-slate-600 dark:text-slate-300">“{m.corrected}”</p>}
          <div className="mt-2 flex gap-2">
            {m.corrected && <button className="btn-ghost btn-small" onClick={() => speaker.speak(m.corrected)}><Icon name="play" className="h-3.5 w-3.5" /> Listen</button>}
            <button className="btn-ghost btn-small" disabled={added.has(m.id)} onClick={async () => {
              await api('/api/cards', { method: 'POST', json: { kind: 'sentence', front: m.corrected || m.right, back: m.sentence, example: m.why } })
              setAdded(new Set(added).add(m.id))
            }}><Icon name="save" className="h-3.5 w-3.5" /> {added.has(m.id) ? 'Added' : 'Add to flashcards'}</button>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Word notebook (proposal 32). */
function Words() {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => api<Card[]>('/api/cards?kind=word').then(setCards)
  useEffect(() => { load() }, [])
  const add = async () => {
    setBusy(true)
    try {
      const info = await api<{ word: string; meaning: string; example: string; translation?: string }>('/api/word', { method: 'POST', json: { text: word } })
      await api('/api/cards', { method: 'POST', json: { kind: 'word', front: info.word || word, back: [info.meaning, info.translation].filter(Boolean).join(' · '), example: info.example } })
      setWord('')
      load()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (word.trim()) add() }}>
        <input className="input" placeholder="Add a word or phrase" value={word} onChange={(e) => setWord(e.target.value)} />
        <button className="btn-primary" disabled={!word.trim() || busy}>{busy ? <Spinner /> : <Icon name="plus" className="h-4 w-4" />}</button>
      </form>
      {!cards ? <Spinner /> : !cards.length ? <div className="card text-center text-slate-500">Tap any word in a conversation to save it here.</div> : cards.map((c) => (
        <div key={c.id} className="card flex items-start gap-3">
          <div className="flex-1">
            <p className="font-semibold">{c.front}</p>
            {c.back && <p className="text-sm">{c.back}</p>}
            {c.example && <p className="text-sm italic text-slate-500">{c.example}</p>}
          </div>
          <button className="btn-ghost btn-small" onClick={() => speaker.speak(c.front)} aria-label="Listen"><Icon name="play" className="h-4 w-4" /></button>
          <button className="btn-ghost btn-small" onClick={async () => { await api(`/api/cards/${c.id}`, { method: 'DELETE' }); load() }} aria-label="Delete"><Icon name="trash" className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  )
}
