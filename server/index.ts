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
let version = '0.2.0'
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

// Get all log messages with signatures, comments and reactions
app.get('/api/logs', async (_req, res) => {
  try {
    const logs = await prisma.logMessage.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        signatures: {
          orderBy: { createdAt: 'asc' }
        },
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: 'asc' },
          include: {
            replies: {
              orderBy: { createdAt: 'asc' }
            }
          }
        },
        reactions: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })
    res.json(logs)
  } catch (error) {
    console.error('Error fetching logs:', error)
    res.status(500).json({ error: 'Failed to fetch logs' })
  }
})

// Create a new log message
app.post('/api/logs', async (req, res) => {
  const { title, message, author } = req.body

  if (!message || !author) {
    return res.status(400).json({ error: 'Message and author are required' })
  }

  try {
    const log = await prisma.logMessage.create({
      data: {
        title: title?.trim() || '',
        message,
        author,
        version
      },
      include: {
        signatures: true,
        comments: true
      }
    })
    res.status(201).json(log)
  } catch (error) {
    console.error('Error creating log:', error)
    res.status(500).json({ error: 'Failed to create log' })
  }
})

// Edit a log message
app.put('/api/logs/:id', async (req, res) => {
  const logId = parseInt(req.params.id)
  const { title, message } = req.body

  if (!message) {
    return res.status(400).json({ error: 'Message is required' })
  }

  try {
    const updated = await prisma.logMessage.update({
      where: { id: logId },
      data: { 
        title: title?.trim() || '',
        message: message.trim() 
      },
      include: {
        signatures: true,
        comments: {
          where: { parentId: null },
          include: { replies: true }
        }
      }
    })
    res.json(updated)
  } catch (error) {
    console.error('Error updating log:', error)
    res.status(500).json({ error: 'Failed to update log' })
  }
})

// Toggle pin on a log
app.post('/api/logs/:id/pin', async (req, res) => {
  const logId = parseInt(req.params.id)

  try {
    const log = await prisma.logMessage.findUnique({ where: { id: logId } })
    if (!log) {
      return res.status(404).json({ error: 'Log not found' })
    }

    const updated = await prisma.logMessage.update({
      where: { id: logId },
      data: { pinned: !log.pinned },
      include: {
        signatures: true,
        comments: {
          where: { parentId: null },
          include: { replies: true }
        }
      }
    })
    res.json(updated)
  } catch (error) {
    console.error('Error toggling pin:', error)
    res.status(500).json({ error: 'Failed to toggle pin' })
  }
})

// Add signature to a log
app.post('/api/logs/:id/sign', async (req, res) => {
  const logId = parseInt(req.params.id)
  const { name } = req.body

  if (!name) {
    return res.status(400).json({ error: 'Name is required' })
  }

  try {
    const signature = await prisma.readSignature.create({
      data: {
        name: name.trim(),
        logId
      }
    })
    res.status(201).json(signature)
  } catch (error: unknown) {
    // Check if it's a unique constraint violation (already signed)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return res.status(409).json({ error: 'Already signed' })
    }
    console.error('Error creating signature:', error)
    res.status(500).json({ error: 'Failed to sign' })
  }
})

// Add comment to a log
app.post('/api/logs/:id/comments', async (req, res) => {
  const logId = parseInt(req.params.id)
  const { message, author, parentId } = req.body

  if (!message || !author) {
    return res.status(400).json({ error: 'Message and author are required' })
  }

  try {
    const comment = await prisma.comment.create({
      data: {
        message: message.trim(),
        author: author.trim(),
        logId,
        parentId: parentId || null
      },
      include: {
        replies: true
      }
    })
    res.status(201).json(comment)
  } catch (error) {
    console.error('Error creating comment:', error)
    res.status(500).json({ error: 'Failed to create comment' })
  }
})

// Add reaction to a log
app.post('/api/logs/:id/reactions', async (req, res) => {
  const logId = parseInt(req.params.id)
  const { emoji } = req.body

  if (!emoji) {
    return res.status(400).json({ error: 'Emoji is required' })
  }

  try {
    const reaction = await prisma.reaction.create({
      data: {
        emoji,
        logId
      }
    })
    res.status(201).json(reaction)
  } catch (error) {
    console.error('Error adding reaction:', error)
    res.status(500).json({ error: 'Failed to add reaction' })
  }
})

// Delete a comment (and its replies via cascade)
app.delete('/api/comments/:id', async (req, res) => {
  const commentId = parseInt(req.params.id)

  try {
    await prisma.comment.delete({
      where: { id: commentId }
    })
    res.json({ success: true, id: commentId })
  } catch (error) {
    console.error('Error deleting comment:', error)
    res.status(500).json({ error: 'Failed to delete comment' })
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
