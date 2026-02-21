import { useEffect, useMemo, useState } from 'react'
import { Flame, Sparkles, X } from 'lucide-react'
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
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const TASKS = [
  { id: 'wake730', title: 'Подъем в 07:30', reward: 100, weekdaysOnly: true, deadlineHour: 8 },
  { id: 'exercise', title: 'Зарядка', reward: 100 },
  { id: 'cleanFood', title: 'Чистое питание', reward: 250 },
  { id: 'noPorn', title: 'Дофаминовый пост', reward: 250 },
  { id: 'strength', title: 'Силовая тренировка', reward: 150, days: [2, 5] },
  { id: 'jarvisV2', title: 'Проект: JARVIS V2', reward: 200 },
  { id: 'english', title: 'English Session (1h)', reward: 200 },
  { id: 'reading', title: 'Чтение (1h)', reward: 100 },
]

const FINES = [
  { id: 'smoking', title: 'Курение', amount: 3000 },
  { id: 'fastfood', title: 'Фастфуд', amount: 1000 },
  { id: 'alcohol', title: 'Алкоголь', amount: 1000 },
]

const ACHIEVEMENTS = [
  { id: 'firstReactor', title: 'Первый реактор', check: (ctx) => ctx.balance >= 5000 },
  { id: 'ironWill', title: 'Железная воля', check: (ctx) => ctx.weekWithoutFines },
  { id: 'protocolDone', title: 'Протокол завершен', check: (ctx) => ctx.anyDayAllTasks },
  { id: 'legend', title: 'Я — ЛЕГЕНДА', check: (ctx) => ctx.balance >= 30000 },
  { id: 'ironMan', title: 'Железный человек', check: (ctx) => ctx.weekWithBothStrength },
]

const initialState = { weeks: {}, unlocked: [] }

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

function getIsoWeekNumber(date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7)
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

function getDayData(weeks, dateKey) {
  const weekKey = formatDateKey(getWeekStart(getDateFromKey(dateKey)))
  return weeks?.[weekKey]?.[dateKey] || {}
}

function getRows() {
  return [...TASKS.map((x) => ({ type: 'task', ...x })), ...FINES.map((x) => ({ type: 'fine', ...x }))]
}

function hasFullWeekData(weekData) {
  return Object.keys(weekData || {}).length >= 7
}

function calculateState(store) {
  const dates = new Set()
  Object.values(store.weeks || {}).forEach((weekData) => {
    Object.keys(weekData || {}).forEach((date) => dates.add(date))
  })
  if (!dates.size) dates.add(formatDateKey(new Date()))

  const sortedDates = [...dates].sort()
  const streakCount = Object.fromEntries(TASKS.map((t) => [t.id, 0]))
  const streakFire = Object.fromEntries(TASKS.map((t) => [t.id, false]))
  const rewardByDate = {}
  const fineByDate = {}

  for (const dateKey of sortedDates) {
    const date = getDateFromKey(dateKey)
    const dayIndex = (date.getDay() + 6) % 7
    const dayData = getDayData(store.weeks, dateKey)

    let reward = 0
    let fine = 0

    for (const task of TASKS) {
      const done = Boolean(dayData[task.id])
      if (!done || !isTaskAvailable(task, dayIndex, date)) {
        streakCount[task.id] = 0
        streakFire[task.id] = false
        continue
      }

      streakCount[task.id] += 1
      if (streakCount[task.id] === 3) streakFire[task.id] = true

      if (streakCount[task.id] === 4) {
        reward += task.reward * 2
        streakCount[task.id] = 0
        streakFire[task.id] = false
      } else {
        reward += task.reward
      }
    }

    FINES.forEach((f) => {
      if (dayData[f.id]) fine += f.amount
    })

    rewardByDate[dateKey] = reward
    fineByDate[dateKey] = fine
  }

  let runningBalance = 0
  const points = sortedDates.map((dateKey) => {
    runningBalance += (rewardByDate[dateKey] || 0) - (fineByDate[dateKey] || 0)
    return {
      dateKey,
      dayLabel: getDateFromKey(dateKey).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
      balance: runningBalance,
    }
  })

  const today = new Date()
  const todayKey = formatDateKey(today)
  const todayBalance = points.find((p) => p.dateKey === todayKey)?.balance ?? runningBalance

  const chartData = [...Array(28)].map((_, i) => {
    const d = addDays(today, i - 13)
    const key = formatDateKey(d)
    const existing = points.find((p) => p.dateKey === key)
    const dayDiff = Math.floor((new Date(d).setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0)) / 86400000)
    return {
      dayLabel: d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
      balance: existing?.balance ?? null,
      ideal: dayDiff >= 0 ? todayBalance + dayDiff * 1000 : null,
    }
  })

  const weekWithoutFines = Object.values(store.weeks || {}).some((weekData) =>
    hasFullWeekData(weekData) && Object.values(weekData).every((d) => !d.smoking && !d.fastfood && !d.alcohol),
  )

  const anyDayAllTasks = Object.values(store.weeks || {}).some((weekData) =>
    Object.entries(weekData).some(([dateKey, dayData]) => {
      const date = getDateFromKey(dateKey)
      const dayIndex = (date.getDay() + 6) % 7
      return TASKS.filter((task) => isTaskAvailable(task, dayIndex, date)).every((task) => Boolean(dayData[task.id]))
    }),
  )

  const weekWithBothStrength = Object.values(store.weeks || {}).some((weekData) => {
    if (!hasFullWeekData(weekData)) return false
    const strengthDays = Object.entries(weekData)
      .filter(([, dayData]) => dayData.strength)
      .map(([dateKey]) => (getDateFromKey(dateKey).getDay() + 6) % 7)
    return strengthDays.includes(2) && strengthDays.includes(5)
  })

  return {
    balance: runningBalance,
    chartData,
    streakFire,
    achievementCtx: { balance: runningBalance, weekWithoutFines, anyDayAllTasks, weekWithBothStrength },
  }
}

function Reactor({ progress, flash }) {
  const radius = 56
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - Math.min(progress, 100) / 100)

  return (
    <div className={`relative flex h-40 w-40 items-center justify-center rounded-full border backdrop-blur-xl ${flash === 'fine' ? 'border-rose-400 shadow-redglow' : 'border-cyan-300 shadow-glow'} animate-pulse`}>
      <svg className="absolute h-36 w-36 -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke={flash === 'fine' ? '#fb7185' : '#67e8f9'}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Реактор</p>
        <p className="text-2xl font-bold">{progress.toFixed(1)}%</p>
      </div>
    </div>
  )
}

export default function App() {
  const [store, setStore] = useState(initialState)
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [jarvisModalOpen, setJarvisModalOpen] = useState(false)
  const [jarvisText, setJarvisText] = useState('')
  const [jarvisLoading, setJarvisLoading] = useState(false)
  const [flash, setFlash] = useState('task')
  const [toasts, setToasts] = useState([])

  const todayWeek = getWeekStart()
  const currentWeekStart = useMemo(() => addDays(todayWeek, weekOffset * 7), [todayWeek, weekOffset])
  const currentWeekEnd = useMemo(() => addDays(currentWeekStart, 6), [currentWeekStart])
  const weekNo = useMemo(() => getIsoWeekNumber(currentWeekStart), [currentWeekStart])
  const weekKey = formatDateKey(currentWeekStart)
  const weekData = store.weeks?.[weekKey] || {}
  const todayIndex = (new Date().getDay() + 6) % 7
  const rows = useMemo(() => getRows(), [])

  useEffect(() => {
    ;(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/state`)
        const data = await response.json()
        setStore({ ...initialState, ...data })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => {
      fetch(`${API_BASE}/api/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store),
      }).catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [store, loading])

  const computed = useMemo(() => calculateState(store), [store])
  const progress = (computed.balance / GOAL) * 100

  useEffect(() => {
    const unlocked = new Set(store.unlocked || [])
    const newUnlocked = ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && a.check(computed.achievementCtx))
    if (!newUnlocked.length) return

    setStore((prev) => ({ ...prev, unlocked: [...(prev.unlocked || []), ...newUnlocked.map((a) => a.id)] }))
    setToasts((prev) => [...prev, ...newUnlocked.map((a) => ({ id: `${a.id}-${Date.now()}`, title: a.title }))])
  }, [computed.achievementCtx, store.unlocked])

  useEffect(() => {
    if (!toasts.length) return
    const t = setTimeout(() => setToasts((prev) => prev.slice(1)), 2800)
    return () => clearTimeout(t)
  }, [toasts])

  function updateCell(date, row, checked) {
    const dateKey = formatDateKey(date)
    setStore((prev) => {
      const weeks = { ...(prev.weeks || {}) }
      const targetWeek = { ...(weeks[weekKey] || {}) }
      const dayData = { ...(targetWeek[dateKey] || {}) }
      dayData[row.id] = checked
      targetWeek[dateKey] = dayData
      weeks[weekKey] = targetWeek
      return { ...prev, weeks }
    })

    setFlash(row.type === 'fine' && checked ? 'fine' : 'task')
    setTimeout(() => setFlash('task'), 650)
  }

  async function syncWithJarvis() {
    setJarvisModalOpen(true)
    setJarvisLoading(true)
    try {
      const last14 = computed.chartData.filter((d) => d.balance !== null).slice(-14)
      const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
      if (!apiKey) {
        setJarvisText('Сэр, отсутствует ключ VITE_OPENROUTER_API_KEY.')
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
            { role: 'system', content: 'Ты Джарвис. Всегда обращайся: Сэр. Анализируй корреляции и паттерны, не просто хвали.' },
            { role: 'user', content: `Дай анализ за 14 дней: ${JSON.stringify(last14)}` },
          ],
        }),
      })
      const data = await response.json()
      setJarvisText(data?.choices?.[0]?.message?.content || 'Сэр, анализ не получен.')
    } catch {
      setJarvisText('Сэр, канал к OpenRouter временно недоступен.')
    } finally {
      setJarvisLoading(false)
    }
  }

  if (loading) return <div className="p-10 text-cyan-100">Загрузка...</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060914] via-[#0d1220] to-[#1a2235] p-6 text-slate-100 md:p-10">
      <header className="mb-8 flex flex-col items-center justify-between gap-6 rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl md:flex-row">
        <div>
          <h1 className="text-3xl font-semibold tracking-wide text-cyan-100">Stark Discipline Hub v1.4</h1>
          <p className="mt-2 text-slate-300">Премиальная панель прогресса Сэра</p>
          <p className="mt-3 text-5xl font-black text-cyan-200 drop-shadow-[0_0_18px_rgba(103,232,249,0.7)]">{computed.balance} RUB</p>
        </div>
        <Reactor progress={progress} flash={flash} />
      </header>

      <section className="mb-6 rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Еженедельная сетка</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset((v) => v - 1)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-1 hover:bg-white/20">Назад</button>
            <span className="text-sm text-slate-200">
              Неделя #{weekNo}: {currentWeekStart.toLocaleDateString('ru-RU')} — {currentWeekEnd.toLocaleDateString('ru-RU')}
            </span>
            <button onClick={() => setWeekOffset((v) => v + 1)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-1 hover:bg-white/20">Вперед</button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-white/15 p-2 text-left">Задача / Штраф</th>
                {DAYS.map((d, idx) => (
                  <th key={d} className={`border p-2 ${idx === todayIndex ? 'border-cyan-300' : 'border-white/15'}`}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className={`border p-2 ${row.type === 'fine' ? 'border-white/15 text-rose-500 font-semibold' : 'border-white/15'}`}>
                    {row.title}{' '}
                    {row.type === 'task' ? (
                      <>
                        <span className="text-cyan-300">+{row.reward}</span>
                        {computed.streakFire[row.id] ? <Flame size={15} className="ml-2 inline text-orange-400" /> : null}
                      </>
                    ) : (
                      <span className="text-rose-400">-{row.amount}</span>
                    )}
                  </td>
                  {DAYS.map((_, idx) => {
                    const date = addDays(currentWeekStart, idx)
                    const dateKey = formatDateKey(date)
                    const checked = Boolean(weekData[dateKey]?.[row.id])
                    const enabled = row.type === 'fine' ? true : isTaskAvailable(row, idx, date)
                    return (
                      <td key={`${row.id}-${idx}`} className={`border p-2 text-center ${idx === todayIndex ? 'border-cyan-300' : 'border-white/15'}`}>
                        <button
                          disabled={!enabled}
                          onClick={() => updateCell(date, row, !checked)}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition ${checked ? (row.type === 'fine' ? 'border-rose-500 text-rose-500 bg-rose-500/10' : 'border-cyan-300 text-cyan-200 bg-cyan-500/10') : 'border-white/30 text-transparent'} disabled:opacity-30`}
                        >
                          {checked ? <X size={14} /> : '·'}
                        </button>
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
        <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
          <h2 className="mb-3 text-lg font-semibold">Достижения</h2>
          <ul className="space-y-2 text-sm">
            {ACHIEVEMENTS.map((a) => (
              <li key={a.id} className={store.unlocked?.includes(a.id) ? 'text-cyan-200' : 'text-slate-400'}>
                {store.unlocked?.includes(a.id) ? '✅' : '⬜'} {a.title}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
          <h2 className="mb-3 text-lg font-semibold">J.A.R.V.I.S.</h2>
          <button onClick={syncWithJarvis} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-500/10 px-3 py-2 hover:bg-cyan-500/20">
            <Sparkles size={16} /> Синхронизировать с Джарвисом
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
        <h2 className="mb-4 text-lg font-semibold">Динамика: факт vs идеал (+1000/день)</h2>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={computed.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
              <XAxis dataKey="dayLabel" tick={{ fill: '#dbeafe', fontSize: 12 }} />
              <YAxis tick={{ fill: '#dbeafe', fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="balance" stroke="#67e8f9" strokeWidth={3} dot={false} name="Факт" connectNulls />
              <Line type="monotone" dataKey="ideal" stroke="#cbd5e1" strokeDasharray="4 4" dot={false} name="Идеал" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {jarvisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/20 bg-slate-900/80 p-5 shadow-2xl backdrop-blur-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-cyan-200">Jarvis Analysis</h3>
              <button onClick={() => setJarvisModalOpen(false)} className="rounded-lg border border-white/20 p-1 hover:bg-white/10">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-200">
              {jarvisLoading ? 'Синхронизация...' : jarvisText || 'Сэр, ожидаю команду на анализ.'}
            </div>
          </div>
        </div>
      )}

      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div key={toast.id} className="rounded-xl border border-cyan-300/40 bg-slate-900/85 px-4 py-2 text-sm shadow-glow backdrop-blur-lg">
            🏆 Достижение разблокировано: {toast.title}
          </div>
        ))}
      </div>
    </div>
  )
}
