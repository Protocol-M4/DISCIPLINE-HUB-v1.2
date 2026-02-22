import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const PORT = process.env.PORT || 3001
const DATA_FILE = resolve(process.cwd(), 'data.json')

const INITIAL_STATE = {
  weeks: {},
  unlocked: [],
}

async function ensureDataFile() {
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

server.listen(PORT, () => {
  console.log(`State API running on http://localhost:${PORT}`)
})
