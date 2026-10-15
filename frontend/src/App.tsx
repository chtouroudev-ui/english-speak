import { useEffect, useState } from 'react'
import { api } from './lib/api'
import { useSettings } from './lib/settings'
import { speaker } from './lib/tts'
import { Icon, Spinner } from './components/ui'
import { Talk } from './pages/Talk'
import { Practice } from './pages/Practice'
import { Picture } from './pages/Picture'
import { Course } from './pages/Course'
import { Review } from './pages/Review'
import { Progress, tzOffset, type Stats } from './pages/Progress'
import { Settings } from './pages/Settings'

const PAGES = [
  { id: 'talk', label: 'Call', icon: 'chat' },
  { id: 'course', label: 'Course', icon: 'target' },
  { id: 'practice', label: 'Practice', icon: 'ear' },
  { id: 'picture', label: 'Picture', icon: 'image' },
  { id: 'review', label: 'Review', icon: 'book' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
] as const
type PageId = (typeof PAGES)[number]['id']

const fromHash = (): PageId => {
  const h = location.hash.slice(1)
  return (PAGES.find((p) => p.id === h)?.id || 'talk') as PageId
}

export default function App() {
  const { settings, error } = useSettings()
  const [page, setPage] = useState<PageId>(fromHash)
  const [goalBanner, setGoalBanner] = useState<string | null>(null)

  useEffect(() => {
    const on = () => setPage(fromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  useEffect(() => {
    if (settings) speaker.settings = { tts_engine: settings.tts_engine, accent: settings.accent, voice_speed: settings.voice_speed }
  }, [settings])

  // Daily goal reminder (proposal 40).
  useEffect(() => {
    if (!settings) return
    const check = async () => {
      try {
        const s = await api<Stats>(`/api/stats?tz=${tzOffset()}`)
        const left = s.goal_minutes - s.today_minutes
        setGoalBanner(left > 0 ? `Today: ${s.today_minutes} of ${s.goal_minutes} minutes. ${s.streak ? `🔥 ${s.streak}-day streak, keep it going!` : 'Let’s start a streak!'}` : null)
        const now = new Date()
        const [h, m] = (settings.reminder_time || '19:00').split(':').map(Number)
        const today = now.toDateString()
        let last: string | null = null
        try { last = localStorage.getItem('reminded') } catch { /* private mode */ }
        if (left > 0 && now.getHours() * 60 + now.getMinutes() >= h * 60 + m && last !== today && 'Notification' in window && Notification.permission === 'granted') {
          const reg = await navigator.serviceWorker?.getRegistration()
          const body = `You have ${Math.ceil(left)} minutes of speaking left today.`
          if (reg) reg.showNotification('Time to speak English 🎙️', { body, icon: '/icon-192.png' })
          else new Notification('Time to speak English 🎙️', { body })
          try { localStorage.setItem('reminded', today) } catch { /* ignore */ }
        }
      } catch { /* server not ready */ }
    }
    check()
    const t = setInterval(check, 60_000)
    return () => clearInterval(t)
  }, [settings, page])

  const go = (id: PageId) => { location.hash = id }
  const visible = PAGES.filter((p) => p.id !== 'picture' || settings?.vision_enabled === true)

  if (error) return <div className="p-6 text-red-600">Cannot reach the app server: {error}</div>
  if (!settings) return <div className="flex h-full items-center justify-center"><Spinner className="h-8 w-8 text-indigo-600" /></div>

  return (
    <div className="flex h-full">
      <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-slate-200 p-3 md:flex dark:border-slate-800">
        <div className="mb-4 flex items-center gap-2 px-2 pt-2 text-lg font-bold"><img src="/icon.svg" className="h-8 w-8" alt="" /> Speak English</div>
        {visible.map((p) => (
          <button key={p.id} onClick={() => go(p.id)} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${page === p.id ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'}`}>
            <Icon name={p.icon} /> {p.label}
          </button>
        ))}
      </nav>
      <main className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {page === 'talk' && <Talk goalBanner={goalBanner} />}
          {page === 'course' && <Course />}
          {page === 'practice' && <Practice />}
          {page === 'picture' && <Picture />}
          {page === 'review' && <Review />}
          {page === 'progress' && <Progress />}
          {page === 'settings' && <Settings />}
        </div>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/95">
        {visible.map((p) => (
          <button key={p.id} onClick={() => go(p.id)} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${page === p.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
            <Icon name={p.icon} className="h-5 w-5" /> {p.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
