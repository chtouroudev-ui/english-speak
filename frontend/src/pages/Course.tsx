import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useSettings } from '../lib/settings'
import { speaker } from '../lib/tts'
import { Conversation } from '../components/Conversation'
import { Spinner } from '../components/ui'

type Week = { week: number; title: string; grammar: string[]; words: string[]; phrasal: string[]; book: string }
type Phase = { n: number; title: string; weeks: number[]; goal: string }
type Day = { day: number; name: string; title: string; what: string }
type Game = { emoji: string; name: string; story: string }
type CourseData = {
  phases: Phase[]; weeks: Week[]; days: Day[]; games: Record<number, Game>
  done: Record<string, { done_at: string; xp: number }>; current: string | null; hero: string; total_xp: number
}

const lessonId = (w: number, d: number) => `w${w}d${d}`
const RANKS: [number, string][] = [[0, 'Rookie'], [200, 'Adventurer'], [600, 'Hero'], [1200, 'Champion'], [2000, 'Legend'], [3000, 'Master of English']]
const rankOf = (xp: number) => {
  let i = 0
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++
  return { name: RANKS[i][1], next: RANKS[i + 1]?.[0], from: RANKS[i][0] }
}
const stars = (xp = 0) => Math.min(3, Math.floor(xp / 20))

/** The 15-week plan as 15 hero games, 5 levels each (Mon–Fri). */
export function Course() {
  const { settings, update } = useSettings()
  const [data, setData] = useState<CourseData | null>(null)
  const [openWeek, setOpenWeek] = useState<number | null>(null)
  const [lesson, setLesson] = useState<{ week: Week; day: Day } | null>(null)
  const [name, setName] = useState('')

  const load = useCallback(() => {
    api<CourseData>('/api/course').then((d) => {
      setData(d)
      setOpenWeek((w) => w ?? (d.current ? Number(/^w(\d+)/.exec(d.current)![1]) : 15))
    })
  }, [])
  useEffect(load, [load, settings?.hero_name])

  if (!data || !settings) return <div className="p-6"><Spinner /></div>

  if (!settings.hero_name) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6 text-center">
        <div className="text-6xl">🦸</div>
        <h1 className="text-2xl font-bold">Every hero needs a name</h1>
        <p className="text-slate-500">15 adventures are waiting for you. In each one, you are the hero, and your voice is your power.</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) update({ hero_name: name.trim() }) }}>
          <input className="input" placeholder="Your hero name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <button className="btn-primary" disabled={!name.trim()}>Go!</button>
        </form>
      </div>
    )
  }

  if (lesson) {
    const id = lessonId(lesson.week.week, lesson.day.day)
    const g = data.games[lesson.week.week]
    return (
      <Conversation
        key={id}
        mode="course"
        scenarioId={id}
        autoStart
        game
        storageKey={`course:${id}`}
        onEnded={load}
        header={
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <button className="btn-ghost btn-small" onClick={() => { speaker.stop(); setLesson(null); load() }}>← Map</button>
            <span className="text-2xl">{g.emoji}</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{g.name}</div>
              <div className="truncate text-xs text-slate-500">{lesson.day.name}: {lesson.day.title} · {lesson.week.title}</div>
            </div>
          </div>
        }
      />
    )
  }

  const rank = rankOf(data.total_xp)
  const badges = data.weeks.filter((w) => data.days.every((d) => data.done[lessonId(w.week, d.day)]))

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-10">
      <div className="card bg-gradient-to-br from-indigo-600 to-violet-600 text-white !ring-0">
        <div className="flex items-center gap-3">
          <div className="text-5xl">🦸</div>
          <div className="flex-1">
            <div className="text-xl font-bold">{data.hero}</div>
            <div className="text-sm text-indigo-100">{rank.name} · {data.total_xp} XP</div>
          </div>
        </div>
        {rank.next && (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-amber-300" style={{ width: `${(100 * (data.total_xp - rank.from)) / (rank.next - rank.from)}%` }} />
            </div>
            <div className="mt-1 text-xs text-indigo-100">{rank.next - data.total_xp} XP to {rankOf(rank.next).name}</div>
          </>
        )}
        <div className="mt-3 flex flex-wrap gap-1 text-2xl" title="Badges: finish all 5 levels of a game">
          {data.weeks.map((w) => <span key={w.week} className={badges.includes(w) ? '' : 'opacity-25 grayscale'}>{data.games[w.week].emoji}</span>)}
        </div>
      </div>

      {data.phases.map((p) => (
        <section key={p.n} className="space-y-2">
          <div className="px-1">
            <h2 className="font-semibold">World {p.n}: {p.title}</h2>
            <p className="text-xs text-slate-500">{p.goal}</p>
          </div>
          {p.weeks.map((wn) => {
            const w = data.weeks.find((x) => x.week === wn)!
            const g = data.games[wn]
            const wDone = data.days.filter((d) => data.done[lessonId(wn, d.day)]).length
            const open = openWeek === wn
            return (
              <div key={wn} className="card !p-0 overflow-hidden">
                <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpenWeek(open ? null : wn)}>
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-3xl ${wDone === 5 ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>{g.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{g.name}</span>
                    <span className="block truncate text-xs text-slate-500">Week {wn} · {w.title} · {wDone}/5 levels</span>
                  </span>
                  <span className="text-slate-400">{open ? '▲' : '▼'}</span>
                </button>
                {open && (
                  <div className="space-y-4 border-t border-slate-200 p-4 dark:border-slate-800">
                    <p className="italic text-slate-700 dark:text-slate-200">“{g.story}”</p>
                    <div className="flex flex-col gap-2">
                      {data.days.map((d, i) => {
                        const id = lessonId(wn, d.day)
                        const res = data.done[id]
                        const isNext = data.current === id
                        return (
                          <button key={d.day} onClick={() => setLesson({ week: w, day: d })} className={`flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition active:scale-[0.98] ${isNext ? 'bg-indigo-600 text-white ring-indigo-600' : res ? 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900' : 'ring-slate-200 dark:ring-slate-800'}`} style={{ marginLeft: `${[0, 24, 48, 24, 0][i]}px` }}>
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${isNext ? 'bg-white text-indigo-700' : res ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{d.day === 5 ? '👹' : d.day}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold">{d.title}{isNext ? ' · play now' : ''}</span>
                              <span className={`block text-xs ${isNext ? 'text-indigo-100' : 'text-slate-500'}`}>{d.what}</span>
                            </span>
                            {res && <span className="text-sm">{'⭐'.repeat(stars(res.xp)) || '✓'}</span>}
                          </button>
                        )
                      })}
                    </div>
                    <details className="text-sm">
                      <summary className="cursor-pointer text-slate-500">What this game trains</summary>
                      <ul className="mt-2 list-disc space-y-1 pl-5">{w.grammar.map((x) => <li key={x}>{x}</li>)}</ul>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {w.phrasal.map((v) => <button key={v} className="rounded-lg bg-amber-100 px-2 py-1 dark:bg-amber-900/40" onClick={() => speaker.speak(v)}>{v}</button>)}
                      </div>
                      <p className="mt-2 text-xs text-slate-500">📄 In your files: {w.book}</p>
                    </details>
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}
      <p className="px-1 text-xs text-slate-400">A level is complete when you hang up after at least 4 answers. Play again any time to beat your best score.</p>
    </div>
  )
}
