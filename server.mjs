import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

const PORT = process.env.PORT || 3001
const DATA_FILE = process.env.DISCIPLINE_DATA_FILE

const INITIAL_STATE = {
  weeks: {},
  unlocked: [],
}

async function ensureDataFile() {
  if (!DATA_FILE) {
    throw new Error('DISCIPLINE_DATA_FILE is not set')
  }

  await mkdir(dirname(DATA_FILE), { recursive: true })

  if (!existsSync(DATA_FILE)) {
    await writeFile(DATA_FILE, `${JSON.stringify(INITIAL_STATE, null, 2)}\n`, 'utf-8')
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(data))
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (req.url === '/api/state' && req.method === 'GET') {
    try {
      await ensureDataFile()
      const raw = await readFile(DATA_FILE, 'utf-8')
      sendJson(res, 200, JSON.parse(raw || '{}'))
    } catch (error) {
      sendJson(res, 500, { error: `read_failed: ${error.message}` })
    }
    return
  }

  if (req.url === '/api/state' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', async () => {
      try {
        await ensureDataFile()
        const data = JSON.parse(body || '{}')
        await writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
        sendJson(res, 200, { ok: true })
      } catch (error) {
        sendJson(res, 400, { error: `write_failed: ${error.message}` })
      }
    })
    return
  }

  sendJson(res, 404, { error: 'not_found' })
})

if (!DATA_FILE) {
  console.error('Missing DISCIPLINE_DATA_FILE env var for state storage')
  process.exit(1)
}

server.listen(PORT, () => {
  console.log(`State API running on http://localhost:${PORT}`)
})
