import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { speaker } from '../lib/tts'
import { Conversation } from '../components/Conversation'
import { Icon, Spinner } from '../components/ui'

type Week = { week: number; title: string; grammar: string[]; words: string[]; phrasal: string[]; book: string }
type Phase = { n: number; title: string; weeks: number[]; goal: string }
type Day = { day: number; name: string; title: string; what: string }
type CourseData = { phases: Phase[]; weeks: Week[]; days: Day[]; done: Record<string, { done_at: string; session_id: number | null }>; current: string | null }

const lessonId = (w: number, d: number) => `w${w}d${d}`

/** The 15-week semester plan as daily speaking calls (Mon–Fri). */
export function Course() {
  const [data, setData] = useState<CourseData | null>(null)
  const [openWeek, setOpenWeek] = useState<number | null>(null)
  const [lesson, setLesson] = useState<{ week: Week; day: Day } | null>(null)

  const load = useCallback(() => {
    api<CourseData>('/api/course').then((d) => {
      setData(d)
      setOpenWeek((w) => w ?? (d.current ? Number(/^w(\d+)/.exec(d.current)![1]) : 15))
    })
  }, [])
  useEffect(load, [load])

  if (!data) return <div className="p-6"><Spinner /></div>

  if (lesson) {
    const id = lessonId(lesson.week.week, lesson.day.day)
    return (
      <Conversation
        key={id}
        mode="course"
        scenarioId={id}
        autoStart
        storageKey={`course:${id}`}
        onEnded={load}
        header={
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <button className="btn-ghost btn-small" onClick={() => { speaker.stop(); setLesson(null); load() }}>← Course</button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Week {lesson.week.week} · {lesson.day.name}: {lesson.day.title}</div>
              <div className="truncate text-xs text-slate-500">{lesson.week.title}</div>
            </div>
          </div>
        }
      />
    )
  }

  const doneCount = Object.keys(data.done).length
  const total = data.weeks.length * data.days.length

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-10">
      <div className="card">
        <h1 className="text-xl font-semibold">My 15-week plan</h1>
        <p className="text-sm text-slate-500">Not a classic course: every lesson is a phone call. You learn the rule by using it, out loud, about your own life. About 15 minutes a day, Monday to Friday.</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(100 * doneCount) / total}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-500">{doneCount} of {total} lessons done</p>
      </div>

      {data.phases.map((p) => (
        <section key={p.n} className="space-y-2">
          <div className="px-1">
            <h2 className="font-semibold">Phase {p.n}: {p.title}</h2>
            <p className="text-xs text-slate-500">{p.goal}</p>
          </div>
          {p.weeks.map((wn) => {
            const w = data.weeks.find((x) => x.week === wn)!
            const wDone = data.days.filter((d) => data.done[lessonId(wn, d.day)]).length
            const open = openWeek === wn
            return (
              <div key={wn} className="card !p-0 overflow-hidden">
                <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpenWeek(open ? null : wn)}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${wDone === 5 ? 'bg-emerald-500 text-white' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'}`}>{wDone === 5 ? '✓' : wn}</span>
                  <span className="flex-1">
                    <span className="block font-medium">Week {wn}: {w.title}</span>
                    <span className="text-xs text-slate-500">{wDone}/5 lessons</span>
                  </span>
                  <span className="text-slate-400">{open ? '▲' : '▼'}</span>
                </button>
                {open && (
                  <div className="space-y-4 border-t border-slate-200 p-4 dark:border-slate-800">
                    <div>
                      <div className="label">Grammar</div>
                      <ul className="list-disc space-y-1 pl-5 text-sm">{w.grammar.map((g) => <li key={g}>{g}</li>)}</ul>
                    </div>
                    <div>
                      <div className="label">Phrasal verbs (tap to hear)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {w.phrasal.map((v) => <button key={v} className="rounded-lg bg-amber-100 px-2 py-1 text-sm dark:bg-amber-900/40" onClick={() => speaker.speak(v)}>{v}</button>)}
                      </div>
                    </div>
                    {w.words.length > 0 && (
                      <div>
                        <div className="label">Useful words</div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{w.words.join(' · ')}</p>
                      </div>
                    )}
                    <p className="text-xs text-slate-500">📄 In your files: {w.book}</p>
                    <div className="grid gap-2 sm:grid-cols-5">
                      {data.days.map((d) => {
                        const id = lessonId(wn, d.day)
                        const isDone = !!data.done[id]
                        const isNext = data.current === id
                        return (
                          <button key={d.day} onClick={() => setLesson({ week: w, day: d })} className={`rounded-xl p-3 text-left ring-1 transition active:scale-95 ${isNext ? 'bg-indigo-600 text-white ring-indigo-600' : isDone ? 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900' : 'ring-slate-200 dark:ring-slate-800'}`} title={d.what}>
                            <div className="text-xs opacity-70">{d.name}{isDone ? ' ✓' : ''}</div>
                            <div className="text-sm font-medium">{d.title}</div>
                            {isNext && <div className="mt-1 flex items-center gap-1 text-xs"><Icon name="play" className="h-3 w-3" /> Today</div>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}
      <p className="px-1 text-xs text-slate-400">A lesson is marked done when you hang up after at least 4 answers.</p>
    </div>
  )
}
