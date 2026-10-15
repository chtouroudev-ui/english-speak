import type { ReactNode } from 'react'

const paths: Record<string, ReactNode> = {
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" />,
  play: <path d="M8 5v14l11-7z" />,
  slow: <><path d="M8 5v14l11-7z" /><path d="M3 5v14" /></>,
  chat: <path d="M4 5h16v11H8l-4 4z" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  image: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-8 8" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.2-.8.2-1.2z" /></>,
  translate: <path d="M4 5h8M8 3v2c0 4-2 7-5 8M6 9c1 2 3 4 6 5M13 21l4-9 4 9M14.5 18h5" />,
  save: <path d="M6 3h12v18l-6-4-6 4z" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  flame: <path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-3 1-6 1-9z" />,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  ear: <path d="M8 18c0 2 2 3 4 3s3-2 3-4 4-3 4-8A7 7 0 0 0 5 9M9 9a3 3 0 0 1 6 0c0 2-2 2-2 4" />,
}

export function Icon({ name, className = 'h-5 w-5' }: { name: keyof typeof paths | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {paths[name]}
    </svg>
  )
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-3xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-ghost btn-small" onClick={onClose} aria-label="Close"><Icon name="x" className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ErrorBox({ msg, onClose }: { msg: string | null; onClose?: () => void }) {
  if (!msg) return null
  return (
    <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900">
      <span className="flex-1">{msg}</span>
      {onClose && <button onClick={onClose} aria-label="Close"><Icon name="x" className="h-4 w-4" /></button>}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium ${value === o.value ? 'bg-white shadow-sm dark:bg-slate-950' : 'text-slate-500'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
