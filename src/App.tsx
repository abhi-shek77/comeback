import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { DashboardScreen } from './components/DashboardScreen'
import { FocusScreen } from './components/FocusScreen'
import { Icon, type IconName } from './components/Icons'
import { JourneyScreen } from './components/JourneyScreen'
import { OnboardingScreen } from './components/OnboardingScreen'
import { WelcomeScreen } from './components/WelcomeScreen'
import { fetchFocusSessionMetrics, fetchFocusSessions, isSupabaseConfigured, saveFocusSession, supabase, type FocusSessionRecord } from './lib/supabase'

export type AppScreen = 'dashboard' | 'focus' | 'journey'
export type Goal = 'study' | 'exams' | 'routine' | 'focus'
export type Quest = { id: string; title: string; detail: string; xp: number; completed: boolean }
type SavedProgress = {
  onboarded: boolean
  selectedGoal: Goal | null
  dailyTarget: number
  preferredMinutes: number
  xp: number
  level: number
  streak: number
  longestStreak: number
  sessions: number
  focusHistory: Record<string, number>
  quests: Quest[]
  savedDay: string
  lastActiveDate: string | null
}

const storageKey = 'comeback-progress-v1'
const studyWorkspaceStorageKey = 'comeback-study-workspace-v1'

type StudySpaceSummary = { id: string; title: string; focusedMinutes: number; hasLesson: boolean }

function getLastStudySpaceSummary(): StudySpaceSummary | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(studyWorkspaceStorageKey) ?? 'null') as { lessons?: Array<{ id?: unknown; topic?: unknown; youtubeUrl?: unknown; notes?: unknown; recall?: unknown; next?: unknown; focusedMinutes?: unknown }>; activeId?: unknown } | null
    if (!saved || !Array.isArray(saved.lessons)) return null
    const current = saved.lessons.find((lesson) => lesson?.id === saved.activeId) ?? saved.lessons[0]
    if (!current || typeof current.id !== 'string') return null
    const topic = typeof current.topic === 'string' ? current.topic.trim() : ''
    const youtubeUrl = typeof current.youtubeUrl === 'string' ? current.youtubeUrl : ''
    const hasNotes = [current.notes, current.recall, current.next].some((value) => typeof value === 'string' && value.trim().length > 0)
    const focusedMinutes = Number.isFinite(current.focusedMinutes) && Number(current.focusedMinutes) > 0 ? Number(current.focusedMinutes) : 0
    if (!topic && !youtubeUrl && !hasNotes && !focusedMinutes) return null
    return { id: current.id, title: topic || 'Untitled study', focusedMinutes, hasLesson: Boolean(youtubeUrl) }
  } catch {
    return null
  }
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const initialQuests: Quest[] = [
  { id: 'open', title: 'Open your study space', detail: 'Just get your notes in front of you.', xp: 15, completed: false },
  { id: 'focus', title: 'Try one focus session', detail: 'Five minutes is a real start.', xp: 25, completed: false },
  { id: 'win', title: 'Name one small win', detail: 'Notice the effort you made today.', xp: 10, completed: false },
]

function isGoal(value: unknown): value is Goal {
  return value === 'study' || value === 'exams' || value === 'routine' || value === 'focus'
}

function loadSavedProgress(): SavedProgress {
  const fresh: SavedProgress = {
    onboarded: false,
    selectedGoal: null,
    dailyTarget: 30,
    preferredMinutes: 5,
    xp: 0,
    level: 1,
    streak: 0,
    longestStreak: 0,
    sessions: 0,
    focusHistory: {},
    quests: initialQuests,
    savedDay: dayKey(new Date()),
    lastActiveDate: null,
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return fresh
    const saved = JSON.parse(raw) as Partial<SavedProgress>
    const validQuests = Array.isArray(saved.quests) ? saved.quests : []
    const quests = initialQuests.map((quest) => {
      const savedQuest = validQuests.find((item) => item?.id === quest.id)
      if (!savedQuest || typeof savedQuest.title !== 'string' || typeof savedQuest.detail !== 'string') return quest
      return { ...quest, title: savedQuest.title, detail: savedQuest.detail, completed: savedQuest.completed === true }
    })
    const focusHistory = Object.fromEntries(
      Object.entries(saved.focusHistory ?? {}).filter(([, minutes]) => Number.isFinite(minutes) && minutes >= 0),
    ) as Record<string, number>
    const savedDay = typeof saved.savedDay === 'string' ? saved.savedDay : fresh.savedDay
    const isNewDay = savedDay !== fresh.savedDay

    return {
      ...fresh,
      onboarded: saved.onboarded === true && isGoal(saved.selectedGoal),
      selectedGoal: isGoal(saved.selectedGoal) ? saved.selectedGoal : null,
      dailyTarget: [20, 30, 45, 60].includes(saved.dailyTarget ?? -1) ? saved.dailyTarget! : fresh.dailyTarget,
      preferredMinutes: [5, 15, 25].includes(saved.preferredMinutes ?? -1) ? saved.preferredMinutes! : fresh.preferredMinutes,
      xp: Number.isFinite(saved.xp) && saved.xp! >= 0 && saved.xp! < 500 ? saved.xp! : fresh.xp,
      level: Number.isFinite(saved.level) && saved.level! >= 1 ? Math.floor(saved.level!) : fresh.level,
      streak: Number.isFinite(saved.streak) && saved.streak! >= 0 ? Math.floor(saved.streak!) : fresh.streak,
      longestStreak: Number.isFinite(saved.longestStreak) && saved.longestStreak! >= 0
        ? Math.floor(saved.longestStreak!)
        : Number.isFinite(saved.streak) && saved.streak! >= 0 ? Math.floor(saved.streak!) : fresh.longestStreak,
      sessions: Number.isFinite(saved.sessions) && saved.sessions! >= 0 ? Math.floor(saved.sessions!) : fresh.sessions,
      focusHistory: Object.keys(focusHistory).length ? focusHistory : fresh.focusHistory,
      quests: isNewDay ? quests.map((quest) => ({ ...quest, completed: false })) : quests,
      savedDay: fresh.savedDay,
      lastActiveDate: typeof saved.lastActiveDate === 'string' ? saved.lastActiveDate : null,
    }
  } catch {
    return fresh
  }
}

const navItems: { screen: AppScreen; label: string; icon: IconName }[] = [
  { screen: 'dashboard', label: 'Today', icon: 'grid' },
  { screen: 'focus', label: 'Focus room', icon: 'clock' },
  { screen: 'journey', label: 'My journey', icon: 'path' },
]

const goalLabels: Record<Goal, string> = {
  study: 'Get back into studying',
  exams: 'Feel ready for exams',
  routine: 'Build a gentle routine',
  focus: 'Find my focus again',
}

function Brand({ iconOnly = false }: { iconOnly?: boolean }) {
  return <div className="flex items-center gap-3">
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8B5CF6] text-white shadow-[0_6px_22px_rgba(139,92,246,.24)]"><Icon name="spark" size={17}/></span>
    {!iconOnly && <span className="text-[17px] font-semibold tracking-[-.04em]">comeback<span className="text-[#8B5CF6]">.</span></span>}
  </div>
}

function Navigation({ screen, user, onNavigate, onAccount }: { screen: AppScreen; user: User | null; onNavigate: (screen: AppScreen) => void; onAccount: () => void }) {
  const navButton = (item: typeof navItems[number]) => <button key={item.screen} onClick={() => onNavigate(item.screen)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${screen === item.screen ? 'bg-[#8B5CF6]/[.14] font-medium text-[#C7B4FF]' : 'text-[#9690A1] hover:bg-white/[.045] hover:text-[#E9E6EF]'}`}><Icon name={item.icon} size={17}/>{item.label}</button>
  const profileName = user?.email ?? 'Your comeback'
  const profileDescription = user ? 'Account & sync settings' : 'Sign in to sync progress'
  const profileInitial = user?.email?.slice(0, 1).toUpperCase() ?? 'Y'
  return <>
    <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 self-start flex-col border-r border-white/[.065] px-5 py-6 md:flex">
      <div className="px-2"><Brand/></div>
      <div className="mt-11 px-3 text-[10px] font-semibold uppercase tracking-[.17em] text-[#6E6879]">Your space</div>
      <nav className="mt-3 space-y-1">{navItems.map(navButton)}</nav>
      <div className="mt-auto rounded-2xl border border-[#8B5CF6]/15 bg-[#8B5CF6]/[.065] p-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B5CF6]/15 text-[#BFAAFF]"><Icon name="spark" size={15}/></span>
        <div className="mt-3 text-sm font-medium">You’re finding your way.</div><p className="mt-1.5 text-xs leading-5 text-[#9690A1]">Small steps are still steps forward.</p>
      </div>
      <button type="button" onClick={onAccount} aria-label="Open account and sync settings" className="mt-5 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#302A3C] text-xs font-semibold text-[#D0C3E9]">{profileInitial}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-[#E4E0E9]">{profileName}</span><span className="mt-0.5 block truncate text-[10px] text-[#817B8F]">{profileDescription}</span></span><span aria-hidden="true" className="text-[#817B8F]">···</span></button>
    </aside>
    <nav aria-label="Main navigation" className="mobile-nav fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-white/[.08] bg-[#14121A]/95 px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur-xl md:hidden">{navItems.map((item) => <button key={item.screen} onClick={() => onNavigate(item.screen)} className={`flex min-w-[68px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[9px] transition-colors ${screen === item.screen ? 'text-[#C7B4FF]' : 'text-[#817B8F]'}`}><Icon name={item.icon} size={18}/>{item.label}</button>)}</nav>
  </>
}

function MissedDayDialog({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-5 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="reset-title" className="w-full max-w-[430px] rounded-[24px] border border-white/[.09] bg-[#201C2B] p-6 shadow-[0_28px_100px_rgba(0,0,0,.55)] sm:p-8">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5B942]/[.12] text-[#F5B942]"><Icon name="sun" size={20}/></div>
      <div className="mt-5 text-[10px] font-semibold uppercase tracking-[.16em] text-[#F5B942]">A gentle reset</div>
      <h2 id="reset-title" className="mt-2 text-[25px] font-semibold leading-tight tracking-[-.045em]">A missed day doesn’t erase your progress.</h2>
      <p className="mt-3 text-sm leading-6 text-[#A3A3A8]">Your XP, level, and everything you’ve already done stay right where they are. Today can be a new day one.</p>
      <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row"><button onClick={onClose} className="rounded-xl border border-white/[.09] px-4 py-3 text-sm font-medium text-[#B8B4C0] transition hover:bg-white/[.04] sm:flex-1">Maybe later</button><button onClick={onReset} className="rounded-xl bg-[#8B5CF6] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#9A70F7] sm:flex-1">Start fresh today</button></div>
    </section>
  </div>
}

function App() {
  const [savedProgress] = useState(loadSavedProgress)
  const [screen, setScreen] = useState<AppScreen | 'welcome' | 'onboarding'>(savedProgress.onboarded ? 'dashboard' : 'welcome')
  const [onboarded, setOnboarded] = useState(savedProgress.onboarded)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(savedProgress.selectedGoal)
  const [dailyTarget, setDailyTarget] = useState(savedProgress.dailyTarget)
  const [preferredMinutes, setPreferredMinutes] = useState(savedProgress.preferredMinutes)
  const [xp, setXp] = useState(savedProgress.xp)
  const [level, setLevel] = useState(savedProgress.level)
  const [streak, setStreak] = useState(savedProgress.streak)
  const [longestStreak, setLongestStreak] = useState(savedProgress.longestStreak)
  const [sessions, setSessions] = useState(savedProgress.sessions)
  const [focusHistory, setFocusHistory] = useState<Record<string, number>>(savedProgress.focusHistory)
  const [quests, setQuests] = useState(savedProgress.quests)
  const [lastActiveDate, setLastActiveDate] = useState<string | null>(savedProgress.lastActiveDate)
  const [showReset, setShowReset] = useState(false)
  const [notice, setNotice] = useState('')
  const [studySpaceToOpen, setStudySpaceToOpen] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [showAccount, setShowAccount] = useState(false)
  const [email, setEmail] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [accountMessage, setAccountMessage] = useState('')
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null)
  const [canImportLocalForUser, setCanImportLocalForUser] = useState(false)
  const [recentFocusSessions, setRecentFocusSessions] = useState<FocusSessionRecord[]>([])
  const [focusSessionsLoading, setFocusSessionsLoading] = useState(false)
  const initialAccountSync = useRef(true)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) setShowAccount(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !user) {
      setHydratedUserId(null)
      setCanImportLocalForUser(false)
      return
    }
    let active = true
    setHydratedUserId(null)
    setAccountMessage('Syncing your progress…')
    void (async () => {
      const { data, error } = await supabase.from('user_progress').select('progress').eq('user_id', user.id).maybeSingle()
      if (error) throw error
      if (!active) return
      if (data?.progress && typeof data.progress === 'object' && !Array.isArray(data.progress)) {
        setCanImportLocalForUser(false)
        const remote = data.progress as Partial<SavedProgress>
        setOnboarded(typeof remote.onboarded === 'boolean' ? remote.onboarded : savedProgress.onboarded)
        setSelectedGoal(isGoal(remote.selectedGoal) ? remote.selectedGoal : savedProgress.selectedGoal)
        setDailyTarget([20, 30, 45, 60].includes(remote.dailyTarget ?? -1) ? remote.dailyTarget! : savedProgress.dailyTarget)
        setPreferredMinutes([5, 15, 25].includes(remote.preferredMinutes ?? -1) ? remote.preferredMinutes! : savedProgress.preferredMinutes)
        setXp(Number.isFinite(remote.xp) && remote.xp! >= 0 ? remote.xp! : savedProgress.xp)
        setLevel(Number.isFinite(remote.level) && remote.level! >= 1 ? remote.level! : savedProgress.level)
        setStreak(Number.isFinite(remote.streak) && remote.streak! >= 0 ? remote.streak! : savedProgress.streak)
        setLongestStreak(Number.isFinite(remote.longestStreak) && remote.longestStreak! >= 0 ? remote.longestStreak! : savedProgress.longestStreak)
        setSessions(Number.isFinite(remote.sessions) && remote.sessions! >= 0 ? remote.sessions! : savedProgress.sessions)
        setFocusHistory(remote.focusHistory && typeof remote.focusHistory === 'object' ? remote.focusHistory : savedProgress.focusHistory)
        setQuests(Array.isArray(remote.quests) ? remote.quests : savedProgress.quests)
        setLastActiveDate(typeof remote.lastActiveDate === 'string' ? remote.lastActiveDate : savedProgress.lastActiveDate)
        setScreen(remote.onboarded ? 'dashboard' : 'welcome')
      } else if (initialAccountSync.current) {
        setCanImportLocalForUser(true)
        const progress: SavedProgress = { onboarded, selectedGoal, dailyTarget, preferredMinutes, xp, level, streak, longestStreak, sessions, focusHistory, quests, savedDay: dayKey(new Date()), lastActiveDate }
        const { error: saveError } = await supabase.from('user_progress').upsert({ user_id: user.id, progress })
        if (saveError) throw saveError
      } else {
        setCanImportLocalForUser(false)
        setOnboarded(false)
        setSelectedGoal(null)
        setXp(0); setLevel(1); setStreak(0); setLongestStreak(0); setSessions(0)
        setFocusHistory({}); setQuests(initialQuests); setLastActiveDate(null)
        setScreen('welcome')
      }
      initialAccountSync.current = false
      setHydratedUserId(user.id)
      setAccountMessage('Your account is ready to sync.')
    })().catch((error: unknown) => {
      if (!active) return
      setAccountMessage(error instanceof Error ? `Sync issue: ${error.message}` : 'Could not sync your account data.')
    })
    return () => { active = false }
  // Local state is intentionally captured once for the first account's local-to-cloud migration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    const progress: SavedProgress = {
      onboarded,
      selectedGoal,
      dailyTarget,
      preferredMinutes,
      xp,
      level,
      streak,
      longestStreak,
      sessions,
      focusHistory,
      quests,
      savedDay: dayKey(new Date()),
      lastActiveDate,
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(progress))
    } catch {
      setNotice('Progress could not be saved in this browser.')
      window.setTimeout(() => setNotice(''), 3000)
    }
    const supabaseClient = supabase
    if (supabaseClient && user && hydratedUserId === user.id) {
      const syncProgress = window.setTimeout(() => {
        void supabaseClient.from('user_progress').upsert({ user_id: user.id, progress, updated_at: new Date().toISOString() }).then(({ error }) => {
          setAccountMessage(error ? 'Cloud sync paused. Your device copy is safe.' : 'Synced just now.')
        })
      }, 650)
      return () => window.clearTimeout(syncProgress)
    }
  }, [onboarded, selectedGoal, dailyTarget, preferredMinutes, xp, level, streak, longestStreak, sessions, focusHistory, quests, lastActiveDate, user?.id, hydratedUserId])

  useEffect(() => {
    if (!hydratedUserId) {
      setRecentFocusSessions([])
      setFocusSessionsLoading(false)
      return
    }
    let active = true
    setFocusSessionsLoading(true)
    void Promise.all([fetchFocusSessions(hydratedUserId), fetchFocusSessionMetrics(hydratedUserId)]).then(([records, metrics]) => {
      if (!active) return
      setRecentFocusSessions(records)
      setSessions((current) => Math.max(current, metrics.sessions))
      setFocusHistory((current) => {
        const merged = { ...current }
        for (const [date, minutes] of Object.entries(metrics.focusHistory)) {
          merged[date] = Math.max(merged[date] ?? 0, minutes)
        }
        return merged
      })
    }).catch((error: unknown) => {
      if (active) setAccountMessage(error instanceof Error ? `Could not load session history: ${error.message}` : 'Could not load session history.')
    }).finally(() => {
      if (active) setFocusSessionsLoading(false)
    })
    return () => { active = false }
  }, [hydratedUserId])

  async function requestSignInLink() {
    if (!supabase) return
    setAuthBusy(true)
    setAccountMessage('Sending your sign-in link…')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    setAccountMessage(error ? error.message : 'Check your email for your secure sign-in link.')
    setAuthBusy(false)
  }

  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    setAccountMessage(error ? error.message : 'Signed out. Your device copy is still here.')
    setShowAccount(false)
  }

  function awardXp(amount: number) {
    const total = xp + amount
    if (total >= 500) setLevel((currentLevel) => currentLevel + Math.floor(total / 500))
    setXp(total % 500)
  }

  function recordDailyActivity() {
    const today = dayKey(new Date())
    if (lastActiveDate === today) return
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const nextStreak = lastActiveDate === dayKey(yesterday) ? streak + 1 : 1
    setStreak(nextStreak)
    setLongestStreak((current) => Math.max(current, nextStreak))
    setLastActiveDate(today)
  }

  function completeQuest(id: string) {
    const quest = quests.find((item) => item.id === id)
    if (!quest || quest.completed) return
    recordDailyActivity()
    setQuests((current) => current.map((item) => item.id === id ? { ...item, completed: true } : item))
    awardXp(quest.xp)
    setNotice(`+${quest.xp} XP · nicely done`)
    window.setTimeout(() => setNotice(''), 2300)
  }

  function completeFocusSession(sessionMinutes: number, topic: string) {
    const focusQuestAlreadyCompleted = quests.find((quest) => quest.id === 'focus')?.completed ?? false
    if (focusQuestAlreadyCompleted) recordDailyActivity()
    setSessions((current) => current + 1)
    const today = dayKey(new Date())
    setFocusHistory((history) => ({ ...history, [today]: (history[today] ?? 0) + sessionMinutes }))
    completeQuest('focus')
    if (focusQuestAlreadyCompleted) awardXp(25)
    if (user && hydratedUserId === user.id) {
      void saveFocusSession(user.id, sessionMinutes, topic).then(async () => {
        const records = await fetchFocusSessions(user.id)
        setRecentFocusSessions(records)
        setAccountMessage('Session saved to your account.')
      }).catch((error: unknown) => {
        setAccountMessage(error instanceof Error ? `Session stayed on this device: ${error.message}` : 'Session stayed on this device; cloud save failed.')
      })
    }
  }

  function beginDashboard() {
    if (!selectedGoal) return
    const firstMissions: Record<Goal, { title: string; detail: string }> = {
      study: { title: 'Open your study space', detail: 'Start with whatever you need today.' },
      exams: { title: 'Review one exam topic', detail: 'Choose one thing you’d like to know better.' },
      routine: { title: 'Set up a small study cue', detail: 'Put the first thing you need within reach.' },
      focus: { title: 'Choose one thing to focus on', detail: 'Keep your attention on just this.' },
    }
    setQuests((current) => current.map((quest) => {
      if (quest.id === 'open') return { ...quest, ...firstMissions[selectedGoal] }
      if (quest.id === 'focus') return { ...quest, detail: `Try a ${preferredMinutes}-minute focus session.` }
      return quest
    }))
    setOnboarded(true)
    setScreen('dashboard')
  }

  function resetStreak() {
    setStreak(1)
    setLongestStreak((current) => Math.max(current, 1))
    setLastActiveDate(dayKey(new Date()))
    setShowReset(false)
    setNotice('Fresh start. Your progress is still yours.')
    window.setTimeout(() => setNotice(''), 3000)
  }

  if (screen === 'welcome') return <><WelcomeScreen onStart={() => setScreen('onboarding')} onSignIn={() => setShowAccount(true)}/>{showAccount && <AccountDialog user={user} email={email} setEmail={setEmail} busy={authBusy} message={accountMessage} onClose={() => setShowAccount(false)} onSignIn={requestSignInLink} onSignOut={signOut}/>}</>
  if (screen === 'onboarding') return <OnboardingScreen selectedGoal={selectedGoal} onSelect={setSelectedGoal} dailyTarget={dailyTarget} onDailyTarget={setDailyTarget} preferredMinutes={preferredMinutes} onPreferredMinutes={setPreferredMinutes} onContinue={beginDashboard} onBack={() => setScreen('welcome')}/>

  const currentScreen = screen as AppScreen
  const lastStudySpace = getLastStudySpaceSummary()
  return <div className="min-h-screen bg-[#0D0D12] text-[#F5F3FA]">
    <div className="flex min-h-screen">
      <Navigation screen={currentScreen} user={user} onNavigate={setScreen} onAccount={() => setShowAccount(true)}/>
      <main className={`min-w-0 flex-1 ${currentScreen === 'focus' ? 'pb-[84px] md:pb-3' : 'pb-[98px] md:pb-10'}`}>
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[.06] bg-[#0D0D12]/90 px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-11">
          <div className="flex items-center gap-3 md:hidden"><Brand iconOnly/><span className="text-[15px] font-semibold tracking-[-.04em]">comeback<span className="text-[#8B5CF6]">.</span></span></div>
          <div className="hidden text-xs text-[#817B8F] md:block">Comeback <span className="mx-2 text-[#4F4A58]">/</span><span className="text-[#D7D3DF]">{navItems.find((item) => item.screen === currentScreen)?.label}</span></div>
          <div className="flex items-center gap-3"><span className="hidden text-xs text-[#817B8F] sm:block">One step at a time</span><button onClick={() => setShowAccount(true)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[.1] bg-[#201C2B] text-[11px] font-semibold text-[#C7B4FF]" aria-label={user ? `Account: ${user.email}` : 'Sign in and sync'}>{user ? (user.email?.slice(0, 1).toUpperCase() ?? 'Y') : 'Y'}</button></div>
        </header>
        <div className={`mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-11 ${currentScreen === 'focus' ? 'pt-5 sm:pt-6 lg:pt-4' : 'pt-8 sm:pt-10'}`}>
          {currentScreen === 'dashboard' && <DashboardScreen goal={selectedGoal ? goalLabels[selectedGoal] : goalLabels.study} dailyTarget={dailyTarget} preferredMinutes={preferredMinutes} xp={xp} level={level} streak={streak} sessions={sessions} focusHistory={focusHistory} quests={quests} lastStudySpace={lastStudySpace} onCompleteQuest={completeQuest} onFocus={() => setScreen('focus')} onContinueStudy={(id) => { setStudySpaceToOpen(id); setScreen('focus') }} onJourney={() => setScreen('journey')} onReset={() => setShowReset(true)}/>}
          {currentScreen === 'focus' && <FocusScreen userId={hydratedUserId} canImportLocal={canImportLocalForUser} initialMinutes={preferredMinutes} initialStudySpaceId={studySpaceToOpen} onStudySpaceOpened={() => setStudySpaceToOpen(null)} onBack={() => setScreen('dashboard')} onSessionComplete={completeFocusSession}/>}
          {currentScreen === 'journey' && <JourneyScreen xp={xp} level={level} streak={streak} longestStreak={longestStreak} sessions={sessions} focusHistory={focusHistory} recentSessions={recentFocusSessions} signedIn={Boolean(hydratedUserId)} sessionsLoading={focusSessionsLoading} quests={quests} onReset={() => setShowReset(true)} onFocus={() => setScreen('focus')}/>}
        </div>
      </main>
    </div>
    {showReset && <MissedDayDialog onClose={() => setShowReset(false)} onReset={resetStreak}/>}
    {showAccount && <AccountDialog user={user} email={email} setEmail={setEmail} busy={authBusy} message={accountMessage} onClose={() => setShowAccount(false)} onSignIn={requestSignInLink} onSignOut={signOut}/>}
    {notice && <div role="status" className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full border border-[#8B5CF6]/30 bg-[#241D32] px-5 py-3 text-sm font-medium text-[#E8DDFF] shadow-xl md:bottom-7">{notice}</div>}
  </div>
}

function AccountDialog({ user, email, setEmail, busy, message, onClose, onSignIn, onSignOut }: { user: User | null; email: string; setEmail: (value: string) => void; busy: boolean; message: string; onClose: () => void; onSignIn: () => void; onSignOut: () => void }) {
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="account-title" className="w-full max-w-[420px] rounded-[24px] border border-white/[.09] bg-[#201C2B] p-6 shadow-[0_28px_100px_rgba(0,0,0,.55)] sm:p-8">
      <button onClick={onClose} className="float-right rounded-lg px-2 py-1 text-sm text-[#9690A1] hover:bg-white/[.05]" aria-label="Close">✕</button>
      <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#A78BFA]">Comeback account</div>
      <h2 id="account-title" className="mt-2 text-[24px] font-semibold tracking-[-.045em]">Keep your progress with you.</h2>
      {!isSupabaseConfigured ? <p className="mt-3 text-sm leading-6 text-[#A3A3A8]">Account sync needs a Supabase project. Add its project URL and publishable key to <code className="text-[#D8CBFF]">.env</code> after setup; this demo continues saving on this device.</p> : user ? <><p className="mt-3 break-all text-sm text-[#D8CBFF]">{user.email}</p><p className="mt-2 text-xs leading-5 text-[#A3A3A8]">Progress and study spaces sync to your account.</p><button onClick={onSignOut} className="mt-6 w-full rounded-xl border border-white/[.09] px-4 py-3 text-sm font-medium text-[#B8B4C0] hover:bg-white/[.04]">Sign out</button></> : <>
        <p className="mt-3 text-sm leading-6 text-[#A3A3A8]">Enter your email and we’ll send a secure sign-in link. Your existing device progress will be copied to your account the first time.</p>
        <form onSubmit={(event) => { event.preventDefault(); onSignIn() }} className="mt-5"><label htmlFor="account-email" className="mb-2 block text-xs text-[#B8B4C0]">Email address</label><input id="account-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-white/[.09] bg-[#17151E] px-4 py-3 text-sm outline-none placeholder:text-[#706A7C] focus:border-[#8B5CF6]/60"/><button disabled={busy} className="mt-3 w-full rounded-xl bg-[#8B5CF6] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#9B70F8] disabled:opacity-50">{busy ? 'Sending…' : 'Email me a sign-in link'}</button></form>
      </>}
      {message && <p role="status" className="mt-4 text-xs leading-5 text-[#C4BECE]">{message}</p>}
    </section>
  </div>
}

export default App
