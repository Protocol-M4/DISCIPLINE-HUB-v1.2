import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const GOAL = 60000
const STORAGE_KEY = 'stark-discipline-v1.2'
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TASKS = [
  { id: 'wake730', title: 'Wake Up 07:30', reward: 100, weekdaysOnly: true, deadlineHour: 8 },
  { id: 'exercise', title: 'Exercise', reward: 100 },
  { id: 'cleanFood', title: 'Clean Food', reward: 250 },
  { id: 'noPorn', title: 'Dopamine Fast', reward: 250 },
  { id: 'strength', title: 'Strength Training', reward: 150, days: [2, 5] },
  { id: 'jarvisV2', title: 'Project: JARVIS V2', reward: 200 },
  { id: 'english', title: 'English Session (1h)', reward: 200 },
  { id: 'reading', title: 'Reading (1h)', reward: 100 },
]
const FINES = [
  { id: 'smoking', title: 'Smoking (Level 5 Alert)', baseFine: 3000, progressive: true },
  { id: 'fastfood', title: 'Fastfood', amount: 1000 },
  { id: 'alcohol', title: 'Alcohol', amount: 1000 },
]

function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, amount) {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
  return d
}

function getDateFromKey(key) {
  return new Date(`${key}T00:00:00`)
}

function isTaskAvailable(task, dayIndex, date) {
  if (task.weekdaysOnly && dayIndex > 4) return false
  if (task.days && !task.days.includes(dayIndex)) return false
  if (task.deadlineHour !== undefined) {
    const now = new Date()
    if (formatDateKey(now) === formatDateKey(date) && now.getHours() >= task.deadlineHour) return false
  }
  return true
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { weeks: {}, finesLog: [] }
    const parsed = JSON.parse(raw)
    return { weeks: parsed.weeks ?? {}, finesLog: parsed.finesLog ?? [] }
  } catch {
    return { weeks: {}, finesLog: [] }
  }
}

function ArcReactor({ progress, warning }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - Math.min(progress, 100) / 100)
  const glowStrength = Math.max(0.25, Math.min(progress, 100) / 100)
  return (
    <div
      className={`relative flex h-36 w-36 items-center justify-center rounded-full border border-cyan-500/40 ${warning ? 'shadow-redglow' : 'shadow-glow'}`}
      style={{ opacity: 0.55 + glowStrength * 0.45 }}
    >
      <svg className="absolute h-32 w-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke={warning ? '#ff355e' : '#00e5ff'}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-cyan-200/80">Arc Reactor</p>
        <p className="text-xl font-bold">{progress.toFixed(1)}%</p>
      </div>
    </div>
  )
}

function JarvisModal({ open, loading, text, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-cyan-500/40 bg-hud-card p-5 shadow-glow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-cyan-300">Jarvis Analysis</h3>
          <button onClick={onClose} className="rounded border border-cyan-500/40 p-1 hover:bg-cyan-500/20">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded border border-cyan-900 bg-black/25 p-4 text-sm leading-6 text-cyan-100/90">
          {loading ? 'Synchronizing with J.A.R.V.I.S. core…' : text || 'Awaiting analysis, Сэр.'}
        </div>
      </div>
    </div>
  )
}

function buildDailyMap(store) {
  const totals = {}

  Object.entries(store.weeks).forEach(([weekStartKey, weekData]) => {
    Object.entries(weekData).forEach(([dateKey, checks]) => {
      const date = getDateFromKey(dateKey)
      const dayIndex = (date.getDay() + 6) % 7
      let sum = totals[dateKey] ?? 0
      TASKS.forEach((task) => {
        if (checks[task.id] && isTaskAvailable(task, dayIndex, date)) sum += task.reward
      })
      totals[dateKey] = sum
    })
    if (!store.weeks[weekStartKey]) totals[weekStartKey] = totals[weekStartKey] ?? 0
  })

  store.finesLog.forEach((fine) => {
    totals[fine.date] = (totals[fine.date] ?? 0) - fine.amount
  })

  return totals
}

export default function App() {
  const todayWeek = getWeekStart()
  const [store, setStore] = useState(loadState)
  const [weekOffset, setWeekOffset] = useState(0)
  const [jarvisText, setJarvisText] = useState('')
  const [jarvisLoading, setJarvisLoading] = useState(false)
  const [reactorWarning, setReactorWarning] = useState(false)
  const [jarvisModalOpen, setJarvisModalOpen] = useState(false)

  const currentWeekStart = useMemo(() => addDays(todayWeek, weekOffset * 7), [todayWeek, weekOffset])
  const weekKey = formatDateKey(currentWeekStart)
  const weekData = store.weeks[weekKey] || {}

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  }, [store])

  const fullHistory = useMemo(() => {
    const dailyMap = buildDailyMap(store)
    const keys = Object.keys(dailyMap).sort()
    const end = new Date()
    end.setHours(0, 0, 0, 0)
    const start = keys.length ? addDays(getDateFromKey(keys[0]), -3) : addDays(end, -60)

    const lines = []
    for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
      const dateKey = formatDateKey(cursor)
      const dayLabel = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      lines.push({ dateKey, dayLabel, delta: dailyMap[dateKey] ?? 0 })
    }

    let running = 0
    return lines.map((d, idx) => {
      running += d.delta
      return {
        ...d,
        balance: running,
        ideal: Math.round((idx / Math.max(1, lines.length - 1)) * GOAL),
      }
    })
  }, [store])

  const currentBalance = fullHistory[fullHistory.length - 1]?.balance || 0
  const progress = (currentBalance / GOAL) * 100
  const chartData = useMemo(() => fullHistory.slice(-28), [fullHistory])

  function toggleTask(date, taskId) {
    const dKey = formatDateKey(date)
    setStore((prev) => {
      const weeks = { ...prev.weeks }
      const targetWeek = { ...(weeks[weekKey] || {}) }
      const dayData = { ...(targetWeek[dKey] || {}) }
      dayData[taskId] = !dayData[taskId]
      targetWeek[dKey] = dayData
      weeks[weekKey] = targetWeek
      return { ...prev, weeks }
    })
  }

  function applyFine(fine) {
    const now = new Date()
    const dateKey = formatDateKey(now)
    let amount = fine.amount
    if (fine.progressive) {
      const smokingToday = store.finesLog.filter((f) => f.type === 'smoking' && f.date === dateKey).length
      amount = fine.baseFine + smokingToday * 1000
    }
    setStore((prev) => ({
      ...prev,
      finesLog: [...prev.finesLog, { date: dateKey, amount, type: fine.id, ts: Date.now() }],
    }))
    setReactorWarning(true)
    setTimeout(() => setReactorWarning(false), 900)
  }

  async function syncWithJarvis() {
    setJarvisModalOpen(true)
    setJarvisLoading(true)
    try {
      const recent = fullHistory.slice(-14)
      const prompt = `You are Jarvis, an ironic British assistant. Address user only as "Сэр". Analyze discipline trends and behavior correlations, no generic praise. Data: ${JSON.stringify(recent)}`
      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
      if (!apiKey) {
        setJarvisText('Сэр, отсутствует VITE_OPENROUTER_API_KEY. Добавьте ключ в .env для анализа.')
        return
      }
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are Jarvis, strict and witty.' },
            { role: 'user', content: prompt },
          ],
        }),
      })

      if (!response.ok) {
        setJarvisText(`Сэр, OpenRouter вернул код ${response.status}. Проверьте ключ и лимиты.`)
        return
      }

      const data = await response.json()
      setJarvisText(data?.choices?.[0]?.message?.content || 'Сэр, ответ от ядра анализа не получен.')
    } catch {
      setJarvisText('Сэр, канал связи с OpenRouter временно недоступен.')
    } finally {
      setJarvisLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-10">
      <header className="mb-8 flex flex-col items-center justify-between gap-6 rounded-xl border border-cyan-500/30 bg-hud-card/70 p-6 md:flex-row">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-widest text-cyan-300">Stark Discipline Hub v1.2</h1>
          <p className="mt-2 text-cyan-100/80">Mission: 60 000 RUB for the watch, Сэр.</p>
          <p className="mt-1 text-sm">
            Balance: <span className="font-bold text-cyan-300">{currentBalance} RUB</span>
          </p>
        </div>
        <ArcReactor progress={progress} warning={reactorWarning} />
      </header>

      <section className="mb-6 rounded-xl border border-cyan-500/20 bg-hud-card/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Weekly Grid</h2>
          <div className="flex gap-2">
            <button className="rounded border border-cyan-500/40 p-1" onClick={() => setWeekOffset((v) => v - 1)}>
              <ChevronLeft size={18} />
            </button>
            <span className="self-center text-sm">{weekKey}</span>
            <button className="rounded border border-cyan-500/40 p-1" onClick={() => setWeekOffset((v) => v + 1)}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-cyan-900 p-2 text-left">Task</th>
                {DAYS.map((d, idx) => (
                  <th key={d} className="border border-cyan-900 p-2">
                    {d}
                    {idx > 4 ? ' *' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TASKS.map((task) => (
                <tr key={task.id}>
                  <td className="border border-cyan-900 p-2">
                    {task.title} <span className="text-cyan-400">+{task.reward}</span>
                  </td>
                  {DAYS.map((_, idx) => {
                    const date = addDays(currentWeekStart, idx)
                    const dateKey = formatDateKey(date)
                    const checked = weekData[dateKey]?.[task.id] || false
                    const enabled = isTaskAvailable(task, idx, date)
                    return (
                      <td key={`${task.id}-${idx}`} className="border border-cyan-900 p-2 text-center">
                        <input
                          type="checkbox"
                          disabled={!enabled}
                          checked={checked}
                          onChange={() => toggleTask(date, task.id)}
                          className="h-4 w-4 accent-cyan-400 disabled:opacity-30"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-red-500/30 bg-hud-card/70 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-red-300">
            <AlertTriangle size={18} /> Critical Fines
          </h2>
          <div className="flex flex-wrap gap-2">
            {FINES.map((fine) => (
              <button
                key={fine.id}
                onClick={() => applyFine(fine)}
                className="rounded border border-red-400/60 px-3 py-2 text-sm hover:bg-red-500/20"
              >
                {fine.title} {fine.progressive ? '(-3000++)' : `(-${fine.amount})`}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-hud-card/70 p-4">
          <h2 className="mb-3 text-lg font-semibold">Jarvis AI Module</h2>
          <button
            onClick={syncWithJarvis}
            className="mb-3 inline-flex items-center gap-2 rounded border border-cyan-500/70 px-3 py-2 hover:bg-cyan-500/20"
          >
            <Sparkles size={16} /> {jarvisLoading ? 'Syncing...' : 'Sync with Jarvis'}
          </button>
          <p className="text-sm text-cyan-100/80">Latest sync opens in a modal named “Jarvis Analysis”.</p>
        </div>
      </section>

      <section className="rounded-xl border border-cyan-500/20 bg-hud-card/70 p-4">
        <h2 className="mb-4 text-lg font-semibold">Velocity Chart: Balance vs Ideal</h2>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
              <XAxis dataKey="dayLabel" tick={{ fill: '#b6eff8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#b6eff8', fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="balance" stroke="#00e5ff" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="ideal" stroke="#8f9db5" strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <JarvisModal
        open={jarvisModalOpen}
        loading={jarvisLoading}
        text={jarvisText}
        onClose={() => setJarvisModalOpen(false)}
      />
    </div>
  )
}
