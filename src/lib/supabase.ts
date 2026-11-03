import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null

export const isSupabaseConfigured = Boolean(supabase)

export type StudySpaceRecord = {
  id: string
  topic: string
  youtube_url: string
  notes: string
  recall: string
  next_step: string
  completed_steps: string[]
  focused_minutes: number
}

export type FocusSessionRecord = {
  id: string
  topic: string
  duration_minutes: number
  completed_at: string
}

export type FocusSessionMetrics = {
  sessions: number
  focusHistory: Record<string, number>
}

export async function fetchStudySpaces(userId: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('study_spaces')
    .select('id, topic, youtube_url, notes, recall, next_step, completed_steps, focused_minutes')
    .eq('user_id', userId)
  if (error) throw error
  return data as StudySpaceRecord[]
}

export async function saveStudySpaces(userId: string, spaces: StudySpaceRecord[]) {
  if (!supabase || spaces.length === 0) return
  const rows = spaces.map((space) => ({ ...space, user_id: userId, updated_at: new Date().toISOString() }))
  const { error } = await supabase.from('study_spaces').upsert(rows, { onConflict: 'user_id,id' })
  if (error) throw error
}

export async function saveFocusSession(userId: string, minutes: number, topic: string) {
  if (!supabase) return
  const { error } = await supabase.from('focus_sessions').insert({
    user_id: userId,
    duration_minutes: minutes,
    topic: topic.trim(),
  })
  if (error) throw error
}

export async function fetchFocusSessions(userId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('focus_sessions')
    .select('id, topic, duration_minutes, completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(12)
  if (error) throw error
  return data as FocusSessionRecord[]
}

export async function fetchFocusSessionMetrics(userId: string): Promise<FocusSessionMetrics> {
  const metrics: FocusSessionMetrics = { sessions: 0, focusHistory: {} }
  if (!supabase) return metrics

  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('focus_sessions')
      .select('duration_minutes, completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    for (const record of data ?? []) {
      const completedAt = new Date(record.completed_at)
      if (Number.isNaN(completedAt.getTime())) continue
      const date = `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, '0')}-${String(completedAt.getDate()).padStart(2, '0')}`
      metrics.sessions += 1
      metrics.focusHistory[date] = (metrics.focusHistory[date] ?? 0) + record.duration_minutes
    }
    if (!data || data.length < pageSize) break
  }
  return metrics
}
