import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { ReadAloud } from '../components/ReadAloud'
import { ErrorBox, Icon, Spinner } from '../components/ui'

export function Practice() {
  const [sentence, setSentence] = useState('')
  const [about, setAbout] = useState('')
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const next = async (ai: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const r = await api<{ sentence: string }>(`/api/practice/sentence?ai=${ai}&about=${encodeURIComponent(about)}`)
      setSentence(r.sentence)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    next(false)
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Repeat after me</h1>
        <p className="text-sm text-slate-500">Listen, then read the sentence out loud. Coloured words show what to fix.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => next(false)} disabled={busy}><Icon name="refresh" className="h-4 w-4" /> Next sentence</button>
        <button className="btn-ghost" onClick={() => next(true)} disabled={busy}>{busy ? <Spinner /> : '✨'} New from AI</button>
        <input className="input !w-auto flex-1" placeholder="about… (optional, for AI)" value={about} onChange={(e) => setAbout(e.target.value)} />
      </div>
      <ErrorBox msg={error} onClose={() => setError(null)} />
      {sentence && <ReadAloud key={sentence} target={sentence} />}
      <details className="card">
        <summary className="cursor-pointer text-sm font-medium">Use my own sentence</summary>
        <div className="mt-2 flex gap-2">
          <input className="input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Type any sentence to practise" />
          <button className="btn-primary" disabled={!custom.trim()} onClick={() => setSentence(custom.trim())}>Use</button>
        </div>
      </details>
    </div>
  )
}
