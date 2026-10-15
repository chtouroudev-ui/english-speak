import { useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { useSettings, type Settings as S } from '../lib/settings'
import { speaker } from '../lib/tts'
import { ErrorBox, Icon, Segmented, Spinner } from '../components/ui'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export function Settings() {
  const { settings, update } = useSettings()
  const [models, setModels] = useState<string[] | null>(null)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<S>>({})
  if (!settings) return <div className="p-6"><Spinner /></div>
  const v = { ...settings, ...draft }
  const set = (p: Partial<S>) => setDraft((d) => ({ ...d, ...p }))
  const saveNow = (p: Partial<S>) => update(p)

  const saveModel = async () => {
    setErr(null)
    setMsg(null)
    await update(draft)
    setDraft({})
    setMsg('Saved.')
  }

  const test = async () => {
    setTesting(true)
    setErr(null)
    setMsg(null)
    try {
      await update(draft)
      setDraft({})
      const r = await api<{ models: string[] }>('/api/models')
      setModels(r.models)
      setMsg(`Connected! ${r.models.length} model(s) found.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setTesting(false)
    }
  }

  const askNotify = async () => {
    if (!('Notification' in window)) return setErr('This browser has no notifications.')
    const p = await Notification.requestPermission()
    setMsg(p === 'granted' ? 'Reminders are on.' : 'Notifications are blocked in your browser settings.')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-12">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section className="card space-y-3">
        <h2 className="font-semibold">Model</h2>
        <Field label="Server address" hint="Ollama: http://ollama:11434/v1 (inside Docker) or http://localhost:11434/v1. LM Studio: http://host:1234/v1">
          <input className="input" value={v.llm_base_url} onChange={(e) => set({ llm_base_url: e.target.value })} />
        </Field>
        <Field label="API type">
          <Segmented<S['llm_api']> value={v.llm_api} onChange={(x) => set({ llm_api: x, llm_base_url: x === 'ollama' ? v.llm_base_url.replace(/\/v1\/?$/, '') : v.llm_base_url.replace(/\/?$/, '').replace(/(\/v1)?$/, '/v1') })} options={[{ value: 'openai', label: 'OpenAI-compatible' }, { value: 'ollama', label: 'Ollama native' }]} />
        </Field>
        <Field label="API key (optional)">
          <input className="input" type="password" value={v.llm_api_key} onChange={(e) => set({ llm_api_key: e.target.value })} />
        </Field>
        <Field label="Chat model">
          <input className="input" list="models" value={v.llm_model} onChange={(e) => set({ llm_model: e.target.value })} />
        </Field>
        <Field label="Image model (empty = same as chat model)">
          <input className="input" list="models" value={v.vision_model} onChange={(e) => set({ vision_model: e.target.value })} />
        </Field>
        <datalist id="models">{models?.map((m) => <option key={m} value={m} />)}</datalist>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.vision_enabled} onChange={(e) => set({ vision_enabled: e.target.checked })} /> My model can read images (shows the Picture page)</label>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={saveModel}>Save</button>
          <button className="btn-ghost" onClick={test} disabled={testing}>{testing ? <Spinner /> : null} Test connection</button>
        </div>
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        <ErrorBox msg={err} onClose={() => setErr(null)} />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Voice</h2>
        <Field label="AI voice">
          <Segmented<S['tts_engine']> value={settings.tts_engine} onChange={(x) => saveNow({ tts_engine: x })} options={[{ value: 'piper', label: 'Piper (server, natural)' }, { value: 'browser', label: 'Browser voice' }]} />
        </Field>
        <Field label="Accent">
          <Segmented<S['accent']> value={settings.accent} onChange={(x) => saveNow({ accent: x })} options={[{ value: 'us', label: 'American' }, { value: 'uk', label: 'British' }]} />
        </Field>
        <Field label={`Speed: ${settings.voice_speed.toFixed(2)}×`}>
          <input type="range" min={0.6} max={1.4} step={0.05} className="w-full" value={settings.voice_speed} onChange={(e) => saveNow({ voice_speed: Number(e.target.value) })} />
        </Field>
        <button className="btn-ghost" onClick={() => speaker.speak('Hello! This is how I sound. Shall we practise together?')}><Icon name="play" className="h-4 w-4" /> Test voice</button>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Speech recognition</h2>
        <Field label="Engine" hint="Server Whisper is private and gives word scores. Browser Whisper runs on your device (slow on phones). Browser built-in is fast but, in Chrome, sends audio to Google.">
          <select className="input" value={settings.stt_engine} onChange={(e) => saveNow({ stt_engine: e.target.value as S['stt_engine'] })}>
            <option value="server">Whisper on my server (recommended)</option>
            <option value="browser-whisper">Whisper in the browser</option>
            <option value="browser-native">Browser built-in</option>
          </select>
        </Field>
        <Field label="Whisper model size" hint="base: fast on 2 CPUs. small: more accurate, about 3× slower.">
          <Segmented value={settings.whisper_model} onChange={(x) => saveNow({ whisper_model: x })} options={[{ value: 'tiny', label: 'tiny' }, { value: 'base', label: 'base' }, { value: 'small', label: 'small' }]} />
        </Field>
        <Field label="Talking mode">
          <Segmented<S['talk_mode']> value={settings.talk_mode} onChange={(x) => saveNow({ talk_mode: x })} options={[{ value: 'push', label: 'Tap to talk' }, { value: 'handsfree', label: 'Hands-free' }]} />
        </Field>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Learning</h2>
        <Field label="My level">
          <Segmented<S['level']> value={settings.level} onChange={(x) => saveNow({ level: x })} options={['A2', 'B1', 'B2', 'C1'].map((l) => ({ value: l as S['level'], label: l }))} />
        </Field>
        <Field label="Corrections">
          <Segmented<S['correction_style']> value={settings.correction_style} onChange={(x) => saveNow({ correction_style: x })} options={[{ value: 'big', label: 'Big mistakes' }, { value: 'all', label: 'Everything' }, { value: 'off', label: 'Off' }]} />
        </Field>
        <Field label="My language (for translations)">
          <input className="input" placeholder="ex: French, Arabic" defaultValue={settings.native_language} onBlur={(e) => saveNow({ native_language: e.target.value })} />
        </Field>
        <Field label="My job (for job practice)">
          <input className="input" placeholder="ex: web developer" defaultValue={settings.job} onBlur={(e) => saveNow({ job: e.target.value })} />
        </Field>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Goal and reminder</h2>
        <Field label="Daily goal (minutes of speaking)">
          <input className="input" type="number" min={1} max={120} defaultValue={settings.daily_goal_minutes} onBlur={(e) => saveNow({ daily_goal_minutes: Number(e.target.value) || 10 })} />
        </Field>
        <Field label="Remind me at" hint="The reminder shows when the app is open (or installed on your phone) and you have not reached your goal.">
          <input className="input" type="time" defaultValue={settings.reminder_time} onBlur={(e) => saveNow({ reminder_time: e.target.value })} />
        </Field>
        <button className="btn-ghost" onClick={askNotify}>Allow notifications</button>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Look</h2>
        <Segmented<S['theme']> value={settings.theme} onChange={(x) => saveNow({ theme: x })} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </section>
    </div>
  )
}
