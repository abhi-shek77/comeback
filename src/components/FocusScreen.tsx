import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icons'

const presets = [5, 15, 25]
const focusQuotes = [
  'You only need to meet this moment.',
  'Small attention adds up to real progress.',
  'Begin where you are. That is enough.',
  'One page, one problem, one breath at a time.',
  'You are allowed to find your rhythm slowly.',
  'Showing up is a skill you are building.',
]
const workspaceStorageKey = 'comeback-study-workspace-v1'
const lessonSteps = [
  { id: 'watch', label: 'Watch the lesson' },
  { id: 'capture', label: 'Capture the key ideas' },
  { id: 'recall', label: 'Recall it in your own words' },
]
type WorkspaceTool = 'notes' | 'recall' | 'next'
type WorkspaceData = { id: string; topic: string; youtubeUrl: string; notes: string; recall: string; next: string; completedSteps: string[]; focusedMinutes: number }
type WorkspaceLibrary = { lessons: WorkspaceData[]; activeId: string }
type CompletedStudySession = { workspaceId: string; topic: string; minutes: number }

function createWorkspace(): WorkspaceData {
  return { id: `study-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, topic: '', youtubeUrl: '', notes: '', recall: '', next: '', completedSteps: [], focusedMinutes: 0 }
}

function normalizeWorkspace(saved: Partial<WorkspaceData>, index: number): WorkspaceData {
  return {
    id: typeof saved.id === 'string' && saved.id ? saved.id : `saved-${index}`,
    topic: typeof saved.topic === 'string' ? saved.topic : '',
    youtubeUrl: typeof saved.youtubeUrl === 'string' ? saved.youtubeUrl : '',
    notes: typeof saved.notes === 'string' ? saved.notes : '',
    recall: typeof saved.recall === 'string' ? saved.recall : '',
    next: typeof saved.next === 'string' ? saved.next : '',
    completedSteps: Array.isArray(saved.completedSteps) ? saved.completedSteps.filter((step): step is string => lessonSteps.some((lessonStep) => lessonStep.id === step)) : [],
    focusedMinutes: Number.isFinite(saved.focusedMinutes) && saved.focusedMinutes! >= 0 ? Math.floor(saved.focusedMinutes!) : 0,
  }
}

function loadWorkspaceLibrary(): WorkspaceLibrary {
  try {
    const saved = JSON.parse(window.localStorage.getItem(workspaceStorageKey) ?? 'null') as (Partial<WorkspaceLibrary> & Partial<WorkspaceData>) | null
    if (!saved) {
      const first = createWorkspace()
      return { lessons: [first], activeId: first.id }
    }
    if (Array.isArray(saved.lessons)) {
      const lessons = saved.lessons.filter((lesson) => Boolean(lesson && typeof lesson === 'object')).map(normalizeWorkspace)
      if (lessons.length) return { lessons, activeId: lessons.some((lesson) => lesson.id === saved.activeId) ? saved.activeId! : lessons[0].id }
    }
    // Migrate the previous single-workspace format into the new lesson library.
    const first = normalizeWorkspace(saved, 0)
    return { lessons: [first], activeId: first.id }
  } catch {
    const first = createWorkspace()
    return { lessons: [first], activeId: first.id }
  }
}

function youtubeVideoId(url: string) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    const id = host === 'youtu.be'
      ? parsed.pathname.split('/').filter(Boolean)[0]
      : host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com'
        ? parsed.searchParams.get('v') ?? parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1]
        : null
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}

export function FocusScreen({ initialMinutes, initialStudySpaceId, onStudySpaceOpened, onBack, onSessionComplete }: { initialMinutes: number; initialStudySpaceId: string | null; onStudySpaceOpened: () => void; onBack: () => void; onSessionComplete: (minutes: number) => void }) {
  const [minutes, setMinutes] = useState(initialMinutes)
  const [secondsLeft, setSecondsLeft] = useState(initialMinutes * 60)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [topic, setTopic] = useState('No specific task')
  const [immersive, setImmersive] = useState(false)
  const [quoteIndex, setQuoteIndex] = useState(0)
  const lastQuoteMilestone = useRef(0)
  const [workspaceTab, setWorkspaceTab] = useState<'focus' | 'study'>('focus')
  const [workspaceLibrary, setWorkspaceLibrary] = useState<WorkspaceLibrary>(loadWorkspaceLibrary)
  const workspace = workspaceLibrary.lessons.find((lesson) => lesson.id === workspaceLibrary.activeId) ?? workspaceLibrary.lessons[0]
  const [activeTool, setActiveTool] = useState<WorkspaceTool>('notes')
  const [sessionWorkspaceId, setSessionWorkspaceId] = useState<string | null>(null)
  const [sessionTopic, setSessionTopic] = useState('')
  const [completedStudySession, setCompletedStudySession] = useState<CompletedStudySession | null>(null)
  const totalSeconds = minutes * 60
  const elapsedSeconds = totalSeconds - secondsLeft
  const progress = elapsedSeconds / totalSeconds
  const circumference = 2 * Math.PI * 105
  const displayTime = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`

  useEffect(() => {
    if (!running) return
    const interval = window.setInterval(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000)
    return () => window.clearInterval(interval)
  }, [running])

  useEffect(() => {
    if (!running || secondsLeft !== 0) return
    setRunning(false)
    setFinished(true)
    if (sessionWorkspaceId) {
      setWorkspaceLibrary((current) => ({ ...current, lessons: current.lessons.map((lesson) => lesson.id === sessionWorkspaceId ? { ...lesson, focusedMinutes: lesson.focusedMinutes + minutes } : lesson) }))
      setCompletedStudySession({ workspaceId: sessionWorkspaceId, topic: sessionTopic, minutes })
      setSessionWorkspaceId(null)
    } else {
      setCompletedStudySession(null)
    }
    onSessionComplete(minutes)
  }, [secondsLeft, running, minutes, onSessionComplete, sessionWorkspaceId, sessionTopic])

  useEffect(() => {
    const milestone = Math.floor(elapsedSeconds / 300)
    if (running && milestone > lastQuoteMilestone.current) {
      const milestonesPassed = milestone - lastQuoteMilestone.current
      lastQuoteMilestone.current = milestone
      setQuoteIndex((current) => (current + milestonesPassed) % focusQuotes.length)
    }
  }, [elapsedSeconds, running])

  useEffect(() => {
    if (!immersive) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setImmersive(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [immersive])

  useEffect(() => {
    try {
      window.localStorage.setItem(workspaceStorageKey, JSON.stringify(workspaceLibrary))
    } catch {
      // The workspace remains usable for this session if browser storage is unavailable.
    }
  }, [workspaceLibrary])

  useEffect(() => {
    if (!initialStudySpaceId) return
    setWorkspaceLibrary((current) => current.lessons.some((lesson) => lesson.id === initialStudySpaceId) ? { ...current, activeId: initialStudySpaceId } : current)
    setWorkspaceTab('study')
    onStudySpaceOpened()
  }, [initialStudySpaceId, onStudySpaceOpened])

  function chooseMinutes(nextMinutes: number) {
    setRunning(false)
    setFinished(false)
    setSessionWorkspaceId(null)
    setCompletedStudySession(null)
    setMinutes(nextMinutes)
    setSecondsLeft(nextMinutes * 60)
    setQuoteIndex(0)
    lastQuoteMilestone.current = 0
  }

  function resetTimer() {
    setRunning(false)
    setFinished(false)
    setSessionWorkspaceId(null)
    setCompletedStudySession(null)
    setSecondsLeft(totalSeconds)
    setQuoteIndex(0)
    lastQuoteMilestone.current = 0
  }

  function startWorkspaceFocus() {
    const studyTopic = workspace.topic.trim() || 'Independent study'
    setTopic(studyTopic)
    setSessionTopic(studyTopic)
    setMinutes(initialMinutes)
    setSecondsLeft(initialMinutes * 60)
    setQuoteIndex(0)
    lastQuoteMilestone.current = 0
    setFinished(false)
    setSessionWorkspaceId(workspace.id)
    setCompletedStudySession(null)
    setWorkspaceTab('focus')
    setRunning(true)
  }

  function toggleTimer() {
    if (!running && !sessionWorkspaceId) setCompletedStudySession(null)
    setRunning((current) => !current)
  }

  function returnToStudySpace() {
    if (!completedStudySession) return
    setWorkspaceLibrary((current) => current.lessons.some((lesson) => lesson.id === completedStudySession.workspaceId)
      ? { ...current, activeId: completedStudySession.workspaceId }
      : current)
    setWorkspaceTab('study')
    setFinished(false)
    setImmersive(false)
  }

  const timerFace = (size = 'normal') => <div className={`focus-clock relative flex shrink-0 items-center justify-center ${size === 'immersive' ? 'h-[min(54vw,40svh,330px)] w-[min(54vw,40svh,330px)]' : 'mt-4 h-[210px] w-[210px] sm:h-[220px] sm:w-[220px]'}`}><svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full"><circle cx="120" cy="120" r="105" fill="none" stroke="rgba(255,255,255,.075)" strokeWidth="2"/><circle cx="120" cy="120" r="105" fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * progress} className="timer-ring"/></svg><div className="relative"><div className={`timer-digits font-medium leading-none tracking-[-.065em] ${size === 'immersive' ? 'text-[clamp(3rem,9vw,5.5rem)]' : 'text-[50px] sm:text-[56px]'}`}>{displayTime}</div><div className="focus-clock-label mt-2 text-[10px] font-medium uppercase tracking-[.19em] text-[#817B8F]">{running ? 'Breathe & begin' : 'Ready when you are'}</div></div></div>

  const timerControls = (immersiveMode = false) => <><div className={`focus-presets relative flex items-center gap-2 rounded-xl border border-white/[.07] bg-[#17151E]/70 p-1 ${immersiveMode ? 'mt-7' : 'mt-4'}`}>{presets.map((preset) => <button key={preset} onClick={() => chooseMinutes(preset)} className={`focus-preset-option min-w-[76px] rounded-lg px-4 py-2 text-xs font-medium transition ${minutes === preset ? 'bg-[#8B5CF6]/20 text-[#D8CBFF]' : 'text-[#8D8798] hover:text-white'}`}>{preset} min</button>)}</div><div className="focus-controls relative mt-3 flex items-center gap-2"><button disabled={secondsLeft === 0 && !running} onClick={toggleTimer} className="inline-flex min-w-[145px] items-center justify-center gap-2 rounded-xl bg-[#8B5CF6] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#9B70F8] disabled:cursor-not-allowed disabled:opacity-45"><Icon name={running ? 'pause' : 'play'} size={14}/>{running ? 'Pause session' : finished ? 'Session complete' : 'Begin session'}</button><button aria-label="Reset timer" onClick={resetTimer} className="rounded-xl border border-white/[.09] p-2.5 text-[#A3A3A8] transition hover:bg-white/[.05]"><Icon name="reset" size={15}/></button></div></>

  const updateWorkspace = (key: keyof Omit<WorkspaceData, 'id' | 'completedSteps'>, value: string) => setWorkspaceLibrary((current) => ({ ...current, lessons: current.lessons.map((lesson) => lesson.id === current.activeId ? { ...lesson, [key]: value } : lesson) }))
  const createNewWorkspace = () => {
    const fresh = createWorkspace()
    setWorkspaceLibrary((current) => ({ lessons: [fresh, ...current.lessons], activeId: fresh.id }))
    setActiveTool('notes')
  }
  const lessonId = youtubeVideoId(workspace.youtubeUrl)
  const studyProgress = Math.round(workspace.completedSteps.length / lessonSteps.length * 100)
  const studyTools: { id: WorkspaceTool; label: string; prompt: string; placeholder: string }[] = [
    { id: 'notes', label: 'Notes', prompt: 'Capture the ideas worth keeping.', placeholder: 'Write a note while you learn…' },
    { id: 'recall', label: 'Recall', prompt: 'Close the lesson for a moment. What can you explain from memory?', placeholder: 'Explain the idea in your own words…' },
    { id: 'next', label: 'Next step', prompt: 'Choose one small action to make this knowledge stick.', placeholder: 'Try a practice question, teach it to someone…' },
  ]

  const sectionNavigation = <div className="mt-4 inline-flex rounded-xl border border-white/[.07] bg-[#17151E]/80 p-1" aria-label="Focus room views"><button onClick={() => setWorkspaceTab('focus')} className={`rounded-lg px-4 py-2 text-xs font-medium transition ${workspaceTab === 'focus' ? 'bg-[#8B5CF6]/20 text-[#D8CBFF]' : 'text-[#8D8798] hover:text-white'}`}>Focus timer</button><button onClick={() => setWorkspaceTab('study')} className={`rounded-lg px-4 py-2 text-xs font-medium transition ${workspaceTab === 'study' ? 'bg-[#8B5CF6]/20 text-[#D8CBFF]' : 'text-[#8D8798] hover:text-white'}`}>Study workspace</button></div>
  const completedLessonPanel = completedStudySession && <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-[#8B5CF6]/20 bg-[#8B5CF6]/[.07] p-4 text-left"><div className="text-[9px] font-semibold uppercase tracking-[.15em] text-[#BFAAFF]">Session added to your lesson</div><div className="mt-1.5 truncate text-sm font-semibold text-[#EAE7F0]">{completedStudySession.topic}</div><div className="mt-1 text-xs text-[#A3A3A8]">+{completedStudySession.minutes} focused minutes · progress saved</div></div>
  const completionContent = <div className="relative max-w-md"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#F5B942]/25 bg-[#F5B942]/[.1] text-[#F5B942]"><Icon name="star" size={28}/></div><div className="mt-6 text-[10px] font-semibold uppercase tracking-[.2em] text-[#F5B942]">Session complete</div><h1 className="mt-3 text-[clamp(2rem,5vw,3rem)] font-semibold leading-tight tracking-[-.06em]">You showed up for yourself.</h1><p aria-live="polite" className="mt-4 text-sm leading-6 text-[#A3A3A8]">“{focusQuotes[quoteIndex]}”</p><div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#F5B942]/20 bg-[#F5B942]/[.08] px-4 py-2 text-sm font-semibold text-[#F5CB69]"><Icon name="spark" size={15}/> +25 XP earned</div>{completedLessonPanel}<div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">{completedStudySession && <button onClick={returnToStudySpace} className="rounded-xl bg-[#8B5CF6] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#9B70F8]">Return to your lesson</button>}<button onClick={resetTimer} className="rounded-xl border border-white/[.09] px-5 py-3 text-xs font-medium text-[#B8B4C0] transition hover:bg-white/[.04]">Another little session</button><button onClick={() => immersive ? setImmersive(false) : onBack()} className="rounded-xl border border-white/[.09] px-5 py-3 text-xs font-medium text-[#B8B4C0] transition hover:bg-white/[.04]">{immersive ? 'Exit focus mode' : 'Back to today'}</button></div></div>

  if (!immersive && workspaceTab === 'study') return <div className="mx-auto max-w-[1080px] pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><button onClick={onBack} className="inline-flex items-center gap-2 text-xs text-[#9690A1] transition hover:text-white"><Icon name="back" size={15}/> Back to today</button><button onClick={() => { setWorkspaceTab('focus'); setImmersive(true) }} className="inline-flex items-center gap-2 rounded-lg border border-white/[.08] px-3 py-2 text-[11px] font-medium text-[#B8B4C0] transition hover:border-[#8B5CF6]/30 hover:text-white"><Icon name="maximize" size={13}/> Full screen timer</button></div>
    {sectionNavigation}
    <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#A78BFA]">A little room to learn</div><h1 className="mt-2 text-[30px] font-semibold tracking-[-.055em]">What do you want to study?</h1><p className="mt-2 text-[13px] text-[#A3A3A8]">Bring a lesson, make a few notes, and keep track of what’s sticking. Study spaces save automatically on this device.</p></div><div className="flex w-full max-w-[430px] items-end gap-2"><div className="min-w-0 flex-1"><label htmlFor="study-topic" className="mb-1.5 block text-[10px] font-medium text-[#9690A1]">Your study goal</label><input id="study-topic" value={workspace.topic} onChange={(event) => updateWorkspace('topic', event.target.value)} placeholder="e.g. Cell biology, derivatives…" className="w-full rounded-xl border border-white/[.08] bg-[#201C2B] px-3.5 py-3 text-sm text-[#F5F3FA] outline-none placeholder:text-[#6F697B] focus:border-[#8B5CF6]/50"/></div><button onClick={createNewWorkspace} className="mb-px inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#8B5CF6]/25 bg-[#8B5CF6]/[.08] px-3 py-3 text-xs font-medium text-[#D8CBFF] transition hover:bg-[#8B5CF6]/[.15]"><Icon name="spark" size={14}/> New lesson</button></div></div>
    {workspaceLibrary.lessons.length > 1 && <section className="mt-5"><div className="mb-2 flex items-center justify-between"><h2 className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#817B8F]">Your study spaces</h2><span className="text-[9px] text-[#706A7C]">Saved automatically</span></div><div className="flex gap-2 overflow-x-auto pb-1">{workspaceLibrary.lessons.map((lesson) => <button key={lesson.id} onClick={() => { setWorkspaceLibrary((current) => ({ ...current, activeId: lesson.id })); setActiveTool('notes') }} className={`min-w-[170px] max-w-[220px] flex-1 rounded-xl border px-3 py-2.5 text-left transition ${lesson.id === workspace.id ? 'border-[#8B5CF6]/35 bg-[#8B5CF6]/[.09]' : 'border-white/[.07] bg-[#201C2B] hover:border-white/[.14]'}`}><div className={`truncate text-xs font-medium ${lesson.id === workspace.id ? 'text-[#D8CBFF]' : 'text-[#D9D4E0]'}`}>{lesson.topic.trim() || 'Untitled study'}</div><div className="mt-1 truncate text-[9px] text-[#817B8F]">{lesson.focusedMinutes} min focused{lesson.youtubeUrl ? ' · lesson added' : ''}</div></button>)}</div></section>}
    <section className="mt-5 rounded-[20px] border border-white/[.07] bg-[#201C2B] p-4 sm:p-5"><div className="flex flex-wrap items-end gap-3"><div className="min-w-[220px] flex-1"><label htmlFor="youtube-url" className="mb-1.5 block text-[10px] font-medium text-[#9690A1]">YouTube lesson link</label><input id="youtube-url" value={workspace.youtubeUrl} onChange={(event) => updateWorkspace('youtubeUrl', event.target.value)} placeholder="Paste a YouTube video link" inputMode="url" className="w-full rounded-xl border border-white/[.08] bg-[#17151E] px-3.5 py-3 text-sm text-[#F5F3FA] outline-none placeholder:text-[#6F697B] focus:border-[#8B5CF6]/50"/></div>{workspace.youtubeUrl && !lessonId && <p role="status" className="pb-3 text-xs text-[#E9C35F]">Paste a valid YouTube video link to load the lesson.</p>}</div></section>
    <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
      <section className="overflow-hidden rounded-[20px] border border-white/[.07] bg-[#201C2B]"><div className="aspect-video bg-[#17151E]">{lessonId ? <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${lessonId}`} title={workspace.topic ? `${workspace.topic} lesson` : 'YouTube study lesson'} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/> : <div className="flex h-full flex-col items-center justify-center px-6 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[.07] bg-[#201C2B] text-[#A78BFA]"><Icon name="play" size={17}/></span><p className="mt-4 text-sm font-medium text-[#D9D4E0]">Your lesson will appear here</p><p className="mt-1.5 max-w-xs text-xs leading-5 text-[#817B8F]">Paste a YouTube link above to bring the video into your study space.</p></div>}</div><div className="flex flex-wrap items-center justify-between gap-3 p-4"><div><div className="text-[10px] font-medium uppercase tracking-[.12em] text-[#817B8F]">Now learning</div><div className="mt-1 text-sm font-medium text-[#E8E4ED]">{workspace.topic || 'Name your study goal'}</div><div className="mt-1 text-[10px] text-[#817B8F]">{workspace.focusedMinutes} min focused on this topic</div></div><button onClick={startWorkspaceFocus} className="inline-flex items-center gap-2 rounded-lg bg-[#8B5CF6]/[.12] px-3 py-2 text-[11px] font-medium text-[#CDBDFF] transition hover:bg-[#8B5CF6]/20"><Icon name="clock" size={13}/> Start a focus session</button></div></section>
      <div className="space-y-4"><section className="rounded-[20px] border border-white/[.07] bg-[#201C2B] p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#A78BFA]">Lesson progress</div><h2 className="mt-1.5 text-sm font-semibold">Learn it your way.</h2></div><span className="text-xs font-semibold text-[#CDBDFF]">{studyProgress}%</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-[#8B5CF6] transition-[width]" style={{ width: `${studyProgress}%` }}/></div><div className="mt-2 text-[10px] text-[#817B8F]">{workspace.focusedMinutes} min focused on this topic</div><div className="mt-3 space-y-2">{lessonSteps.map((step) => { const complete = workspace.completedSteps.includes(step.id); return <button key={step.id} onClick={() => setWorkspaceLibrary((current) => ({ ...current, lessons: current.lessons.map((lesson) => lesson.id === workspace.id ? { ...lesson, completedSteps: complete ? lesson.completedSteps.filter((id) => id !== step.id) : [...lesson.completedSteps, step.id] } : lesson) }))} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[.03]"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${complete ? 'border-[#8B5CF6] bg-[#8B5CF6] text-white' : 'border-white/[.16] text-transparent'}`}><Icon name="check" size={12}/></span><span className={`text-xs ${complete ? 'text-[#BEB5CD] line-through decoration-white/30' : 'text-[#D9D4E0]'}`}>{step.label}</span></button> })}</div></section>
        <section className="rounded-[20px] border border-white/[.07] bg-[#201C2B] p-4 sm:p-5"><div className="flex items-center gap-2"><Icon name="spark" size={15} className="text-[#F5B942]"/><h2 className="text-sm font-semibold">Learning tools</h2></div><div className="mt-4 flex gap-1 rounded-lg bg-[#17151E] p-1">{studyTools.map((tool) => <button key={tool.id} onClick={() => setActiveTool(tool.id)} className={`flex-1 rounded-md px-2 py-2 text-[10px] font-medium transition ${activeTool === tool.id ? 'bg-[#302A3C] text-[#D8CBFF]' : 'text-[#817B8F] hover:text-white'}`}>{tool.label}</button>)}</div><label className="mt-4 block text-[11px] leading-5 text-[#A3A3A8]" htmlFor="study-tool-input">{studyTools.find((tool) => tool.id === activeTool)?.prompt}</label><textarea id="study-tool-input" value={workspace[activeTool]} onChange={(event) => updateWorkspace(activeTool, event.target.value)} placeholder={studyTools.find((tool) => tool.id === activeTool)?.placeholder} rows={5} className="mt-2 w-full resize-y rounded-xl border border-white/[.07] bg-[#17151E] px-3.5 py-3 text-xs leading-5 text-[#E8E4ED] outline-none placeholder:text-[#706A7C] focus:border-[#8B5CF6]/50"/><div className="mt-2 text-right text-[9px] text-[#706A7C]">Saved on this device</div></section></div>
    </div>
  </div>

  if (immersive) return <div className="fixed inset-0 z-50 flex min-h-[100svh] flex-col items-center justify-center overflow-y-auto bg-[#0D0D12] px-5 py-8 text-center"><button onClick={() => setImmersive(false)} className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-xl border border-white/[.09] px-3 py-2 text-xs text-[#A3A3A8] transition hover:bg-white/[.05] hover:text-white"><Icon name="back" size={14}/> Exit focus mode</button>{!finished ? <><div className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#A78BFA]">{topic === 'No specific task' ? 'Your focus room' : topic}</div>{timerFace('immersive')}<p aria-live="polite" className="mt-5 max-w-md text-base leading-7 text-[#C4BECE] sm:text-lg">“{focusQuotes[quoteIndex]}”</p>{timerControls(true)}<div className="mt-5 text-[10px] text-[#716B7D]">A new thought for you every five minutes</div></> : completionContent}</div>

  return <div className="mx-auto max-w-[1080px] pb-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><button onClick={onBack} className="inline-flex items-center gap-2 text-xs text-[#9690A1] transition hover:text-white"><Icon name="back" size={15}/> Back to today</button><button onClick={() => setImmersive(true)} className="inline-flex items-center gap-2 rounded-lg border border-white/[.08] px-3 py-2 text-[11px] font-medium text-[#B8B4C0] transition hover:border-[#8B5CF6]/30 hover:bg-[#8B5CF6]/[.06] hover:text-white"><Icon name="maximize" size={13}/> Full screen</button></div>
    {sectionNavigation}
    <div className="grid gap-3 lg:h-[calc(100svh-150px)] lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="focus-panel relative flex min-h-[500px] flex-col items-center justify-center overflow-hidden rounded-[24px] border border-white/[.07] bg-[#201C2B] px-4 py-6 text-center sm:py-7 lg:h-full lg:min-h-0"><div className="pointer-events-none absolute -top-20 left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-[#8B5CF6]/[.075] blur-[90px]"/>
        {!finished ? <><div className="relative"><div className="focus-status inline-flex items-center gap-2 rounded-full border border-white/[.08] bg-white/[.025] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[.14em] text-[#A3A3A8]"><span className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-[#8B5CF6]' : 'bg-[#777181]'}`}/>{running ? 'In your focus room' : 'A little room to think'}</div><h1 className="focus-title mt-3 text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-.06em]">Stay with one thing.</h1><p className="focus-copy mt-1.5 text-sm text-[#9690A1]">You don’t need to feel ready. Just be here.</p><label className="focus-topic mx-auto mt-2 block max-w-[230px]"><span className="sr-only">Choose a focus topic</span><select value={topic} onChange={(event) => setTopic(event.target.value)} className="w-full rounded-full border border-white/[.07] bg-[#17151E] px-3 py-1.5 text-center text-[10px] text-[#A3A3A8] outline-none focus:border-[#8B5CF6]/50">{!['No specific task', 'Review one exam topic', 'Read a few pages', 'Practice a problem set', 'Organize my study space'].includes(topic) && <option value={topic}>{topic}</option>}<option>No specific task</option><option>Review one exam topic</option><option>Read a few pages</option><option>Practice a problem set</option><option>Organize my study space</option></select></label></div>
          {timerFace()}
          {timerControls()}
          <div className="focus-footer relative mt-4 grid w-full max-w-[410px] grid-cols-2 gap-2 sm:mt-5"><div aria-live="polite" className="col-span-2 rounded-xl border border-[#8B5CF6]/10 bg-[#17151E]/55 px-4 py-2.5 text-[11px] leading-5 text-[#B7AEC7]">“{focusQuotes[quoteIndex]}”</div><div className="rounded-2xl border border-white/[.06] bg-[#17151E]/65 px-4 py-3 text-left"><div className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[.12em] text-[#817B8F]"><Icon name="clock" size={12} className="text-[#A78BFA]"/> Your session</div><div className="mt-1.5 text-sm font-medium text-[#E6E1EC]">{minutes} minutes</div></div><div className="rounded-2xl border border-[#F5B942]/10 bg-[#F5B942]/[.035] px-4 py-3 text-left"><div className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[.12em] text-[#817B8F]"><Icon name="spark" size={12} className="text-[#F5B942]"/> When you finish</div><div className="mt-1.5 text-sm font-medium text-[#F5CB69]">+25 XP</div></div></div>
        </> : completionContent}
      </section>
      <aside className="hidden space-y-3 lg:block"><section className="rounded-[20px] border border-white/[.07] bg-[#201C2B] p-4"><div className="flex items-center gap-2"><Icon name="leaf" size={16} className="text-[#A78BFA]"/><h2 className="text-sm font-semibold">A note for this moment</h2></div><p className="mt-2 text-[12px] leading-5 text-[#A3A3A8]">You don’t have to make up for lost time. This moment is enough to begin again.</p></section><div className="rounded-[20px] border border-[#8B5CF6]/15 bg-[#8B5CF6]/[.055] p-4"><div className="text-xs font-medium text-[#D8CBFF]">Small start, real momentum</div><p className="mt-1.5 text-[11px] leading-5 text-[#9690A1]">Finish a session to complete today’s focus quest and collect a little XP.</p></div></aside>
    </div>
  </div>
}
