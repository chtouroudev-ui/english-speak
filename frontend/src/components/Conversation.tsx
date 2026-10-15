import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api, streamChat, type Correction, type Summary } from '../lib/api'
import { useSettings } from '../lib/settings'
import { speaker } from '../lib/tts'
import { useVoice, type VoiceResult } from '../lib/voice'
import { Message, type Msg } from './Message'
import { MicButton } from './MicButton'
import { WordPopup } from './WordPopup'
import { ErrorBox, Icon, Modal, Spinner } from './ui'

let keySeq = 0
const k = () => `m${++keySeq}`

export function Conversation({ mode, scenarioId, image, autoStart, startLabel, header }: {
  mode: string
  scenarioId?: string
  image?: string | null
  autoStart?: boolean
  startLabel?: string
  header?: ReactNode
}) {
  const { settings } = useSettings()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [word, setWord] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [ending, setEnding] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const sessionRef = useRef<number | null>(null)
  const imageSent = useRef(false)
  const bottom = useRef<HTMLDivElement>(null)
  const [handsFree, setHandsFree] = useState(settings?.talk_mode === 'handsfree')

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs])

  useEffect(() => () => speaker.stop(), [])

  const patch = (key: string, p: Partial<Msg>) => setMsgs((all) => all.map((m) => (m.key === key ? { ...m, ...p } : m)))

  async function send(text: string, voice?: VoiceResult, start = false) {
    setError(null)
    const userKey = k()
    const aiKey = k()
    const img = image && !imageSent.current ? image : null
    if (!start) {
      setMsgs((all) => [...all, { key: userKey, role: 'user', text, speech: voice, audioUrl: voice?.audioUrl, image: img || undefined, correcting: settings?.correction_style !== 'off' }])
    }
    setMsgs((all) => [...all, { key: aiKey, role: 'assistant', text: '', streaming: true }])
    setThinking(true)
    const voiceOut = speaker.stream()
    let full = ''
    let userMsgId: number | null = null
    try {
      await streamChat(
        {
          session_id: sessionRef.current,
          mode,
          scenario_id: scenarioId,
          text,
          image: img,
          start,
          speech: voice ? { audio_seconds: voice.duration, word_count: voice.word_count, wpm: voice.wpm, avg_confidence: voice.avg_confidence } : null,
        },
        (e) => {
          if (e.type === 'session') {
            sessionRef.current = e.session_id
            setSessionId(e.session_id)
            if (img) imageSent.current = true
            if (e.user_message_id && !start) userMsgId = e.user_message_id
          } else if (e.type === 'delta') {
            full += e.text
            voiceOut.push(e.text)
            patch(aiKey, { text: full })
          } else if (e.type === 'done') {
            patch(aiKey, { id: e.message_id, streaming: false })
          } else if (e.type === 'error') {
            throw new Error(e.message)
          }
        },
      )
      voiceOut.end()
      // Corrections run after the answer, so the answer gets the CPU first on a small server.
      if (userMsgId && settings?.correction_style !== 'off') {
        api<Correction>('/api/correct', { method: 'POST', json: { message_id: userMsgId, text } })
          .then((c) => patch(userKey, { correction: c, correcting: false }))
          .catch(() => patch(userKey, { correcting: false }))
      }
    } catch (e) {
      setError(`The model did not answer: ${e instanceof Error ? e.message : e}. Check Settings → Model.`)
      setMsgs((all) => all.filter((m) => m.key !== aiKey))
      patch(userKey, { correcting: false })
    } finally {
      setThinking(false)
    }
  }

  const voice = useVoice({
    engine: settings?.stt_engine || 'server',
    handsFree,
    paused: thinking,
    onResult: (r) => send(r.text, r),
    onError: setError,
  })

  useEffect(() => {
    if (autoStart && msgs.length === 0 && !thinking) send('', undefined, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart])

  const endSession = async () => {
    if (!sessionId) return
    speaker.stop()
    setEnding(true)
    try {
      setSummary(await api<Summary>(`/api/sessions/${sessionId}/end`, { method: 'POST' }))
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setEnding(false)
    }
  }

  const restart = () => {
    speaker.stop()
    setMsgs([])
    setSessionId(null)
    sessionRef.current = null
    imageSent.current = false
    setSummary(null)
    if (autoStart) setTimeout(() => send('', undefined, true), 0)
  }

  const userTurns = msgs.filter((m) => m.role === 'user').length

  return (
    <div className="flex h-full flex-col">
      {header}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && !autoStart && (
          <div className="mx-auto mt-6 max-w-sm text-center text-slate-500">
            <p className="text-lg font-medium text-slate-700 dark:text-slate-200">Tap the microphone and say hello 👋</p>
            <p className="mt-1 text-sm">Speak naturally. I will answer, and show you a better way to say things.</p>
            {startLabel && <button className="btn-ghost mt-4" onClick={() => send('', undefined, true)}>{startLabel}</button>}
          </div>
        )}
        {msgs.map((m) => (
          <Message key={m.key} m={m} onWord={setWord} slowSpeed={Math.max(0.6, (settings?.voice_speed || 1) * 0.75)} />
        ))}
        {thinking && msgs[msgs.length - 1]?.text === '' && (
          <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner /> Thinking…</div>
        )}
        <ErrorBox msg={error} onClose={() => setError(null)} />
        <div ref={bottom} />
      </div>

      <div className="border-t border-slate-200 bg-white/90 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <button className="btn-ghost btn-small" onClick={() => setHelpOpen(true)}><Icon name="help" className="h-4 w-4" /> Help me say it</button>
            <button className={`btn-small btn ${handsFree ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'btn-ghost'}`} onClick={() => setHandsFree((v) => !v)}>
              {handsFree ? 'Hands-free on' : 'Hands-free off'}
            </button>
          </div>
          <MicButton recording={voice.recording} busy={voice.busy || thinking} onClick={voice.toggle} level={voice.level} handsFree={handsFree} />
          <div className="flex flex-col gap-2">
            <button className="btn-ghost btn-small" onClick={endSession} disabled={!userTurns || ending}>{ending ? <Spinner className="h-3 w-3" /> : <Icon name="chart" className="h-4 w-4" />} End & summary</button>
            <button className="btn-ghost btn-small" onClick={restart}><Icon name="refresh" className="h-4 w-4" /> New talk</button>
          </div>
        </div>
        <form
          className="mx-auto mt-3 flex max-w-2xl gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (typed.trim() && !thinking) {
              send(typed.trim())
              setTyped('')
            }
          }}
        >
          <input className="input" placeholder="…or type a message" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <button className="btn-ghost" disabled={!typed.trim() || thinking}>Send</button>
        </form>
      </div>

      {word && <WordPopup word={word} onClose={() => setWord(null)} />}
      {helpOpen && <HelpSay onClose={() => setHelpOpen(false)} />}
      {summary && <SummaryModal summary={summary} onClose={() => setSummary(null)} onNew={restart} />}
    </div>
  )
}

/** "Help me say it" (proposal 35). */
function HelpSay({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<{ english: string; simple: string; tip: string } | null>(null)
  const ask = async () => {
    setBusy(true)
    try {
      setOut(await api('/api/help-say', { method: 'POST', json: { text } }))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="Help me say it" onClose={onClose}>
      <p className="mb-2 text-sm text-slate-500">Write what you want to say, in any language or in broken English.</p>
      <textarea className="input min-h-24" value={text} onChange={(e) => setText(e.target.value)} placeholder="ex: je veux dire que j'ai raté le bus ce matin" />
      <button className="btn-primary mt-2 w-full" onClick={ask} disabled={!text.trim() || busy}>{busy ? <Spinner /> : 'Show me'}</button>
      {out && (
        <div className="mt-4 space-y-3">
          {[['Natural', out.english], ['Simple', out.simple]].map(([label, t]) =>
            t ? (
              <div key={label} className="card">
                <div className="label">{label}</div>
                <p className="text-lg">{t}</p>
                <button className="btn-ghost btn-small mt-2" onClick={() => speaker.speak(t)}><Icon name="play" className="h-3.5 w-3.5" /> Listen</button>
              </div>
            ) : null,
          )}
          {out.tip && <p className="text-sm text-slate-600 dark:text-slate-300">💡 {out.tip}</p>}
          <p className="text-sm text-slate-500">Now close this and say it out loud!</p>
        </div>
      )}
    </Modal>
  )
}

/** End-of-session summary (proposal 36). */
export function SummaryModal({ summary, onClose, onNew }: { summary: Summary; onClose: () => void; onNew?: () => void }) {
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const save = async (w: { word: string; meaning: string }) => {
    await api('/api/cards', { method: 'POST', json: { kind: 'word', front: w.word, back: w.meaning } })
    setSaved((s) => new Set(s).add(w.word))
  }
  const st = summary.stats
  return (
    <Modal title="Session summary" onClose={onClose}>
      {st && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="card !p-2"><div className="text-xl font-bold">{Math.round(st.seconds / 6) / 10}</div><div className="text-xs text-slate-500">minutes spoken</div></div>
          <div className="card !p-2"><div className="text-xl font-bold">{st.words}</div><div className="text-xs text-slate-500">words</div></div>
          <div className="card !p-2"><div className="text-xl font-bold">{st.mistakes}</div><div className="text-xs text-slate-500">corrections</div></div>
        </div>
      )}
      {summary.good?.length > 0 && (
        <section className="mb-4">
          <h3 className="mb-1 font-semibold text-emerald-700 dark:text-emerald-400">What went well</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{summary.good.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </section>
      )}
      {summary.fix?.length > 0 && (
        <section className="mb-4">
          <h3 className="mb-1 font-semibold text-amber-700 dark:text-amber-400">To work on</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{summary.fix.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </section>
      )}
      {summary.words?.length > 0 && (
        <section className="mb-4">
          <h3 className="mb-1 font-semibold">New words</h3>
          <ul className="space-y-1">
            {summary.words.map((w) => (
              <li key={w.word} className="flex items-center justify-between gap-2 text-sm">
                <span><b>{w.word}</b> · <span className="text-slate-500">{w.meaning}</span></span>
                <button className="btn-ghost btn-small" onClick={() => save(w)} disabled={saved.has(w.word)}>{saved.has(w.word) ? 'Saved' : 'Save'}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {onNew && <button className="btn-primary w-full" onClick={() => { onClose(); onNew() }}>Start a new talk</button>}
    </Modal>
  )
}
