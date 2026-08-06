import http from 'http'
import { writeFileSync } from 'fs'

const data = JSON.stringify({ prompt: 'sunset', style: 'Flat', aspectRatio: '1:1' })
const start = Date.now()

console.log(`[${new Date().toISOString()}] Starting image gen request`)

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/ai/images',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
  timeout: 180000,
}, (res) => {
  let body = ''
  res.on('data', (c) => body += c)
  res.on('end', () => {
    const elapsed = Date.now() - start
    writeFileSync('/home/z/my-project/img-result.json', body)
    writeFileSync('/home/z/my-project/img-done.txt', `DONE in ${elapsed}ms (status ${res.statusCode})`)
    console.log(`[${new Date().toISOString()}] Completed in ${elapsed}ms, status ${res.statusCode}, body ${body.length} bytes`)
    process.exit(0)
  })
})
req.on('error', (e) => {
  writeFileSync('/home/z/my-project/img-done.txt', `ERROR: ${e.message}`)
  console.error(`[${new Date().toISOString()}] Error: ${e.message}`)
  process.exit(1)
})
req.on('timeout', () => {
  writeFileSync('/home/z/my-project/img-done.txt', 'TIMEOUT')
  console.error(`[${new Date().toISOString()}] Timeout`)
  process.exit(1)
})
req.write(data)
req.end()
