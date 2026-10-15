import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Modal, Spinner } from './ui'

export type SessionRow = { id: number; started_at: string; mode: string; scenario: string | null; turns: number; last_text: string | null; summary: string | null }

const MODE_NAMES: Record<string, string> = {
  free: 'Free talk', roleplay: 'Role-play', topic: 'Topic of the day', debate: 'Debate', job: 'My job', course: 'Course lesson',
  'picture-describe': 'Picture', 'picture-questions': 'Picture',
}

export function modeName(mode: string, scenario: string | null) {
  if (mode === 'course' && scenario) {
    const m = /^w(\d+)d(\d)$/.exec(scenario)
    if (m) return `Week ${m[1]} · ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][Number(m[2]) - 1]}`
  }
  return MODE_NAMES[mode] || mode
}

/** All saved conversations; pick one to read it again or continue it. */
export function History({ onOpen, onClose, filter }: { onOpen: (s: SessionRow) => void; onClose: () => void; filter?: (s: SessionRow) => boolean }) {
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  useEffect(() => {
    api<SessionRow[]>('/api/sessions?limit=100').then((r) => setRows(filter ? r.filter(filter) : r))
  }, [filter])
  return (
    <Modal title="My history" onClose={onClose}>
      {!rows ? <Spinner /> : !rows.length ? <p className="text-sm text-slate-500">No saved calls yet.</p> : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((r) => (
            <li key={r.id}>
              <button className="w-full py-3 text-left" onClick={() => onOpen(r)}>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{modeName(r.mode, r.scenario)}{r.mode === 'roleplay' && r.scenario ? ` · ${r.scenario}` : ''}</span>
                  <span>{new Date(r.started_at.replace(' ', 'T') + 'Z').toLocaleString()} · {r.turns} turns</span>
                </div>
                <div className="truncate text-sm">{r.last_text}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
