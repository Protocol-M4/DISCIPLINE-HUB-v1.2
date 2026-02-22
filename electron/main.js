import { app, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { dirname, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

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

  child.on('error', (error) => {
    console.error(`[main] Child process failed to start: ${command} ${args.join(' ')}`, error)
  })

  child.on('exit', (code, signal) => {
    console.error(`[main] Child process exited: ${command} ${args.join(' ')} (code=${code ?? 'null'}, signal=${signal ?? 'null'})`)
  })

  childProcesses.push(child)
  return child
}

async function waitForUrl(url, timeoutMs = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 350))
  }
  return false
}

async function createWindow() {
  const dataFilePath = resolve(app.getPath('userData'), 'data.json')
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

  const isPackaged = app.isPackaged
  const packagedServerCandidates = [
    resolve(process.resourcesPath, 'server.mjs'),
    resolve(process.resourcesPath, 'app.asar.unpacked', 'server.mjs'),
    resolve(process.resourcesPath, 'app.asar', 'server.mjs'),
  ]
  const serverEntry = isPackaged
    ? (packagedServerCandidates.find((candidate) => existsSync(candidate)) ?? packagedServerCandidates[0])
    : resolve(rootDir, 'server.mjs')

  const isPlainNodeRuntime = basename(process.execPath).toLowerCase().startsWith('node')
  const packagedNodeCandidates = [
    resolve(process.resourcesPath, 'node'),
    resolve(process.resourcesPath, 'bin', 'node'),
    resolve(process.resourcesPath, 'node.exe'),
  ]
  const packagedNodePath = packagedNodeCandidates.find((candidate) => existsSync(candidate))

  const serverCommand = isDev
    ? process.execPath
    : (packagedNodePath ?? process.execPath)

  const serverEnv = {
    ...process.env,
    DISCIPLINE_DATA_FILE: dataFilePath,
  }
  if (!isDev || !isPlainNodeRuntime) {
    if (!packagedNodePath) serverEnv.ELECTRON_RUN_AS_NODE = '1'
  }

  console.log(`[main] Starting backend from: ${serverEntry}`)
  startProcess(serverCommand, [serverEntry], {
    cwd: dirname(serverEntry),
    env: serverEnv,
  })

  if (isDev) {
    startProcess(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'])
    await waitForUrl('http://127.0.0.1:5173')
    const backendReady = await waitForUrl('http://127.0.0.1:3001/api/state')
    if (!backendReady) {
      console.error('[main] Backend did not start on http://127.0.0.1:3001/api/state')
      await win.loadURL('data:text/html;charset=UTF-8,<html><body style="font-family: sans-serif; padding: 24px;"><h2>Backend failed to start</h2><p>Could not connect to <code>http://127.0.0.1:3001/api/state</code>.</p></body></html>')
      return
    }

    await win.loadURL('http://127.0.0.1:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    const backendReady = await waitForUrl('http://127.0.0.1:3001/api/state')
    if (!backendReady) {
      console.error('[main] Backend did not start on http://127.0.0.1:3001/api/state')
      await win.loadURL('data:text/html;charset=UTF-8,<html><body style="font-family: sans-serif; padding: 24px;"><h2>Backend failed to start</h2><p>Could not connect to <code>http://127.0.0.1:3001/api/state</code>.</p></body></html>')
      return
    }

    const productionIndexPath = isPackaged
      ? resolve(process.resourcesPath, 'app.asar', 'dist', 'index.html')
      : resolve(rootDir, 'dist/index.html')
    await win.loadFile(productionIndexPath)
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
