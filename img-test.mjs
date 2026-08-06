import http from 'http'
import { writeFileSync } from 'fs'

const data = JSON.stringify({ prompt: 'mountain sunset', style: 'Cinematic', aspectRatio: '16:9' })
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/ai/images',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
  timeout: 180000,
}

console.log('Starting image gen request at', new Date().toISOString())
const start = Date.now()
const req = http.request(options, (res) => {
  let body = ''
  res.on('data', (c) => body += c)
  res.on('end', () => {
    writeFileSync('/home/z/my-project/img-result.json', body)
    writeFileSync('/home/z/my-project/img-done.txt', 'DONE')
    console.log('Completed in', Date.now() - start, 'ms')
    console.log('Status:', res.statusCode)
    console.log('Body length:', body.length)
  })
})
req.on('error', (e) => {
  console.error('Error:', e.message)
  writeFileSync('/home/z/my-project/img-done.txt', 'ERROR: ' + e.message)
})
req.write(data)
req.end()
