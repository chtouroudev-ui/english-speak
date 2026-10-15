import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'

export type Settings = {
  llm_base_url: string
  llm_api: 'openai' | 'ollama'
  llm_api_key: string
  llm_model: string
  vision_model: string
  vision_enabled: boolean
  level: 'A2' | 'B1' | 'B2' | 'C1'
  correction_style: 'all' | 'big' | 'off'
  accent: 'us' | 'uk'
  voice_speed: number
  tts_engine: 'piper' | 'browser'
  stt_engine: 'server' | 'browser-whisper' | 'browser-native'
  whisper_model: string
  native_language: string
  job: string
  daily_goal_minutes: number
  reminder_time: string
  talk_mode: 'call' | 'push'
  theme: 'system' | 'light' | 'dark'
}

type Ctx = { settings: Settings | null; update: (s: Partial<Settings>) => Promise<void>; error: string | null }
const SettingsContext = createContext<Ctx>({ settings: null, update: async () => {}, error: null })

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<Settings>('/api/settings')
      .then(setSettings)
      .catch((e) => setError(String(e.message || e)))
  }, [])

  const update = useCallback(async (s: Partial<Settings>) => {
    setSettings((old) => (old ? { ...old, ...s } : old))
    setSettings(await api<Settings>('/api/settings', { method: 'PUT', json: s }))
  }, [])

  useEffect(() => {
    if (!settings) return
    const apply = () => {
      const dark =
        settings.theme === 'dark' ||
        (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [settings])

  return <SettingsContext.Provider value={{ settings, update, error }}>{children}</SettingsContext.Provider>
}

export const useSettings = () => useContext(SettingsContext)
