import { Icon, Spinner } from './ui'

export function MicButton({ recording, busy, onClick, level = 0, handsFree = false, size = 'lg' }: {
  recording: boolean
  busy: boolean
  onClick: () => void
  level?: number
  handsFree?: boolean
  size?: 'lg' | 'md'
}) {
  const dim = size === 'lg' ? 'h-20 w-20' : 'h-14 w-14'
  const ring = Math.min(1, level * 12)
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        disabled={busy}
        aria-label={recording ? 'Stop recording' : 'Start talking'}
        className={`relative ${dim} rounded-full text-white shadow-lg transition active:scale-95 disabled:opacity-60 ${recording ? 'bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
        style={recording || handsFree ? { boxShadow: `0 0 0 ${4 + ring * 14}px rgb(99 102 241 / ${0.15 + ring * 0.25})` } : undefined}
      >
        <span className="flex items-center justify-center">
          {busy ? <Spinner className="h-7 w-7" /> : <Icon name={recording ? 'stop' : 'mic'} className={size === 'lg' ? 'h-9 w-9' : 'h-6 w-6'} />}
        </span>
      </button>
      <span className="text-xs text-slate-500">
        {busy ? 'Listening to you…' : recording ? 'Tap to send' : handsFree ? 'Hands-free: just talk' : 'Tap to talk'}
      </span>
    </div>
  )
}
