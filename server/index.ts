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

const ARCHIVE_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

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
let version = '0.4.1'
try {
  const packageJsonPath = join(rootDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  version = packageJson.version
} catch (e) {
  console.error('Could not read package.json:', e)
}

// Helper: Check if a post should be auto-archived
function shouldAutoArchive(log: { pinned: boolean; archived: boolean; createdAt: Date; unpinnedAt: Date | null }): boolean {
  if (log.pinned || log.archived) return false
  
  const now = new Date()
  const referenceDate = log.unpinnedAt || log.createdAt
  const daysSince = (now.getTime() - new Date(referenceDate).getTime()) / MS_PER_DAY
  
  return daysSince >= ARCHIVE_DAYS
}

// Helper: Auto-archive old posts
async function autoArchiveOldPosts() {
  const cutoffDate = new Date(Date.now() - ARCHIVE_DAYS * MS_PER_DAY)
  
  // Archive posts that are:
  // 1. Not pinned, not archived, and created more than 30 days ago (with no unpinnedAt)
  // 2. Not pinned, not archived, and unpinned more than 30 days ago
  await prisma.logMessage.updateMany({
    where: {
      archived: false,
      pinned: false,
      OR: [
        { unpinnedAt: null, createdAt: { lt: cutoffDate } },
        { unpinnedAt: { lt: cutoffDate } }
      ]
    },
    data: {
      archived: true,
      archivedAt: new Date()
    }
  })
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

// Get all active (non-archived) log messages
app.get('/api/logs', async (_req, res) => {
  try {
    // Auto-archive old posts first
    await autoArchiveOldPosts()
    
    const logs = await prisma.logMessage.findMany({
      where: { archived: false },
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

// Get archived log messages
app.get('/api/logs/archived', async (_req, res) => {
  try {
    const logs = await prisma.logMessage.findMany({
      where: { archived: true },
      orderBy: { archivedAt: 'desc' },
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
    console.error('Error fetching archived logs:', error)
    res.status(500).json({ error: 'Failed to fetch archived logs' })
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
        comments: true,
        reactions: true
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
        },
        reactions: true
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

    const willBeUnpinned = log.pinned
    const now = new Date()
    
    // Check if unpinning an old post (older than 30 days)
    const daysSinceCreated = (now.getTime() - new Date(log.createdAt).getTime()) / MS_PER_DAY
    const isOldPost = daysSinceCreated >= ARCHIVE_DAYS

    const updated = await prisma.logMessage.update({
      where: { id: logId },
      data: { 
        pinned: !log.pinned,
        unpinnedAt: willBeUnpinned ? now : null
      },
      include: {
        signatures: true,
        comments: {
          where: { parentId: null },
          include: { replies: true }
        },
        reactions: true
      }
    })
    
    // Return extra info if unpinning an old post
    res.json({
      ...updated,
      _unpinningOldPost: willBeUnpinned && isOldPost
    })
  } catch (error) {
    console.error('Error toggling pin:', error)
    res.status(500).json({ error: 'Failed to toggle pin' })
  }
})

// Archive a log
app.post('/api/logs/:id/archive', async (req, res) => {
  const logId = parseInt(req.params.id)

  try {
    const updated = await prisma.logMessage.update({
      where: { id: logId },
      data: { 
        archived: true,
        archivedAt: new Date(),
        pinned: false
      },
      include: {
        signatures: true,
        comments: {
          where: { parentId: null },
          include: { replies: true }
        },
        reactions: true
      }
    })
    res.json(updated)
  } catch (error) {
    console.error('Error archiving log:', error)
    res.status(500).json({ error: 'Failed to archive log' })
  }
})

// Unarchive a log
app.post('/api/logs/:id/unarchive', async (req, res) => {
  const logId = parseInt(req.params.id)

  try {
    const updated = await prisma.logMessage.update({
      where: { id: logId },
      data: { 
        archived: false,
        archivedAt: null,
        unpinnedAt: new Date() // Reset the 30-day timer
      },
      include: {
        signatures: true,
        comments: {
          where: { parentId: null },
          include: { replies: true }
        },
        reactions: true
      }
    })
    res.json(updated)
  } catch (error) {
    console.error('Error unarchiving log:', error)
    res.status(500).json({ error: 'Failed to unarchive log' })
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

// Seed test data (for development)
app.post('/api/seed-test-data', async (_req, res) => {
  const authors = ['Anna', 'Erik', 'Maria', 'Johan', 'Lisa', 'Oscar', 'Emma', 'Karl']
  const titles = [
    'Ny rutin för morgonmöten',
    'Uppdatering av systemet',
    'Viktig information',
    'Semesterplanering',
    'Städdag på kontoret',
    'Ny kollega börjar',
    'Feedback från kunder',
    'Projektuppdatering',
    'Fikapaus kl 15',
    'Kontorsflytt nästa vecka'
  ]
  const messages = [
    'Kom ihåg att läsa igenom dokumentet innan mötet imorgon.',
    'Vi har uppdaterat rutinerna, se bifogad fil för mer info.',
    'Tack för ert hårda arbete den senaste tiden!',
    'Glöm inte att registrera era timmar innan fredag.',
    'Mötet flyttas till rum 3B istället.',
    'Alla behöver signera den nya policyn.',
    'Grattis till teamet för ett lyckat projekt!',
    'Påminnelse om att låsa dörren när ni går.',
    'Ny kaffemaskin har installerats i fikarummet.',
    'Tack för en bra vecka allihop!'
  ]

  try {
    const now = new Date()
    const created = []
    
    for (let i = 0; i < 10; i++) {
      const monthsAgo = Math.floor(Math.random() * 6)
      const daysAgo = Math.floor(Math.random() * 28)
      const date = new Date(now)
      date.setMonth(date.getMonth() - monthsAgo)
      date.setDate(date.getDate() - daysAgo)

      const author = authors[Math.floor(Math.random() * authors.length)]
      const title = titles[i]
      const message = messages[i]

      const daysSinceCreated = (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)
      const shouldArchive = daysSinceCreated > 30 && Math.random() > 0.3

      const log = await prisma.logMessage.create({
        data: {
          title,
          message,
          author,
          version,
          pinned: false,
          archived: shouldArchive,
          archivedAt: shouldArchive ? new Date() : null,
          createdAt: date
        }
      })

      created.push({ id: log.id, title, author, date: date.toISOString(), archived: shouldArchive })
    }

    res.json({ success: true, created })
  } catch (error) {
    console.error('Error seeding:', error)
    res.status(500).json({ error: 'Failed to seed' })
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
