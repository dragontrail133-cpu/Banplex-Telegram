import http from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const root = path.resolve(__dirname, '..', 'dist')
const port = Number(process.env.PORT ?? 5173)
const host = process.env.HOST ?? '127.0.0.1'

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

function contentType(filePath) {
  return MIME.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream'
}

function isWithinRoot(filePath) {
  const relative = path.relative(root, filePath)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

async function readFileOrNull(filePath) {
  try {
    return await fs.readFile(filePath)
  } catch {
    return null
  }
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath)
    return stat.isFile()
  } catch {
    return false
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? host}`)

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Method Not Allowed')
    return
  }

  const decodedPathname = decodeURIComponent(url.pathname)
  const safePathname = decodedPathname.replaceAll('\\', '/')
  let requestPath = safePathname
  if (requestPath.endsWith('/')) requestPath += 'index.html'
  if (!requestPath.startsWith('/')) requestPath = `/${requestPath}`

  const candidate = path.resolve(root, `.${requestPath}`)
  if (!isWithinRoot(candidate)) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Bad Request')
    return
  }

  let filePath = candidate
  const hasExt = path.extname(filePath) !== ''

  if (!(await fileExists(filePath))) {
    if (!hasExt) {
      const maybeHtml = `${filePath}.html`
      if (await fileExists(maybeHtml)) filePath = maybeHtml
    }
  }

  let body = await readFileOrNull(filePath)
  let statusCode = 200

  if (!body) {
    const indexPath = path.resolve(root, 'index.html')
    body = await readFileOrNull(indexPath)
    statusCode = body ? 200 : 404
    filePath = indexPath
  }

  res.statusCode = statusCode
  res.setHeader('Content-Type', contentType(filePath))
  res.setHeader('Cache-Control', 'no-store')
  res.end(req.method === 'HEAD' ? undefined : body)
})

server.listen(port, host, () => {
  console.log(`serve-dist: http://${host}:${port}`)
})
