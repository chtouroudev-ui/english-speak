import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { speaker } from '../lib/tts'
import { ErrorBox, Icon, Spinner } from './ui'

export type Lesson = {
  intro: string
  sections: { title: string; text: string; table?: string[][]; examples?: string[] }[]
  mistakes: { wrong: string; right: string; why: string }[]
  phrasal: { verb: string; meaning: string; example: string }[]
  quiz: { q: string; a: string }[]
  week: { week: number; title: string; book: string }
}

const Say = ({ text }: { text: string }) => (
  <button className="shrink-0 rounded-full p-1 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950" onClick={() => speaker.speak(text)} aria-label="Listen">
    <Icon name="play" className="h-4 w-4" />
  </button>
)

/** The lesson to read before the games. Plain text, no AI. */
export function LessonView({ week, emoji, onDone }: { week: number; emoji: string; onDone: () => void }) {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [shown, setShown] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<Lesson>(`/api/course/lesson/${week}`).then(setLesson, (e) => setError(String(e)))
  }, [week])

  if (error) return <div className="p-4"><ErrorBox msg={error} /></div>
  if (!lesson) return <div className="p-6"><Spinner /></div>

  const finish = async () => {
    setSaving(true)
    try {
      await api(`/api/course/w${week}d0/score`, { method: 'POST', json: { xp: 20, stars: 3 } })
      onDone()
    } catch (e) {
      setError(String(e))
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-10">
      <div className="card bg-gradient-to-br from-sky-600 to-indigo-600 text-white !ring-0">
        <div className="text-sm text-sky-100">📖 Lesson · Week {week}</div>
        <h1 className="text-xl font-bold">{emoji} {lesson.week.title}</h1>
        <p className="mt-2 text-sky-50">{lesson.intro}</p>
      </div>

      {lesson.sections.map((s, i) => (
        <section key={i} className="card space-y-2">
          <h2 className="font-semibold"><span className="mr-2 rounded-full bg-indigo-100 px-2 text-sm text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200">{i + 1}</span>{s.title}</h2>
          <p className="text-slate-700 dark:text-slate-300">{s.text}</p>
          {s.table && (
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr>{s.table[0].map((h) => <th key={h} className="border-b border-slate-200 p-2 text-left font-semibold dark:border-slate-700">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {s.table.slice(1).map((row, r) => (
                    <tr key={r} className="odd:bg-slate-50 dark:odd:bg-slate-800/40">
                      {row.map((c, k) => <td key={k} className="p-2 align-top">{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {s.examples && (
            <ul className="space-y-1">
              {s.examples.map((e) => (
                <li key={e} className="flex items-start gap-1 rounded-xl bg-slate-50 px-2 py-1.5 dark:bg-slate-800/50"><Say text={e} /><span className="pt-0.5">{e}</span></li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="card space-y-2">
        <h2 className="font-semibold">⚠️ Common mistakes</h2>
        {lesson.mistakes.map((m) => (
          <div key={m.wrong} className="rounded-xl bg-slate-50 p-2 text-sm dark:bg-slate-800/50">
            <div className="text-red-600 line-through dark:text-red-400">{m.wrong}</div>
            <div className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">✓ {m.right} <Say text={m.right} /></div>
            <div className="text-xs text-slate-500">{m.why}</div>
          </div>
        ))}
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">🔑 Phrasal verbs of the week</h2>
        <p className="text-xs text-slate-500">They go to your flashcards when you finish the lesson.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {lesson.phrasal.map((p) => (
            <div key={p.verb} className="rounded-xl bg-amber-50 p-2 text-sm ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900">
              <div className="flex items-center gap-1 font-semibold">{p.verb} <Say text={p.verb} /></div>
              <div className="text-slate-600 dark:text-slate-300">{p.meaning}</div>
              <div className="mt-1 flex items-start gap-1 italic text-slate-500"><Say text={p.example} /><span className="pt-0.5">{p.example}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">🧠 Check yourself</h2>
        <p className="text-xs text-slate-500">Think of the answer, then tap to see it.</p>
        {lesson.quiz.map((q, i) => (
          <button key={i} className="block w-full rounded-xl bg-slate-50 p-2 text-left text-sm dark:bg-slate-800/50" onClick={() => setShown((s) => ({ ...s, [i]: !s[i] }))}>
            <div>{q.q}</div>
            <div className={`mt-1 font-semibold ${shown[i] ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}>{shown[i] ? q.a : 'Tap to see the answer'}</div>
          </button>
        ))}
      </section>

      <p className="px-1 text-xs text-slate-500">📄 More in your files: {lesson.week.book}</p>
      <button className="btn-primary w-full !py-3 text-base" onClick={finish} disabled={saving}>
        {saving ? <Spinner /> : '🎮'} I learned it! Start the game
      </button>
    </div>
  )
}
