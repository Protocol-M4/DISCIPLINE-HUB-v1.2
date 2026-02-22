import { app, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const isDev = process.env.NODE_ENV === 'development'
const childProcesses = []

function startProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
    ...options,
  })
  childProcesses.push(child)
  return child
}

async function waitForUrl(url, timeoutMs = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status < 500) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 350))
  }
  return false
}

async function createWindow() {
  const iconPath = resolve(rootDir, 'build/icon.png')
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    title: 'StarkHub',
    icon: iconPath,
    webPreferences: {
      preload: resolve(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  startProcess(process.execPath, ['server.mjs'])

  if (isDev) {
    startProcess(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'])
    await waitForUrl('http://127.0.0.1:5173')
    await win.loadURL('http://127.0.0.1:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    await win.loadFile(resolve(rootDir, 'dist/index.html'))
  }

  win.on('closed', () => {
    app.quit()
  })
}

function stopChildren() {
  childProcesses.forEach((child) => {
    if (!child || child.killed) return
    try {
      child.kill('SIGTERM')
    } catch {}
  })
}

app.whenReady().then(createWindow)

app.on('before-quit', stopChildren)
app.on('will-quit', stopChildren)
app.on('window-all-closed', () => {
  stopChildren()
  if (process.platform !== 'darwin') app.quit()
})
