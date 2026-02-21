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
  { id: 'smoking', title: 'Курение', baseFine: 3000, progressive: true },
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
  return [
    ...TASKS.map((task) => ({ type: 'task', ...task })),
    ...FINES.map((fine) => ({ type: 'fine', ...fine })),
  ]
}

function calculateState(store) {
  const datesSet = new Set()
  Object.values(store.weeks).forEach((weekData) => {
    Object.keys(weekData).forEach((date) => datesSet.add(date))
  })
  if (datesSet.size === 0) datesSet.add(formatDateKey(new Date()))

  const sortedDates = [...datesSet].sort()
  const streakState = {}
  const streakFire = {}
  const rewardByDate = {}
  const fineByDate = {}

  TASKS.forEach((task) => {
    streakState[task.id] = 0
    streakFire[task.id] = false
  })

  sortedDates.forEach((dateKey) => {
    const date = getDateFromKey(dateKey)
    const dayIndex = (date.getDay() + 6) % 7
    const dayData = getDayData(store.weeks, dateKey)
    let reward = 0
    let fineTotal = 0

    TASKS.forEach((task) => {
      const done = Boolean(dayData[task.id])
      if (!isTaskAvailable(task, dayIndex, date) || !done) {
        streakState[task.id] = 0
        streakFire[task.id] = false
        return
      }

      streakState[task.id] += 1
      if (streakState[task.id] === 3) streakFire[task.id] = true

      if (streakState[task.id] === 4) {
        reward += task.reward * 2
        streakState[task.id] = 0
        streakFire[task.id] = false
      } else {
        reward += task.reward
      }
    })

    const smokingMarked = Boolean(dayData.smoking)
    const fastfoodMarked = Boolean(dayData.fastfood)
    const alcoholMarked = Boolean(dayData.alcohol)

    if (smokingMarked) fineTotal += FINES.find((f) => f.id === 'smoking').baseFine
    if (fastfoodMarked) fineTotal += FINES.find((f) => f.id === 'fastfood').amount
    if (alcoholMarked) fineTotal += FINES.find((f) => f.id === 'alcohol').amount

    rewardByDate[dateKey] = reward
    fineByDate[dateKey] = fineTotal
  })

  let balance = 0
  const points = sortedDates.map((dateKey) => {
    balance += (rewardByDate[dateKey] || 0) - (fineByDate[dateKey] || 0)
    return {
      dateKey,
      dayLabel: getDateFromKey(dateKey).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
      balance,
    }
  })

  const todayKey = formatDateKey(new Date())
  const todayBalance = points.find((p) => p.dateKey === todayKey)?.balance ?? balance
  const chartDates = [...Array(28)].map((_, i) => addDays(new Date(), i - 13))
  const chartData = chartDates.map((d) => {
    const key = formatDateKey(d)
    const existing = points.find((p) => p.dateKey === key)
    const dayDiff = Math.floor((d.setHours(0, 0, 0, 0) - getDateFromKey(todayKey).getTime()) / 86400000)
    return {
      dayLabel: d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
      balance: existing?.balance ?? null,
      ideal: dayDiff >= 0 ? todayBalance + dayDiff * 1000 : null,
    }
  })

  const weekWithoutFines = Object.entries(store.weeks).some(([, weekData]) =>
    Object.values(weekData).every((dayData) => !dayData.smoking && !dayData.fastfood && !dayData.alcohol),
  )
  const anyDayAllTasks = Object.values(store.weeks).some((weekData) =>
    Object.values(weekData).some((dayData) => TASKS.every((task) => dayData[task.id])),
  )
  const weekWithBothStrength = Object.entries(store.weeks).some(([, weekData]) => {
    const values = Object.entries(weekData)
    const strengthDays = values.filter(([, dayData]) => dayData.strength).map(([dateKey]) => (getDateFromKey(dateKey).getDay() + 6) % 7)
    return strengthDays.includes(2) && strengthDays.includes(5)
  })

  return {
    balance,
    chartData,
    streakFire,
    achievementCtx: { balance, weekWithoutFines, anyDayAllTasks, weekWithBothStrength },
  }
}

function Reactor({ progress, flash }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - Math.min(progress, 100) / 100)
  const pulseClass = flash === 'fine' ? 'animate-pulse border-rose-500 shadow-redglow' : 'animate-pulse border-cyan-400 shadow-glow'

  return (
    <div className={`relative flex h-36 w-36 items-center justify-center rounded-full border ${pulseClass}`}>
      <svg className="absolute h-32 w-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} stroke="rgba(255,255,255,0.12)" strokeWidth="8" fill="none" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke={flash === 'fine' ? '#f43f5e' : '#00e5ff'}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-cyan-100/70">Реактор</p>
        <p className="text-xl font-bold">{progress.toFixed(1)}%</p>
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
  const weekKey = formatDateKey(currentWeekStart)
  const weekData = store.weeks?.[weekKey] || {}
  const todayIndex = (new Date().getDay() + 6) % 7

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`${API_BASE}/api/state`)
        const data = await response.json()
        setStore({ ...initialState, ...data })
      } catch {
        setStore(initialState)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (loading) return
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/api/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store),
      }).catch(() => {})
    }, 250)
    return () => clearTimeout(timer)
  }, [store, loading])

  const computed = useMemo(() => calculateState(store), [store])
  const progress = (computed.balance / GOAL) * 100
  const rows = getRows()

  useEffect(() => {
    const unlocked = new Set(store.unlocked || [])
    const newItems = ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && a.check(computed.achievementCtx))
    if (!newItems.length) return

    setStore((prev) => ({ ...prev, unlocked: [...(prev.unlocked || []), ...newItems.map((a) => a.id)] }))
    setToasts((prev) => [...prev, ...newItems.map((a) => ({ id: `${a.id}-${Date.now()}`, title: a.title }))])
  }, [computed.achievementCtx, store.unlocked])

  useEffect(() => {
    if (!toasts.length) return
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1))
    }, 2800)
    return () => clearTimeout(timer)
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
    setTimeout(() => setFlash('task'), 700)
  }

  async function syncWithJarvis() {
    setJarvisModalOpen(true)
    setJarvisLoading(true)
    try {
      const last14 = computed.chartData.filter((x) => x.balance !== null).slice(-14)
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
            { role: 'system', content: 'Ты Джарвис. Всегда обращайся к пользователю: Сэр. Тон: британский интеллект, ироничный, но аналитичный.' },
            { role: 'user', content: `Проанализируй паттерны за 14 дней: ${JSON.stringify(last14)}` },
          ],
        }),
      })
      const data = await response.json()
      setJarvisText(data?.choices?.[0]?.message?.content || 'Сэр, анализ не получен.')
    } catch {
      setJarvisText('Сэр, OpenRouter временно недоступен.')
    } finally {
      setJarvisLoading(false)
    }
  }

  if (loading) return <div className="p-10 text-cyan-200">Загрузка панели...</div>

  return (
    <div className="min-h-screen p-6 md:p-10">
      <header className="mb-8 flex flex-col items-center justify-between gap-6 rounded-xl border border-cyan-500/30 bg-hud-card/70 p-6 md:flex-row">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-widest text-cyan-300">Stark Discipline Hub v1.4</h1>
          <p className="mt-2 text-cyan-100/80">Главная панель прогресса Сэра</p>
          <p className="mt-2 text-4xl font-extrabold text-cyan-300 drop-shadow-[0_0_10px_rgba(0,229,255,0.6)]">
            {computed.balance} RUB
          </p>
        </div>
        <Reactor progress={progress} flash={flash} />
      </header>

      <section className="mb-6 rounded-xl border border-cyan-500/20 bg-hud-card/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Еженедельная сетка</h2>
          <div className="flex gap-2">
            <button className="rounded border border-cyan-500/40 px-3 py-1" onClick={() => setWeekOffset((v) => v - 1)}>Назад</button>
            <span className="self-center text-sm">Неделя: {weekKey}</span>
            <button className="rounded border border-cyan-500/40 px-3 py-1" onClick={() => setWeekOffset((v) => v + 1)}>Вперед</button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-cyan-900 p-2 text-left">Задача / Штраф</th>
                {DAYS.map((d, idx) => (
                  <th key={d} className={`border p-2 ${idx === todayIndex ? 'border-cyan-300' : 'border-cyan-900'}`}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className={`border border-cyan-900 p-2 ${row.type === 'fine' ? 'text-rose-500 font-semibold' : ''}`}>
                    {row.title}{' '}
                    {row.type === 'task' ? (
                      <>
                        <span className="text-cyan-400">+{row.reward}</span>
                        {computed.streakFire[row.id] ? <Flame className="ml-2 inline text-orange-400" size={15} /> : null}
                      </>
                    ) : (
                      <span className="text-rose-400">-{row.amount || row.baseFine}</span>
                    )}
                  </td>
                  {DAYS.map((_, idx) => {
                    const date = addDays(currentWeekStart, idx)
                    const dateKey = formatDateKey(date)
                    const checked = Boolean(weekData[dateKey]?.[row.id])
                    const enabled = row.type === 'fine' ? true : isTaskAvailable(row, idx, date)
                    return (
                      <td key={`${row.id}-${idx}`} className={`border p-2 text-center ${idx === todayIndex ? 'border-cyan-300' : 'border-cyan-900'}`}>
                        <button
                          disabled={!enabled}
                          onClick={() => updateCell(date, row, !checked)}
                          className={`inline-flex h-6 w-6 items-center justify-center rounded border ${checked ? (row.type === 'fine' ? 'border-rose-500 text-rose-500' : 'border-cyan-300 text-cyan-300') : 'border-cyan-700 text-transparent'} disabled:opacity-30`}
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
        <div className="rounded-xl border border-cyan-500/30 bg-hud-card/70 p-4">
          <h2 className="mb-3 text-lg font-semibold">Достижения</h2>
          <ul className="space-y-2 text-sm">
            {ACHIEVEMENTS.map((a) => (
              <li key={a.id} className={store.unlocked?.includes(a.id) ? 'text-cyan-300' : 'text-cyan-100/50'}>
                {store.unlocked?.includes(a.id) ? '✅' : '⬜'} {a.title}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-hud-card/70 p-4">
          <h2 className="mb-3 text-lg font-semibold">J.A.R.V.I.S.</h2>
          <button onClick={syncWithJarvis} className="inline-flex items-center gap-2 rounded border border-cyan-500/70 px-3 py-2 hover:bg-cyan-500/20">
            <Sparkles size={16} /> Синхронизировать с Джарвисом
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-cyan-500/20 bg-hud-card/70 p-4">
        <h2 className="mb-4 text-lg font-semibold">Динамика: Баланс и идеальная траектория</h2>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={computed.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
              <XAxis dataKey="dayLabel" tick={{ fill: '#b6eff8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#b6eff8', fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="balance" stroke="#00e5ff" strokeWidth={3} dot={false} name="Факт" connectNulls />
              <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="4 4" dot={false} name="Идеал +1000/день" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {jarvisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-cyan-500/40 bg-hud-card p-5 shadow-glow">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-cyan-300">Jarvis Analysis</h3>
              <button onClick={() => setJarvisModalOpen(false)} className="rounded border border-cyan-500/40 p-1 hover:bg-cyan-500/20">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded border border-cyan-900 bg-black/25 p-4 text-sm leading-6 text-cyan-100/90">
              {jarvisLoading ? 'Синхронизация...' : jarvisText || 'Сэр, ожидаю команду на анализ.'}
            </div>
          </div>
        </div>
      )}

      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div key={toast.id} className="rounded border border-cyan-400/70 bg-hud-card px-4 py-2 text-sm shadow-glow">
            🏆 Достижение разблокировано: {toast.title}
          </div>
        ))}
      </div>
    </div>
  )
}
