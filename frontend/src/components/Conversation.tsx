import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api, streamChat, type Correction, type Summary, type Transcript } from '../lib/api'
import { useSettings } from '../lib/settings'
import { speaker } from '../lib/tts'
import { useVoice, type VoiceResult } from '../lib/voice'
import { Message, type Msg } from './Message'
import { MicButton } from './MicButton'
import { WordPopup } from './WordPopup'
import { ErrorBox, Icon, Modal, Spinner } from './ui'

let keySeq = 0
const k = () => `m${++keySeq}`

type SavedMsg = { id: number; role: 'user' | 'assistant'; content: string; correction: Correction | null; wpm: number | null; word_count: number }

const store = {
  get: (key: string) => { try { return localStorage.getItem(key) } catch { return null } },
  set: (key: string, v: string | null) => { try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, v) } catch { /* private mode */ } },
}

function useSpeaking() {
  const [speaking, setSpeaking] = useState(speaker.speaking)
  useEffect(() => speaker.onChange(setSpeaking) as unknown as () => void, [])
  return speaking
}

export function Conversation({ mode, scenarioId, image, autoStart, header, storageKey, openSessionId, onEnded }: {
  mode: string
  scenarioId?: string
  image?: string | null
  /** The AI speaks first when the call starts. */
  autoStart?: boolean
  header?: ReactNode
  /** Remembers the open conversation across reloads (history is always saved on the server). */
  storageKey?: string
  /** Open a saved conversation from the history. */
  openSessionId?: number | null
  onEnded?: (s: Summary) => void
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
  const [inCall, setInCall] = useState(false)
  const [muted, setMuted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [callStart, setCallStart] = useState(0)
  const [now, setNow] = useState(0)
  const sessionRef = useRef<number | null>(null)
  const imageSent = useRef(false)
  const bottom = useRef<HTMLDivElement>(null)
  const speaking = useSpeaking()
  const pushMode = settings?.talk_mode === 'push'

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs])

  useEffect(() => () => speaker.stop(), [])

  useEffect(() => {
    if (!inCall) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [inCall])

  // Reopen the saved conversation (after a reload, or from the history list).
  useEffect(() => {
    const id = openSessionId ?? (storageKey ? Number(store.get(storageKey)) || null : null)
    if (!id) return
    setLoading(true)
    api<{ messages: SavedMsg[] }>(`/api/sessions/${id}`)
      .then((r) => {
        sessionRef.current = id
        setSessionId(id)
        if (storageKey) store.set(storageKey, String(id))
        setMsgs(
          r.messages.map((m) => ({
            key: k(),
            role: m.role,
            text: m.content,
            id: m.id,
            correction: m.correction,
            speech: m.role === 'user' && m.wpm ? ({ wpm: Math.round(m.wpm), words: [], pauses: [], fillers: 0 } as unknown as Transcript) : undefined,
          })),
        )
      })
      .catch(() => storageKey && store.set(storageKey, null))
      .finally(() => setLoading(false))
  }, [openSessionId, storageKey])

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
            if (storageKey) store.set(storageKey, String(e.session_id))
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
      } else {
        patch(userKey, { correcting: false })
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
    handsFree: inCall && !muted && !pushMode,
    paused: thinking,
    onResult: (r) => send(r.text, r),
    onError: setError,
  })

  const startCall = () => {
    setError(null)
    setInCall(true)
    setMuted(false)
    setCallStart(Date.now())
    setNow(Date.now())
    if (autoStart && msgs.length === 0) send('', undefined, true)
    else if (msgs.length === 0) speaker.speak('Hi! I am listening.')
  }

  const hangUp = async () => {
    setInCall(false)
    speaker.stop()
    if (voice.recording) voice.stop()
    if (!sessionId || !msgs.some((m) => m.role === 'user')) return
    setEnding(true)
    try {
      const s = await api<Summary>(`/api/sessions/${sessionId}/end`, { method: 'POST' })
      setSummary(s)
      onEnded?.(s)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setEnding(false)
    }
  }

  const newConversation = () => {
    speaker.stop()
    setInCall(false)
    setMsgs([])
    setSessionId(null)
    sessionRef.current = null
    imageSent.current = false
    setSummary(null)
    if (storageKey) store.set(storageKey, null)
  }

  const secs = inCall ? Math.max(0, Math.floor((now - callStart) / 1000)) : 0
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  const state = muted
    ? 'Muted'
    : voice.busy
      ? 'Understanding you…'
      : voice.recording
        ? 'You are talking…'
        : thinking && !speaking
          ? 'Thinking…'
          : speaking
            ? 'Speaking…'
            : pushMode
              ? 'Tap the mic to talk'
              : 'Listening… just talk'
  const pulse = Math.min(1, voice.level * 12)

  return (
    <div className="flex h-full flex-col">
      {header}

      {inCall && (
        <div className="flex flex-col items-center gap-2 border-b border-slate-200 bg-gradient-to-b from-indigo-600 to-indigo-700 px-4 py-5 text-white dark:border-slate-800">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white/15 transition-all" style={{ boxShadow: `0 0 0 ${speaking ? 14 : 4 + pulse * 22}px rgb(255 255 255 / ${speaking ? 0.18 : 0.08 + pulse * 0.2})` }}>
            <span className="text-4xl">🎧</span>
          </div>
          <div className="text-lg font-semibold">{state}</div>
          <div className="text-sm tabular-nums text-indigo-100">{clock}</div>
          <div className="mt-2 flex items-center gap-6">
            <button className={`flex h-14 w-14 items-center justify-center rounded-full ${muted ? 'bg-white text-indigo-700' : 'bg-white/20'}`} onClick={() => { setMuted(!muted); if (voice.recording) voice.stop() }} aria-label={muted ? 'Unmute' : 'Mute'}>
              <Icon name="mic" className="h-6 w-6" />
            </button>
            {pushMode && <MicButton recording={voice.recording} busy={voice.busy || thinking} onClick={voice.toggle} level={voice.level} size="md" />}
            <button className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg active:scale-95" onClick={hangUp} aria-label="Hang up">
              <svg viewBox="0 0 24 24" className="h-8 w-8 rotate-[135deg]" fill="currentColor"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg>
            </button>
            <button className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20" onClick={() => setHelpOpen(true)} aria-label="Help me say it">
              <Icon name="help" className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {loading && <div className="flex justify-center"><Spinner /></div>}
        {!loading && msgs.length === 0 && !inCall && (
          <div className="mx-auto mt-6 max-w-sm text-center text-slate-500">
            <p className="text-lg font-medium text-slate-700 dark:text-slate-200">Start a call and just talk 📞</p>
            <p className="mt-1 text-sm">Speak naturally, like on the phone. I answer with my voice, and I write a better way to say things under your words.</p>
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
        {!inCall && (
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-3">
            <button className="btn-ghost btn-small" onClick={newConversation} disabled={!msgs.length}><Icon name="plus" className="h-4 w-4" /> New</button>
            <button className="btn h-14 flex-1 rounded-full bg-emerald-500 text-base text-white shadow-lg hover:bg-emerald-400 sm:flex-none sm:px-10" onClick={startCall} disabled={ending || loading}>
              {ending ? <Spinner /> : '📞'} {msgs.length ? 'Continue the call' : 'Start call'}
            </button>
            <button className="btn-ghost btn-small" onClick={() => setHelpOpen(true)}><Icon name="help" className="h-4 w-4" /> Help</button>
          </div>
        )}
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
      {summary && <SummaryModal summary={summary} onClose={() => setSummary(null)} onNew={newConversation} />}
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
