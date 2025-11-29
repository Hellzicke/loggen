import express from 'express'
import { PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { readFileSync, existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3001

// Determine root directory (works in both dev and production)
const rootDir = process.env.NODE_ENV === 'production' 
  ? resolve(__dirname, '..') 
  : resolve(__dirname, '..')

const distDir = join(rootDir, 'dist')

app.use(express.json())

// Serve static files
if (existsSync(distDir)) {
  app.use(express.static(distDir))
}

// Get package.json version
let version = '1.0.0'
try {
  const packageJsonPath = join(rootDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  version = packageJson.version
} catch (e) {
  console.error('Could not read package.json:', e)
}

// Get changelog
app.get('/api/changelog', (_req, res) => {
  try {
    const changelog = readFileSync(join(rootDir, 'CHANGELOG.md'), 'utf-8')
    res.json({ changelog })
  } catch {
    res.json({ changelog: 'No changelog available.' })
  }
})

// Get version
app.get('/api/version', (_req, res) => {
  res.json({ version })
})

// Get all log messages
app.get('/api/logs', async (_req, res) => {
  try {
    const logs = await prisma.logMessage.findMany({
      orderBy: { createdAt: 'desc' }
    })
    res.json(logs)
  } catch (error) {
    console.error('Error fetching logs:', error)
    res.status(500).json({ error: 'Failed to fetch logs' })
  }
})

// Create a new log message
app.post('/api/logs', async (req, res) => {
  const { message, author } = req.body

  if (!message || !author) {
    return res.status(400).json({ error: 'Message and author are required' })
  }

  try {
    const log = await prisma.logMessage.create({
      data: {
        message,
        author,
        version
      }
    })
    res.status(201).json(log)
  } catch (error) {
    console.error('Error creating log:', error)
    res.status(500).json({ error: 'Failed to create log' })
  }
})

// Serve React app for all other routes
app.get('*', (_req, res) => {
  const indexPath = join(distDir, 'index.html')
  if (existsSync(indexPath)) {
    res.sendFile(indexPath)
  } else {
    res.status(404).send('App not built. Run npm run build first.')
  }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Root dir: ${rootDir}`)
  console.log(`Dist dir: ${distDir}`)
  console.log(`Dist exists: ${existsSync(distDir)}`)
})
