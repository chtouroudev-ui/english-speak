export class ApiError extends Error {}

export async function api<T = unknown>(path: string, opts: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...init } = opts
  const res = await fetch(path, {
    ...init,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
    body: json !== undefined ? JSON.stringify(json) : init.body,
  })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const data = await res.json()
      if (data.detail) msg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    } catch {
      /* not JSON */
    }
    throw new ApiError(msg)
  }
  const type = res.headers.get('content-type') || ''
  return (type.includes('json') ? res.json() : res.blob()) as Promise<T>
}

export type ChatEvent =
  | { type: 'session'; session_id: number; user_message_id: number | null }
  | { type: 'delta'; text: string }
  | { type: 'done'; message_id: number }
  | { type: 'error'; message: string }

export async function streamChat(body: unknown, onEvent: (e: ChatEvent) => void, signal?: AbortSignal) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) {
    let msg = `${res.status}`
    try {
      msg = (await res.json()).detail || msg
    } catch {
      /* ignore */
    }
    throw new ApiError(msg)
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i)
      buf = buf.slice(i + 2)
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) onEvent(JSON.parse(line.slice(6)))
      }
    }
  }
}

export type Word = { word: string; start?: number; end?: number; prob: number }
export type Transcript = {
  text: string
  words: Word[]
  duration: number
  wpm: number
  pauses: { after: string; seconds: number }[]
  fillers: number
  word_count: number
  avg_confidence: number | null
}
export type Mistake = { wrong: string; right: string; type?: string; why?: string }
export type Correction = { ok: boolean; corrected: string; mistakes: Mistake[] }
export type Scenario = { id: string; title: string; you: string; ai: string; start: string }
export type Topic = { topic: string; question: string; words: string[] }
export type Card = {
  id: number
  kind: 'word' | 'sentence'
  front: string
  back: string
  example: string
  due_at: string
  reps: number
}
export type Summary = {
  good: string[]
  fix: string[]
  words: { word: string; meaning: string }[]
  stats?: { seconds: number; words: number; wpm: number | null; mistakes: number; turns: number }
}
