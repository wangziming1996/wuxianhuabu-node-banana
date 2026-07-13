import http from 'http'
import fs from 'fs'
import path from 'path'
import { createReadStream } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')
const DEV_PORT = 5420
const PROXY_PORT = 5430

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
}

function serveStatic(req, res) {
  let filePath = path.join(DIST, req.url.split('?')[0])
  if (filePath.endsWith('/')) filePath = path.join(filePath, 'index.html')
  if (!path.extname(filePath)) filePath = path.join(filePath, '.html')
  // SPA fallback
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST, 'index.html')
  }

  const ext = path.extname(filePath)
  const contentType = MIME[ext] || 'application/octet-stream'

  try {
    const stat = fs.statSync(filePath)
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'max-age=31536000',
    })
    createReadStream(filePath).pipe(res)
  } catch {
    // 404 → SPA fallback
    const fallback = path.join(DIST, 'index.html')
    try {
      const stat = fs.statSync(fallback)
      res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': stat.size })
      createReadStream(fallback).pipe(res)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  }
}

function proxyAPI(req, res) {
  const options = {
    hostname: 'localhost',
    port: DEV_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${DEV_PORT}` },
  }

  const proxyReq = http.request(options, (proxyRes) => {
    // Stream video data as-is
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message)
    res.writeHead(502)
    res.end('Bad Gateway')
  })

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq)
  } else {
    proxyReq.end()
  }
}

const server = http.createServer((req, res) => {
  const url = req.url || '/'
  if (url.startsWith('/api/')) {
    proxyAPI(req, res)
  } else {
    serveStatic(req, res)
  }
})

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`Proxy server running on http://0.0.0.0:${PROXY_PORT}`)
  console.log(`  Static:  dist/ (built files)`)
  console.log(`  API:     → http://localhost:${DEV_PORT}`)
})