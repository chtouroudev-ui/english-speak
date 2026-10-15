import { useEffect, useState } from 'react'
import { api, type Scenario, type Topic } from '../lib/api'
import { useSettings, type Settings } from '../lib/settings'
import { Conversation } from '../components/Conversation'
import { History, type SessionRow } from '../components/History'
import { Icon } from '../components/ui'

const MODES = [
  { id: 'free', label: 'Free talk' },
  { id: 'roleplay', label: 'Role-play' },
  { id: 'topic', label: 'Topic of the day' },
  { id: 'debate', label: 'Debate' },
  { id: 'job', label: 'My job' },
]

export function Talk({ goalBanner }: { goalBanner?: string | null }) {
  const { settings, update } = useSettings()
  const [mode, setMode] = useState('free')
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [topic, setTopic] = useState<Topic | null>(null)
  const [scenarioId, setScenarioId] = useState('job-interview')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [opened, setOpened] = useState<number | null>(null)

  const openFromHistory = (r: SessionRow) => {
    setHistoryOpen(false)
    if (r.mode === 'roleplay' && r.scenario) setScenarioId(r.scenario)
    setMode(MODES.some((m) => m.id === r.mode) ? r.mode : 'free')
    setOpened(r.id)
  }

  useEffect(() => {
    api<{ scenarios: Scenario[]; topic: Topic }>('/api/content').then((c) => {
      setScenarios(c.scenarios)
      setTopic(c.topic)
    })
  }, [])

  const header = (
    <div className="space-y-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      {goalBanner && <div className="rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200">{goalBanner}</div>}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button className="chip flex items-center gap-1" onClick={() => setHistoryOpen(true)}><Icon name="book" className="h-4 w-4" /> History</button>
        {MODES.map((m) => (
          <button key={m.id} className={`chip ${mode === m.id ? 'chip-on' : ''}`} onClick={() => { setOpened(null); setMode(m.id) }}>{m.label}</button>
        ))}
      </div>
      {mode === 'roleplay' && (
        <select className="input" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
          {scenarios.map((s) => <option key={s.id} value={s.id}>{s.title} (you are {s.you})</option>)}
        </select>
      )}
      {mode === 'topic' && topic && (
        <div className="text-sm">
          <b>{topic.topic}:</b> {topic.question}
          <div className="mt-1 flex flex-wrap gap-1">{topic.words.map((w) => <span key={w} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{w}</span>)}</div>
        </div>
      )}
      {mode === 'job' && !settings?.job && <p className="text-xs text-slate-500">Tip: write your job in Settings so the practice fits your work.</p>}
      {settings && (
        <div className="flex flex-wrap gap-2 text-xs">
          <label className="flex items-center gap-1">Level
            <select className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800" value={settings.level} onChange={(e) => update({ level: e.target.value as Settings['level'] })}>
              {['A2', 'B1', 'B2', 'C1'].map((l) => <option key={l}>{l}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">Corrections
            <select className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800" value={settings.correction_style} onChange={(e) => update({ correction_style: e.target.value as Settings['correction_style'] })}>
              <option value="big">Big mistakes only</option>
              <option value="all">Every mistake</option>
              <option value="off">Off, just talk</option>
            </select>
          </label>
        </div>
      )}
    </div>
  )

  const auto = mode !== 'free'
  const sKey = `talk:${mode}${mode === 'roleplay' ? ':' + scenarioId : ''}`
  return (
    <>
      <Conversation
        key={`${sKey}-${opened ?? ''}`}
        mode={mode}
        scenarioId={mode === 'roleplay' ? scenarioId : undefined}
        autoStart={auto}
        header={header}
        storageKey={sKey}
        openSessionId={opened}
      />
      {historyOpen && <History onOpen={openFromHistory} onClose={() => setHistoryOpen(false)} />}
    </>
  )
}
