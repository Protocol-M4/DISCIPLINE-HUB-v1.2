import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const out = resolve(root, 'build', 'icon.png')

function crc32(buf) {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}

function ringPixel(x, y) {
  const cx = 256
  const cy = 256
  const dx = x - cx
  const dy = y - cy
  const r = Math.sqrt(dx * dx + dy * dy)

  let rr = 10
  let gg = 16
  let bb = 30

  if (Math.abs(r - 190) < 10) [rr, gg, bb] = [0, 180, 220]
  if (Math.abs(r - 150) < 6) [rr, gg, bb] = [0, 220, 255]

  if (r < 78) {
    const t = Math.max(0, 1 - r / 78)
    rr = Math.floor(120 * t)
    gg = Math.floor(210 + 45 * t)
    bb = 255
  }

  if (r < 38) [rr, gg, bb] = [190, 250, 255]

  return [rr, gg, bb, 255]
}

function buildPng(size = 512) {
  const rows = []
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4)
    row[0] = 0
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = ringPixel(x, y)
      const i = 1 + x * 4
      row[i] = r
      row[i + 1] = g
      row[i + 2] = b
      row[i + 3] = a
    }
    rows.push(row)
  }

  const raw = Buffer.concat(rows)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

await mkdir(resolve(root, 'build'), { recursive: true })
await writeFile(out, buildPng(512))
console.log('Generated icon:', out)
