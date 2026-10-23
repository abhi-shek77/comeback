import { useEffect, useState } from 'react'
import { DashboardScreen } from './components/DashboardScreen'
import { FocusScreen } from './components/FocusScreen'
import { Icon, type IconName } from './components/Icons'
import { JourneyScreen } from './components/JourneyScreen'
import { OnboardingScreen } from './components/OnboardingScreen'
import { WelcomeScreen } from './components/WelcomeScreen'

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

function Navigation({ screen, onNavigate }: { screen: AppScreen; onNavigate: (screen: AppScreen) => void }) {
  const navButton = (item: typeof navItems[number]) => <button key={item.screen} onClick={() => onNavigate(item.screen)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${screen === item.screen ? 'bg-[#8B5CF6]/[.14] font-medium text-[#C7B4FF]' : 'text-[#9690A1] hover:bg-white/[.045] hover:text-[#E9E6EF]'}`}><Icon name={item.icon} size={17}/>{item.label}</button>
  return <>
    <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 self-start flex-col border-r border-white/[.065] px-5 py-6 md:flex">
      <div className="px-2"><Brand/></div>
      <div className="mt-11 px-3 text-[10px] font-semibold uppercase tracking-[.17em] text-[#6E6879]">Your space</div>
      <nav className="mt-3 space-y-1">{navItems.map(navButton)}</nav>
      <div className="mt-auto rounded-2xl border border-[#8B5CF6]/15 bg-[#8B5CF6]/[.065] p-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B5CF6]/15 text-[#BFAAFF]"><Icon name="spark" size={15}/></span>
        <div className="mt-3 text-sm font-medium">You’re finding your way.</div><p className="mt-1.5 text-xs leading-5 text-[#9690A1]">Small steps are still steps forward.</p>
      </div>
      <div className="mt-5 flex items-center gap-3 px-2"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#302A3C] text-xs font-semibold text-[#D0C3E9]">Y</div><div><div className="text-xs font-medium text-[#E4E0E9]">Your comeback</div><div className="mt-0.5 text-[10px] text-[#817B8F]">A fresh start</div></div><span className="ml-auto text-[#817B8F]">···</span></div>
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
  }, [onboarded, selectedGoal, dailyTarget, preferredMinutes, xp, level, streak, longestStreak, sessions, focusHistory, quests, lastActiveDate])

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

  function completeFocusSession(sessionMinutes: number) {
    const focusQuestAlreadyCompleted = quests.find((quest) => quest.id === 'focus')?.completed ?? false
    if (focusQuestAlreadyCompleted) recordDailyActivity()
    setSessions((current) => current + 1)
    const today = dayKey(new Date())
    setFocusHistory((history) => ({ ...history, [today]: (history[today] ?? 0) + sessionMinutes }))
    completeQuest('focus')
    if (focusQuestAlreadyCompleted) awardXp(25)
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

  if (screen === 'welcome') return <WelcomeScreen onStart={() => setScreen('onboarding')}/>
  if (screen === 'onboarding') return <OnboardingScreen selectedGoal={selectedGoal} onSelect={setSelectedGoal} dailyTarget={dailyTarget} onDailyTarget={setDailyTarget} preferredMinutes={preferredMinutes} onPreferredMinutes={setPreferredMinutes} onContinue={beginDashboard} onBack={() => setScreen('welcome')}/>

  const currentScreen = screen as AppScreen
  const lastStudySpace = getLastStudySpaceSummary()
  return <div className="min-h-screen bg-[#0D0D12] text-[#F5F3FA]">
    <div className="flex min-h-screen">
      <Navigation screen={currentScreen} onNavigate={setScreen}/>
      <main className={`min-w-0 flex-1 ${currentScreen === 'focus' ? 'pb-[84px] md:pb-3' : 'pb-[98px] md:pb-10'}`}>
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[.06] bg-[#0D0D12]/90 px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-11">
          <div className="flex items-center gap-3 md:hidden"><Brand iconOnly/><span className="text-[15px] font-semibold tracking-[-.04em]">comeback<span className="text-[#8B5CF6]">.</span></span></div>
          <div className="hidden text-xs text-[#817B8F] md:block">Comeback <span className="mx-2 text-[#4F4A58]">/</span><span className="text-[#D7D3DF]">{navItems.find((item) => item.screen === currentScreen)?.label}</span></div>
          <div className="flex items-center gap-3"><span className="hidden text-xs text-[#817B8F] sm:block">One step at a time</span><div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[.1] bg-[#201C2B] text-[11px] font-semibold text-[#C7B4FF]">Y</div></div>
        </header>
        <div className={`mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-11 ${currentScreen === 'focus' ? 'pt-5 sm:pt-6 lg:pt-4' : 'pt-8 sm:pt-10'}`}>
          {currentScreen === 'dashboard' && <DashboardScreen goal={selectedGoal ? goalLabels[selectedGoal] : goalLabels.study} dailyTarget={dailyTarget} preferredMinutes={preferredMinutes} xp={xp} level={level} streak={streak} sessions={sessions} focusHistory={focusHistory} quests={quests} lastStudySpace={lastStudySpace} onCompleteQuest={completeQuest} onFocus={() => setScreen('focus')} onContinueStudy={(id) => { setStudySpaceToOpen(id); setScreen('focus') }} onJourney={() => setScreen('journey')} onReset={() => setShowReset(true)}/>}
          {currentScreen === 'focus' && <FocusScreen initialMinutes={preferredMinutes} initialStudySpaceId={studySpaceToOpen} onStudySpaceOpened={() => setStudySpaceToOpen(null)} onBack={() => setScreen('dashboard')} onSessionComplete={completeFocusSession}/>}
          {currentScreen === 'journey' && <JourneyScreen xp={xp} level={level} streak={streak} longestStreak={longestStreak} sessions={sessions} focusHistory={focusHistory} quests={quests} onReset={() => setShowReset(true)} onFocus={() => setScreen('focus')}/>}
        </div>
      </main>
    </div>
    {showReset && <MissedDayDialog onClose={() => setShowReset(false)} onReset={resetStreak}/>}
    {notice && <div role="status" className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full border border-[#8B5CF6]/30 bg-[#241D32] px-5 py-3 text-sm font-medium text-[#E8DDFF] shadow-xl md:bottom-7">{notice}</div>}
  </div>
}

export default App
