import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { speaker } from '../lib/tts'
import { useVoice, type VoiceResult } from '../lib/voice'
import { MicButton } from './MicButton'
import { ErrorBox, Icon, Spinner } from './ui'

type Q =
  | { type: 'choice'; kind: 'fix' | 'meaning' | 'gap'; prompt: string; options: string[]; answer: number; explain?: string; say?: string; door?: string; tag?: string }
  | { type: 'order'; kind: 'order'; prompt: string; answer: string; tag?: string }
  | { type: 'write'; kind: 'write'; prompt: string; answer: string; tag?: string }
  | { type: 'speak'; kind: 'speak'; prompt: string; answer: string; tag?: string }
type LevelData = { week: number; level: number; title: string; goal: string; questions: Q[]; boss: string; emoji: string }
type Game = { emoji: string; name: string; story: string }

const SPEED_SECONDS = 60
const HEARTS: Record<number, number> = { 3: 3, 5: 3 }
const THEME: Record<number, string> = {
  1: 'from-sky-600 to-indigo-600',
  2: 'from-amber-500 to-orange-600',
  3: 'from-emerald-600 to-teal-600',
  4: 'from-fuchsia-600 to-purple-600',
  5: 'from-rose-600 to-red-700',
}
const PRAISE = ['Great!', 'Yes!', 'Perfect!', 'Boom!', 'Nice one!', 'Brilliant!', 'You got it!']

const norm = (s: string) => s.toLowerCase().replace(/[’]/g, "'").replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
function isRight(input: string, answer: string) {
  const got = norm(input)
  if (!got) return false
  const alts = answer.split(/\s+\/\s+/).map(norm).concat(norm(answer))
  return alts.some((a) => a && (a === got || a.replace(/^(the|a|an) /, '') === got))
}

let ctx: AudioContext | null = null
function beep(ok: boolean) {
  try {
    ctx = ctx || new AudioContext()
    const notes = ok ? [660, 880] : [220, 160]
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator()
      const g = ctx!.createGain()
      o.frequency.value = f
      o.type = ok ? 'triangle' : 'sawtooth'
      g.gain.setValueAtTime(0.08, ctx!.currentTime + i * 0.1)
      g.gain.exponentialRampToValueAtTime(0.001, ctx!.currentTime + i * 0.1 + 0.15)
      o.connect(g).connect(ctx!.destination)
      o.start(ctx!.currentTime + i * 0.1)
      o.stop(ctx!.currentTime + i * 0.1 + 0.16)
    })
  } catch {
    /* no sound, fine */
  }
}

function starsFor(level: number, correct: number, total: number, alive: boolean) {
  if (!alive) return 0
  if (level === 2) return correct >= 14 ? 3 : correct >= 9 ? 2 : correct >= 4 ? 1 : 0
  const r = total ? correct / total : 0
  return r >= 0.9 ? 3 : r >= 0.7 ? 2 : r >= 0.4 ? 1 : 0
}

/** One offline game level. Everything runs in the browser; no AI call. */
export function Quest({ lessonId, game, hero, onExit, onNext }: {
  lessonId: string
  game: Game
  hero: string
  onExit: () => void
  onNext?: () => void
}) {
  const [data, setData] = useState<LevelData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [idx, setIdx] = useState(0)
  const [hearts, setHearts] = useState(3)
  const [xp, setXp] = useState(0)
  const [combo, setCombo] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [result, setResult] = useState<null | { ok: boolean; gain: number }>(null)
  const [missed, setMissed] = useState<{ q: string; a: string }[]>([])
  const [timeLeft, setTimeLeft] = useState(SPEED_SECONDS)
  const [saved, setSaved] = useState<number | null>(null)
  const [hitKey, setHitKey] = useState(0)

  const lv = data?.level ?? 0
  const qs = data?.questions ?? []
  const speed = lv === 2
  const q: Q | undefined = speed ? qs[idx % Math.max(1, qs.length)] : qs[idx]
  const maxHearts = HEARTS[lv] ?? 0

  useEffect(() => {
    setData(null)
    api<LevelData>(`/api/course/level/${lessonId}`).then(setData, (e) => setError(String(e)))
  }, [lessonId, round])

  const start = () => {
    setPhase('play'); setIdx(0); setHearts(3); setXp(0); setCombo(0); setCorrect(0); setAnswered(0)
    setResult(null); setMissed([]); setTimeLeft(SPEED_SECONDS); setSaved(null)
  }

  const finish = useCallback(async (finalCorrect: number, finalAnswered: number, alive: boolean, finalXp: number) => {
    setPhase('end')
    speaker.stop()
    const total = speed ? finalAnswered : qs.length
    const s = starsFor(lv, finalCorrect, total, alive)
    setSaved(s)
    if (s > 0) {
      try {
        await api(`/api/course/${lessonId}/score`, { method: 'POST', json: { xp: finalXp, stars: s } })
      } catch (e) {
        setError(String(e))
      }
    }
  }, [lessonId, lv, qs.length, speed])

  // Speed challenge clock.
  const stateRef = useRef({ correct, answered, xp })
  stateRef.current = { correct, answered, xp }
  useEffect(() => {
    if (!speed || phase !== 'play') return
    if (timeLeft <= 0) {
      const s = stateRef.current
      finish(s.correct, s.answered, true, s.xp)
      return
    }
    const t = setTimeout(() => setTimeLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [speed, phase, timeLeft, finish])

  /** Called once per question with the result. */
  const answer = (ok: boolean, skipped = false) => {
    if (result || !q) return
    const newCombo = ok ? combo + 1 : 0
    const gain = ok && !skipped ? (speed ? 10 * (1 + Math.floor(newCombo / 3)) : 10 + (newCombo >= 3 ? 5 : 0)) : 0
    const c = correct + (ok ? 1 : 0)
    const a = answered + 1
    const h = !ok && !skipped && maxHearts ? hearts - 1 : hearts
    if (!skipped) beep(ok)
    if (ok) setHitKey((k) => k + 1)
    setCombo(newCombo); setXp((x) => x + gain); setCorrect(c); setAnswered(a); setHearts(h)
    if (!ok && !skipped) setMissed((m) => [...m, { q: q.prompt, a: q.type === 'choice' ? q.options[q.answer] : q.answer }])
    setResult({ ok, gain })
    if (speed) {
      setTimeout(() => { setResult(null); setIdx((i) => i + 1) }, ok ? 350 : 1100)
    } else if (maxHearts && h <= 0) {
      setTimeout(() => finish(c, a, false, xp + gain), 1200)
    }
  }

  const next = () => {
    setResult(null)
    if (idx + 1 >= qs.length) finish(correct, answered, true, xp)
    else setIdx(idx + 1)
  }

  if (error && !data) return <div className="p-4"><ErrorBox msg={error} /><button className="btn-ghost mt-3" onClick={onExit}>← Map</button></div>
  if (!data) return <div className="p-6"><Spinner /></div>

  const theme = THEME[lv]
  const [bossEmoji, ...bossName] = (data.boss || '👹 Boss').split(' ')
  const progress = speed ? timeLeft / SPEED_SECONDS : idx / qs.length

  const top = (
    <div className={`bg-gradient-to-br ${theme} px-4 pt-3 pb-4 text-white`}>
      <div className="flex items-center gap-2">
        <button className="rounded-lg bg-white/15 px-2 py-1 text-xs" onClick={() => { speaker.stop(); onExit() }}>← Map</button>
        <span className="text-xl">{game.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{game.name}</div>
          <div className="truncate text-xs text-white/80">Level {lv}: {data.title}</div>
        </div>
        {phase === 'play' && <div className="text-right text-sm font-bold">⚡ {xp} XP</div>}
      </div>
      {phase === 'play' && (
        <>
          <div className="mt-3 flex items-center gap-3 text-sm">
            {maxHearts > 0 && <span>{Array.from({ length: maxHearts }, (_, i) => (i < hearts ? '❤️' : '🖤')).join('')}</span>}
            {speed && <span className={`font-mono text-lg font-bold ${timeLeft <= 10 ? 'animate-pulse text-yellow-200' : ''}`}>⏱ {timeLeft}s</span>}
            {combo >= 2 && <span key={combo} className="anim-pop rounded-full bg-yellow-300 px-2 text-xs font-bold text-amber-900">🔥 x{combo} combo</span>}
            <span className="ml-auto text-xs text-white/80">{speed ? `${correct} right` : `${Math.min(idx + 1, qs.length)} / ${qs.length}`}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-yellow-300 transition-all duration-500" style={{ width: `${progress * 100}%` }} />
          </div>
        </>
      )}
    </div>
  )

  if (phase === 'intro') {
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        {top}
        <div className="mx-auto w-full max-w-md flex-1 space-y-4 p-6 text-center">
          <div className="anim-pop text-7xl">{lv === 5 ? bossEmoji : game.emoji}</div>
          {lv === 5 && <div className="text-lg font-bold text-rose-600">{bossName.join(' ')} attacks!</div>}
          <h1 className="text-2xl font-bold">Level {lv}: {data.title}</h1>
          <p className="italic text-slate-600 dark:text-slate-300">“{game.story}”</p>
          <p className="rounded-2xl bg-slate-100 p-3 text-sm dark:bg-slate-800">🎯 {data.goal}</p>
          <button className={`btn w-full !py-3 bg-gradient-to-r ${theme} text-base text-white`} onClick={start}>▶ Start, {hero}!</button>
        </div>
      </div>
    )
  }

  if (phase === 'end') {
    const s = saved ?? 0
    const won = s > 0
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        {top}
        <div className="mx-auto w-full max-w-md flex-1 space-y-4 p-6 text-center">
          <div className="anim-pop text-7xl">{won ? (lv === 5 ? '🏆' : '🎉') : lv === 5 ? bossEmoji : '💪'}</div>
          <h1 className="text-2xl font-bold">
            {won ? (lv === 5 ? `${hero} defeated ${bossName.join(' ')}!` : 'Level complete!') : lv === 5 || hearts <= 0 ? 'Defeated… but heroes rise again!' : 'Almost! Try again'}
          </h1>
          <div className="text-4xl">{[0, 1, 2].map((i) => <span key={i} className={i < s ? '' : 'opacity-20 grayscale'}>⭐</span>)}</div>
          <div className="flex justify-center gap-6 text-sm">
            <div><div className="text-2xl font-bold">{xp}</div>XP</div>
            <div><div className="text-2xl font-bold">{correct}/{speed ? answered : qs.length}</div>right</div>
          </div>
          {missed.length > 0 && (
            <div className="space-y-1 rounded-2xl bg-slate-100 p-3 text-left text-sm dark:bg-slate-800">
              <div className="font-semibold">Learn from these:</div>
              {missed.slice(0, 8).map((m, i) => (
                <div key={i} className="flex items-start gap-1">
                  <button onClick={() => speaker.speak(m.a)} aria-label="Listen" className="pt-0.5 text-indigo-600"><Icon name="play" className="h-4 w-4" /></button>
                  <div><span className="text-slate-500">{m.q}</span> → <b>{m.a}</b></div>
                </div>
              ))}
            </div>
          )}
          <ErrorBox msg={error} onClose={() => setError(null)} />
          <div className="flex flex-col gap-2">
            {won && onNext && <button className={`btn !py-3 bg-gradient-to-r ${theme} text-base text-white`} onClick={onNext}>Next level →</button>}
            <button className="btn-ghost !py-3" onClick={() => { setPhase('intro'); setRound((r) => r + 1) }}>↻ Play again</button>
            <button className="btn-ghost" onClick={onExit}>Back to map</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {top}
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 p-4">
        {lv === 5 && (
          <div className="flex items-center gap-3">
            <span key={hitKey} className={`text-5xl ${hitKey ? 'anim-hit' : ''}`}>{bossEmoji}</span>
            <div className="flex-1">
              <div className="text-xs font-semibold text-rose-600">{bossName.join(' ')}</div>
              <div className="h-3 overflow-hidden rounded-full bg-rose-100 dark:bg-rose-950">
                <div className="h-full rounded-full bg-rose-500 transition-all duration-500" style={{ width: `${100 * (1 - correct / qs.length)}%` }} />
              </div>
            </div>
          </div>
        )}
        {q && 'door' in q && q.door && <div className="text-center text-sm font-semibold text-emerald-700 dark:text-emerald-400">🚪 The door of “{q.door}”</div>}
        {q?.tag && <div className="text-center text-xs font-bold uppercase tracking-wide text-rose-600">{q.tag}</div>}
        {q && <Question key={`${round}-${idx}`} q={q} result={result} onAnswer={answer} />}
        {result && (
          <div className={`relative rounded-2xl p-3 text-center ${result.ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'anim-shake bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'}`}>
            {result.ok && result.gain > 0 && <span className="anim-float absolute -top-2 right-4 font-bold text-amber-500">+{result.gain} XP</span>}
            <div className="font-bold">{result.ok ? PRAISE[(idx + correct) % PRAISE.length] : lv === 5 ? `${bossName.join(' ')} hits you!` : 'Not this time'}</div>
            {q && !result.ok && <div className="text-sm">Answer: <b>{q.type === 'choice' ? q.options[q.answer] : q.answer}</b></div>}
            {q?.type === 'choice' && q.explain && !speed && <div className="mt-1 text-sm opacity-80">{q.explain}</div>}
            {q?.type === 'choice' && q.say && !speed && (
              <button className="btn-ghost btn-small mt-2" onClick={() => speaker.speak(q.say!)}><Icon name="play" className="h-3 w-3" /> Listen</button>
            )}
          </div>
        )}
        {result && !speed && !(maxHearts && hearts <= 0) && (
          <button className={`btn w-full !py-3 bg-gradient-to-r ${theme} text-base text-white`} onClick={next} autoFocus>
            {idx + 1 >= qs.length ? 'Finish' : 'Next →'}
          </button>
        )}
      </div>
    </div>
  )
}

function Question({ q, result, onAnswer }: { q: Q; result: { ok: boolean } | null; onAnswer: (ok: boolean, skipped?: boolean) => void }) {
  if (q.type === 'choice') return <Choice q={q} locked={!!result} onAnswer={onAnswer} />
  if (q.type === 'order') return <Order q={q} locked={!!result} onAnswer={onAnswer} />
  if (q.type === 'write') return <Write q={q} locked={!!result} onAnswer={onAnswer} />
  return <Speak q={q} locked={!!result} onAnswer={onAnswer} />
}

const HINT: Record<string, string> = {
  fix: 'Tap the correct sentence',
  meaning: 'Choose the meaning',
  gap: 'Which phrasal verb fits the gap? (the tense can change)',
}

function Choice({ q, locked, onAnswer }: { q: Extract<Q, { type: 'choice' }>; locked: boolean; onAnswer: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{HINT[q.kind]}</div>
      {q.kind !== 'fix' && <div className="text-xl font-semibold leading-snug">{q.prompt}</div>}
      <div className="grid gap-2">
        {q.options.map((o, i) => {
          const state = picked === null ? '' : i === q.answer ? 'bg-emerald-500 text-white ring-emerald-500' : i === picked ? 'bg-red-500 text-white ring-red-500' : 'opacity-50'
          return (
            <button
              key={i}
              disabled={locked}
              onClick={() => { setPicked(i); onAnswer(i === q.answer) }}
              className={`rounded-2xl bg-white p-3 text-left ring-1 ring-slate-200 transition active:scale-[0.98] dark:bg-slate-900 dark:ring-slate-700 ${state}`}
            >
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{'ABCD'[i]}</span>
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Order({ q, locked, onAnswer }: { q: Extract<Q, { type: 'order' }>; locked: boolean; onAnswer: (ok: boolean) => void }) {
  const words = useMemo(() => {
    const w = q.answer.split(' ').map((t, i) => ({ t, i }))
    for (let k = w.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1))
      ;[w[k], w[j]] = [w[j], w[k]]
    }
    if (w.map((x) => x.t).join(' ') === q.answer && w.length > 1) w.push(w.shift()!)
    return w
  }, [q.answer])
  const [chosen, setChosen] = useState<number[]>([])
  const built = chosen.map((i) => words[i].t).join(' ')

  useEffect(() => {
    if (!locked && chosen.length === words.length) onAnswer(norm(built) === norm(q.answer))
  }, [chosen.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{q.prompt}: tap the words in order</div>
      <div className="flex min-h-14 flex-wrap gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 p-2 dark:border-slate-700">
        {chosen.map((i) => (
          <button key={i} disabled={locked} onClick={() => setChosen((c) => c.filter((x) => x !== i))} className="anim-pop rounded-xl bg-indigo-600 px-3 py-1.5 text-white">
            {words[i].t}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {words.map((w, i) => (
          <button key={i} disabled={locked || chosen.includes(i)} onClick={() => setChosen((c) => [...c, i])} className={`rounded-xl bg-white px-3 py-1.5 ring-1 ring-slate-300 transition dark:bg-slate-900 dark:ring-slate-700 ${chosen.includes(i) ? 'invisible' : ''}`}>
            {w.t}
          </button>
        ))}
      </div>
      {!locked && chosen.length > 0 && <button className="btn-ghost btn-small" onClick={() => setChosen([])}>Clear</button>}
    </div>
  )
}

function Write({ q, locked, onAnswer }: { q: Extract<Q, { type: 'write' }>; locked: boolean; onAnswer: (ok: boolean) => void }) {
  const [text, setText] = useState('')
  const [unsure, setUnsure] = useState(false)
  const check = () => {
    if (isRight(text, q.answer)) onAnswer(true)
    else setUnsure(true)
  }
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Write the answer</div>
      <div className="text-xl font-semibold leading-snug">{q.prompt}</div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim() && !unsure) check() }}>
        <input className="input !text-base" value={text} onChange={(e) => setText(e.target.value)} disabled={locked || unsure} autoFocus autoCapitalize="off" placeholder="Your answer" />
        {!unsure && <button className="btn-primary" disabled={!text.trim() || locked}>Check</button>}
      </form>
      {unsure && !locked && (
        <div className="space-y-2 rounded-2xl bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <div>The answer is: <b>{q.answer}</b></div>
          <div>Was your answer the same?</div>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={() => onAnswer(true)}>Yes, I had it</button>
            <button className="btn-ghost flex-1" onClick={() => onAnswer(false)}>No</button>
          </div>
        </div>
      )}
    </div>
  )
}

type WordResult = { word: string; status: 'ok' | 'unclear' | 'wrong' | 'missed' }
const COLORS: Record<WordResult['status'], string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  unclear: 'bg-amber-200/70 dark:bg-amber-500/30',
  wrong: 'bg-red-200/70 dark:bg-red-500/30',
  missed: 'text-slate-400 line-through',
}

function Speak({ q, locked, onAnswer }: { q: Extract<Q, { type: 'speak' }>; locked: boolean; onAnswer: (ok: boolean, skipped?: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [words, setWords] = useState<WordResult[] | null>(null)
  const [score, setScore] = useState<number | null>(null)

  const onResult = async (r: VoiceResult) => {
    if (!r.blob) return
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('audio', r.blob, r.blob.type.includes('mp4') ? 'a.mp4' : 'a.webm')
      fd.append('target', q.answer)
      const c = await api<{ words: WordResult[]; score: number }>('/api/practice/check', { method: 'POST', body: fd })
      setWords(c.words)
      setScore(c.score)
      if (c.score >= 70) onAnswer(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const voice = useVoice({ engine: 'server', rawOnly: true, onResult, onError: setError })

  return (
    <div className="space-y-3 text-center">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{q.prompt}</div>
      <p className="text-2xl font-semibold leading-snug">
        {words ? words.map((w, i) => <span key={i} className={`rounded px-0.5 ${COLORS[w.status]}`}>{w.word} </span>) : q.answer}
      </p>
      <button className="btn-ghost btn-small" onClick={() => speaker.speak(q.answer)}><Icon name="play" className="h-4 w-4" /> Listen first</button>
      {!locked && (
        <>
          <div className="flex justify-center"><MicButton recording={voice.recording} busy={busy} onClick={voice.toggle} level={voice.level} /></div>
          {score !== null && score < 70 && <div className="text-sm text-amber-700 dark:text-amber-400">Score {score}%. Try again! (70% to pass)</div>}
          <ErrorBox msg={error} onClose={() => setError(null)} />
          <div className="flex justify-center gap-2">
            {score !== null && score < 70 && <button className="btn-ghost btn-small" onClick={() => onAnswer(false, true)}>Next</button>}
            <button className="btn-ghost btn-small" onClick={() => onAnswer(true, true)}>I said it, but I can't use the mic now</button>
          </div>
        </>
      )}
    </div>
  )
}
