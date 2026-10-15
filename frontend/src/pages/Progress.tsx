import { useEffect, useState } from 'react'
import { api, type Summary } from '../lib/api'
import { SummaryModal } from '../components/Conversation'
import { Icon, Spinner } from '../components/ui'

export type Stats = {
  days: { day: string; minutes: number }[]
  today_minutes: number
  goal_minutes: number
  streak: number
  total_minutes: number
  sessions: number
  words: number
  mistakes: number
  cards: number
  cards_due: number
  weekly: { week: string; words: number; mistakes: number; mistakes_per_100: number | null; conf: number | null }[]
  pronunciation: { week: string; word_score: number; sound_score: number | null; attempts: number }[]
}
type SessionRow = { id: number; started_at: string; mode: string; scenario: string | null; turns: number; summary: string | null }

export const tzOffset = () => -new Date().getTimezoneOffset()

function Bars({ data, unit, color = 'bg-indigo-500', goal }: { data: { label: string; value: number | null }[]; unit: string; color?: string; goal?: number }) {
  const max = Math.max(goal || 0, ...data.map((d) => d.value || 0), 1)
  return (
    <div>
      <div className="relative flex h-32 items-end gap-[3px]">
        {goal ? <div className="absolute inset-x-0 border-t border-dashed border-emerald-500" style={{ bottom: `${(goal / max) * 100}%` }} title={`goal: ${goal} ${unit}`} /> : null}
        {data.map((d, i) => (
          <div key={i} className="group relative max-w-10 flex-1">
            <div className={`w-full rounded-t ${d.value ? color : 'bg-slate-200 dark:bg-slate-800'}`} style={{ height: `${Math.max(2, ((d.value || 0) / max) * 128)}px` }} />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
              {d.label}: {d.value ?? '-'} {unit}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{data[0]?.label}</span><span>{data[data.length - 1]?.label}</span></div>
    </div>
  )
}

export function Progress() {
  const [s, setS] = useState<Stats | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [open, setOpen] = useState<Summary | null>(null)

  useEffect(() => {
    api<Stats>(`/api/stats?tz=${tzOffset()}`).then(setS)
    api<SessionRow[]>('/api/sessions').then(setSessions)
  }, [])

  if (!s) return <div className="p-6"><Spinner /></div>
  const pct = Math.min(100, Math.round((s.today_minutes / Math.max(1, s.goal_minutes)) * 100))

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card col-span-2">
          <div className="label">Today</div>
          <div className="flex items-baseline gap-2"><span className="text-3xl font-bold">{s.today_minutes}</span><span className="text-slate-500">/ {s.goal_minutes} min</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1 text-xs text-slate-500">{pct >= 100 ? 'Goal done! 🎉' : 'Keep going, you can do it.'}</p>
        </div>
        <div className="card"><div className="label">Streak</div><div className="flex items-center gap-1 text-3xl font-bold"><Icon name="flame" className="h-7 w-7 text-orange-500" />{s.streak}</div><div className="text-xs text-slate-500">days in a row</div></div>
        <div className="card"><div className="label">Total</div><div className="text-3xl font-bold">{s.total_minutes}</div><div className="text-xs text-slate-500">minutes · {s.sessions} talks</div></div>
      </div>

      <div className="card">
        <div className="label">Minutes spoken, last 30 days</div>
        <Bars data={s.days.map((d) => ({ label: d.day.slice(5), value: d.minutes }))} unit="min" goal={s.goal_minutes} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="label">Mistakes per 100 words (lower is better)</div>
          {s.weekly.length ? <Bars data={s.weekly.map((w) => ({ label: `week ${w.week.slice(5)}`, value: w.mistakes_per_100 }))} unit="per 100 words" color="bg-amber-500" /> : <p className="text-sm text-slate-500">No data yet.</p>}
        </div>
        <div className="card">
          <div className="label">Pronunciation score (higher is better)</div>
          {s.pronunciation.length ? <Bars data={s.pronunciation.map((w) => ({ label: `week ${w.week.slice(5)}`, value: w.word_score }))} unit="/ 100" color="bg-emerald-500" /> : <p className="text-sm text-slate-500">Do some “Repeat after me” practice to see this.</p>}
          {s.weekly.some((w) => w.conf !== null) && <p className="mt-2 text-xs text-slate-500">Clear speech in conversations this week: {s.weekly[s.weekly.length - 1]?.conf ?? '-'}%</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="card"><div className="text-2xl font-bold">{s.words}</div><div className="text-xs text-slate-500">words spoken</div></div>
        <div className="card"><div className="text-2xl font-bold">{s.mistakes}</div><div className="text-xs text-slate-500">corrections</div></div>
        <div className="card"><div className="text-2xl font-bold">{s.cards}</div><div className="text-xs text-slate-500">flashcards ({s.cards_due} due)</div></div>
      </div>

      <div className="card">
        <div className="label">Past talks</div>
        {!sessions.length && <p className="text-sm text-slate-500">No talks yet.</p>}
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {sessions.map((x) => (
            <li key={x.id} className="flex items-center justify-between py-2 text-sm">
              <span>{new Date(x.started_at.replace(' ', 'T') + 'Z').toLocaleString()} · {x.scenario || x.mode} · {x.turns} turns</span>
              {x.summary && <button className="btn-ghost btn-small" onClick={() => setOpen(JSON.parse(x.summary!))}>Summary</button>}
            </li>
          ))}
        </ul>
      </div>
      {open && <SummaryModal summary={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
