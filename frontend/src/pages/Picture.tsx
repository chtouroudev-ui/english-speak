import { useRef, useState } from 'react'
import { api } from '../lib/api'
import { useSettings } from '../lib/settings'
import { Conversation } from '../components/Conversation'
import { ReadAloud } from '../components/ReadAloud'
import { ErrorBox, Icon, Segmented, Spinner } from '../components/ui'

type Mode = 'describe' | 'questions' | 'read'

/** Shrink photos before sending: a small CPU server reads a 768 px image much faster. */
async function resize(file: File, max = 768): Promise<string> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85)
}

export function Picture() {
  const { settings } = useSettings()
  const [image, setImage] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('describe')
  const [text, setText] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)

  if (settings && !settings.vision_enabled) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-slate-500">
        Picture practice is turned off. If your model can read images, turn it on in Settings → Model.
      </div>
    )
  }

  const pick = async (f?: File) => {
    if (!f) return
    setText(null)
    setImage(await resize(f))
  }

  const readText = async () => {
    if (!image) return
    setReading(true)
    setError(null)
    try {
      const r = await api<{ text: string }>('/api/image/read-text', { method: 'POST', json: { image } })
      setText(r.text || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setReading(false)
    }
  }

  const header = (
    <div className="space-y-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <Segmented<Mode>
        value={mode}
        onChange={(m) => { setMode(m); setText(null) }}
        options={[
          { value: 'describe', label: 'Describe it' },
          { value: 'questions', label: 'Answer questions' },
          { value: 'read', label: 'Read the text' },
        ]}
      />
      <div className="flex items-center gap-3">
        {image ? <img src={image} alt="Your picture" className="h-20 w-20 rounded-xl object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800"><Icon name="image" className="h-8 w-8" /></div>}
        <div className="flex flex-col gap-2">
          <button className="btn-ghost btn-small" onClick={() => camRef.current?.click()}><Icon name="camera" className="h-4 w-4" /> Take a photo</button>
          <button className="btn-ghost btn-small" onClick={() => fileRef.current?.click()}><Icon name="image" className="h-4 w-4" /> Choose a picture</button>
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {mode === 'describe' && image && <p className="text-sm text-slate-500">Tap the microphone and describe everything you see. Then I will tell you what you missed.</p>}
    </div>
  )

  if (mode === 'read') {
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto p-4">
          {!image && <p className="text-center text-slate-500">Take a photo of a menu, a sign or a page.</p>}
          {image && text === null && (
            <button className="btn-primary w-full" onClick={readText} disabled={reading}>{reading ? <><Spinner /> Reading the picture (this can take a minute)…</> : 'Find the text in my picture'}</button>
          )}
          <ErrorBox msg={error} onClose={() => setError(null)} />
          {text === '' && <p className="text-center text-slate-500">I found no text in this picture.</p>}
          {text && (
            text.split(/\n+/).filter((l) => l.trim().split(/\s+/).length >= 2).slice(0, 5).map((line, i) => (
              <ReadAloud key={i + line} target={line.trim()} />
            ))
          )}
        </div>
      </div>
    )
  }

  if (!image) {
    return (
      <div className="flex h-full flex-col">
        {header}
        <p className="p-6 text-center text-slate-500">Choose a picture to start.</p>
      </div>
    )
  }

  return (
    <Conversation
      key={`${mode}-${image.length}-${image.slice(-32)}`}
      mode={mode === 'describe' ? 'picture-describe' : 'picture-questions'}
      image={image}
      autoStart={mode === 'questions'}
      header={header}
    />
  )
}
