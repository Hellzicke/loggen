import express from 'express'
import { PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import multer from 'multer'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const SHARED_PASSWORD = process.env.SHARED_PASSWORD || 'password'

const ARCHIVE_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

// Determine root directory (works in both dev and production)
const rootDir = process.env.NODE_ENV === 'production' 
  ? resolve(__dirname, '..') 
  : resolve(__dirname, '..')

const distDir = join(rootDir, 'dist')
// Use UPLOADS_DIR from env if set (for persistent storage), otherwise use local uploads folder
const uploadsDir = process.env.UPLOADS_DIR || join(rootDir, 'uploads')

// Create uploads directory if it doesn't exist
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  }
})

app.use(express.json())
app.use('/uploads', express.static(uploadsDir))

// Auth middleware for admin
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access denied' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number, username: string }
    req.user = decoded
    next()
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' })
  }
}

// Auth middleware for shared password (simple auth)
const authenticateSharedPassword = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access denied' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { type: string }
    if (decoded.type !== 'shared') {
      return res.status(403).json({ error: 'Invalid token type' })
    }
    next()
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' })
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: { id: number, username: string }
    }
  }
}

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

// Shared password login (for main app)
app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body

  if (!password) {
    return res.status(400).json({ error: 'Password required' })
  }

  if (password !== SHARED_PASSWORD) {
    return res.status(401).json({ error: 'Fel lösenord' })
  }

  const token = jwt.sign({ type: 'shared' }, JWT_SECRET, { expiresIn: '30d' })
  res.json({ token })
})

// Admin login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' })
  }

  try {
    const admin = await prisma.admin.findUnique({ where: { username } })
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, admin.password)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' })
    res.json({ token, username: admin.username })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Get database overview
app.get('/api/admin/overview', authenticateToken, async (_req, res) => {
  try {
    const [logs, comments, signatures, reactions, images] = await Promise.all([
      prisma.logMessage.count(),
      prisma.comment.count(),
      prisma.readSignature.count(),
      prisma.reaction.count(),
      prisma.logMessage.count({ where: { imageUrl: { not: null } } })
    ])

    const logsByStatus = await Promise.all([
      prisma.logMessage.count({ where: { pinned: true } }),
      prisma.logMessage.count({ where: { archived: true } }),
      prisma.logMessage.count({ where: { archived: false } })
    ])

    res.json({
      logs: {
        total: logs,
        pinned: logsByStatus[0],
        archived: logsByStatus[1],
        active: logsByStatus[2]
      },
      comments,
      signatures,
      reactions,
      images
    })
  } catch (error) {
    console.error('Error fetching overview:', error)
    res.status(500).json({ error: 'Failed to fetch overview' })
  }
})

// Get all logs for admin
app.get('/api/admin/logs', authenticateToken, async (req, res) => {
  try {
    const logs = await prisma.logMessage.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        signatures: { select: { id: true, name: true, createdAt: true } },
        comments: { select: { id: true, message: true, author: true, createdAt: true } },
        reactions: { select: { id: true, emoji: true, createdAt: true } }
      }
    })
    res.json(logs)
  } catch (error) {
    console.error('Error fetching logs:', error)
    res.status(500).json({ error: 'Failed to fetch logs' })
  }
})

// Delete log (admin only)
app.delete('/api/admin/logs/:id', authenticateToken, async (req, res) => {
  const logId = parseInt(req.params.id)
  try {
    await prisma.logMessage.delete({ where: { id: logId } })
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting log:', error)
    res.status(500).json({ error: 'Failed to delete log' })
  }
})

// Get all images for admin
app.get('/api/admin/images', authenticateToken, async (_req, res) => {
  try {
    const { readdirSync, statSync } = await import('fs')
    const files = readdirSync(uploadsDir)
      .filter(file => {
        const filePath = join(uploadsDir, file)
        return statSync(filePath).isFile() && /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
      })
      .map(file => {
        const filePath = join(uploadsDir, file)
        const stats = statSync(filePath)
        return {
          filename: file,
          url: `/uploads/${file}`,
          size: stats.size,
          uploadedAt: stats.mtime
        }
      })
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
    
    res.json(files)
  } catch (error) {
    console.error('Error fetching images:', error)
    res.status(500).json({ error: 'Failed to fetch images' })
  }
})

// Delete image (admin only)
app.delete('/api/admin/images/:filename', authenticateToken, async (req, res) => {
  const { unlinkSync } = await import('fs')
  const filename = decodeURIComponent(req.params.filename)
  const filePath = join(uploadsDir, filename)
  
  try {
    // Security: Ensure the file is within uploadsDir (prevent path traversal)
    const resolvedPath = resolve(filePath)
    const resolvedUploadsDir = resolve(uploadsDir)
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      return res.status(403).json({ error: 'Invalid file path' })
    }

    if (existsSync(filePath)) {
      unlinkSync(filePath)
      res.json({ success: true })
    } else {
      res.status(404).json({ error: 'File not found' })
    }
  } catch (error) {
    console.error('Error deleting image:', error)
    res.status(500).json({ error: 'Failed to delete image' })
  }
})

// ========== MEETINGS ENDPOINTS ==========

// Get all upcoming meetings (for regular users)
app.get('/api/meetings/upcoming', authenticateSharedPassword, async (_req, res) => {
  try {
    const now = new Date()
    const meetings = await prisma.meeting.findMany({
      where: {
        scheduledAt: { gte: now },
        archived: false
      },
      orderBy: {
        scheduledAt: 'asc'
      },
      include: {
        points: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })
    res.json(meetings)
  } catch (error) {
    console.error('Error fetching upcoming meetings:', error)
    res.status(500).json({ error: 'Failed to fetch meetings' })
  }
})

// Get archived meetings (for regular users)
app.get('/api/meetings/archived', authenticateSharedPassword, async (_req, res) => {
  try {
    const meetings = await prisma.meeting.findMany({
      where: {
        archived: true
      },
      orderBy: {
        archivedAt: 'desc'
      },
      include: {
        points: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })
    res.json(meetings)
  } catch (error) {
    console.error('Error fetching archived meetings:', error)
    res.status(500).json({ error: 'Failed to fetch archived meetings' })
  }
})

// Archive a meeting (regular users - can archive after scheduled time)
app.post('/api/meetings/:id/archive', authenticateSharedPassword, async (req, res) => {
  const meetingId = parseInt(req.params.id)

  try {
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } })
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' })
    }

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        archived: true,
        archivedAt: new Date()
      },
      include: {
        points: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })
    res.json(updated)
  } catch (error) {
    console.error('Error archiving meeting:', error)
    res.status(500).json({ error: 'Failed to archive meeting' })
  }
})

// Get specific meeting by ID (for regular users)
app.get('/api/meetings/:id', authenticateSharedPassword, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id)
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        points: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' })
    }
    res.json(meeting)
  } catch (error) {
    console.error('Error fetching meeting:', error)
    res.status(500).json({ error: 'Failed to fetch meeting' })
  }
})

// Get next meeting (for regular users) - kept for backwards compatibility
app.get('/api/meetings/next', authenticateSharedPassword, async (_req, res) => {
  try {
    const now = new Date()
    const meeting = await prisma.meeting.findFirst({
      where: {
        scheduledAt: { gte: now },
        archived: false
      },
      orderBy: {
        scheduledAt: 'asc'
      },
      include: {
        points: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })
    res.json(meeting)
  } catch (error) {
    console.error('Error fetching next meeting:', error)
    res.status(500).json({ error: 'Failed to fetch meeting' })
  }
})

// Get all meetings (admin only)
app.get('/api/admin/meetings', authenticateToken, async (_req, res) => {
  try {
    const meetings = await prisma.meeting.findMany({
      orderBy: {
        scheduledAt: 'desc'
      },
      include: {
        points: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })
    res.json(meetings)
  } catch (error) {
    console.error('Error fetching meetings:', error)
    res.status(500).json({ error: 'Failed to fetch meetings' })
  }
})

// Create meeting (admin only)
app.post('/api/admin/meetings', authenticateToken, async (req, res) => {
  const { title, scheduledAt } = req.body
  
  if (!title || !scheduledAt) {
    return res.status(400).json({ error: 'Title and scheduledAt are required' })
  }

  try {
    const meeting = await prisma.meeting.create({
      data: {
        title,
        scheduledAt: new Date(scheduledAt)
      },
      include: {
        points: true
      }
    })
    res.json(meeting)
  } catch (error) {
    console.error('Error creating meeting:', error)
    res.status(500).json({ error: 'Failed to create meeting' })
  }
})

// Update meeting (admin only)
app.put('/api/admin/meetings/:id', authenticateToken, async (req, res) => {
  const meetingId = parseInt(req.params.id)
  const { title, scheduledAt } = req.body

  try {
    const meeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        ...(title && { title }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) })
      },
      include: {
        points: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })
    res.json(meeting)
  } catch (error) {
    console.error('Error updating meeting:', error)
    res.status(500).json({ error: 'Failed to update meeting' })
  }
})

// Delete meeting (admin only)
app.delete('/api/admin/meetings/:id', authenticateToken, async (req, res) => {
  const meetingId = parseInt(req.params.id)

  try {
    await prisma.meeting.delete({
      where: { id: meetingId }
    })
    res.json({ success: true, id: meetingId })
  } catch (error) {
    console.error('Error deleting meeting:', error)
    res.status(500).json({ error: 'Failed to delete meeting' })
  }
})

// Get user statistics (admin only)
app.get('/api/admin/user-stats', authenticateToken, async (_req, res) => {
  try {
    // Get all unique users from different sources
    const [allLogs, allSignatures, allComments] = await Promise.all([
      prisma.logMessage.findMany({ select: { id: true, author: true } }),
      prisma.readSignature.findMany({ select: { name: true, logId: true } }),
      prisma.comment.findMany({ select: { author: true } })
    ])

    const totalLogs = allLogs.length
    const userStatsMap = new Map<string, {
      name: string
      postsCreated: number
      signaturesCount: number
      signaturesPercentage: number
      commentsCount: number
    }>()

    // Count posts created by each user
    allLogs.forEach(log => {
      const name = log.author
      if (!userStatsMap.has(name)) {
        userStatsMap.set(name, {
          name,
          postsCreated: 0,
          signaturesCount: 0,
          signaturesPercentage: 0,
          commentsCount: 0
        })
      }
      const stats = userStatsMap.get(name)!
      stats.postsCreated++
    })

    // Count signatures for each user
    allSignatures.forEach(sig => {
      const name = sig.name
      if (!userStatsMap.has(name)) {
        userStatsMap.set(name, {
          name,
          postsCreated: 0,
          signaturesCount: 0,
          signaturesPercentage: 0,
          commentsCount: 0
        })
      }
      const stats = userStatsMap.get(name)!
      stats.signaturesCount++
    })

    // Count comments for each user
    allComments.forEach(comment => {
      const name = comment.author
      if (!userStatsMap.has(name)) {
        userStatsMap.set(name, {
          name,
          postsCreated: 0,
          signaturesCount: 0,
          signaturesPercentage: 0,
          commentsCount: 0
        })
      }
      const stats = userStatsMap.get(name)!
      stats.commentsCount++
    })

    // Calculate percentages
    const userStats = Array.from(userStatsMap.values()).map(stats => ({
      ...stats,
      signaturesPercentage: totalLogs > 0 
        ? Math.round((stats.signaturesCount / totalLogs) * 100 * 100) / 100 
        : 0
    }))

    // Sort by signatures count (most active first)
    userStats.sort((a, b) => b.signaturesCount - a.signaturesCount)

    res.json({
      totalLogs,
      users: userStats
    })
  } catch (error) {
    console.error('Error fetching user stats:', error)
    res.status(500).json({ error: 'Failed to fetch user statistics' })
  }
})

// Add meeting point (regular users)
app.post('/api/meetings/:id/points', authenticateSharedPassword, async (req, res) => {
  const meetingId = parseInt(req.params.id)
  const { title, description, author } = req.body

  if (!title || !author) {
    return res.status(400).json({ error: 'Title and author are required' })
  }

  try {
    const point = await prisma.meetingPoint.create({
      data: {
        title,
        description: description || '',
        author,
        meetingId
      }
    })
    res.json(point)
  } catch (error) {
    console.error('Error creating meeting point:', error)
    res.status(500).json({ error: 'Failed to create meeting point' })
  }
})

// Update meeting point (regular users)
app.put('/api/meetings/:id/points/:pointId', authenticateSharedPassword, async (req, res) => {
  const pointId = parseInt(req.params.pointId)
  const { title, description, author, completed, notes } = req.body

  if (title !== undefined && (!title || !author)) {
    return res.status(400).json({ error: 'Title and author are required when updating title' })
  }

  try {
    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description || null
    if (author !== undefined) updateData.author = author
    if (completed !== undefined) {
      updateData.completed = completed
      updateData.completedAt = completed ? new Date() : null
    }
    if (notes !== undefined) updateData.notes = notes || null

    const point = await prisma.meetingPoint.update({
      where: { id: pointId },
      data: updateData
    })
    res.json(point)
  } catch (error) {
    console.error('Error updating meeting point:', error)
    res.status(500).json({ error: 'Failed to update meeting point' })
  }
})

// Delete meeting point (regular users - can delete their own)
app.delete('/api/meetings/:id/points/:pointId', authenticateSharedPassword, async (req, res) => {
  const pointId = parseInt(req.params.pointId)

  try {
    await prisma.meetingPoint.delete({
      where: { id: pointId }
    })
    res.json({ success: true, id: pointId })
  } catch (error) {
    console.error('Error deleting meeting point:', error)
    res.status(500).json({ error: 'Failed to delete meeting point' })
  }
})

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
app.get('/api/logs', authenticateSharedPassword, async (_req, res) => {
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
app.get('/api/logs/archived', authenticateSharedPassword, async (_req, res) => {
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

// Upload image
app.post('/api/upload', authenticateSharedPassword, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }
  res.json({ url: `/uploads/${req.file.filename}` })
})

// Get all uploaded images
app.get('/api/images', authenticateSharedPassword, async (_req, res) => {
  try {
    const { readdirSync, statSync } = await import('fs')
    const files = readdirSync(uploadsDir)
      .filter(file => {
        const filePath = join(uploadsDir, file)
        return statSync(filePath).isFile() && /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
      })
      .map(file => ({
        filename: file,
        url: `/uploads/${file}`,
        uploadedAt: statSync(join(uploadsDir, file)).mtime
      }))
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
    
    res.json(files)
  } catch (error) {
    console.error('Error fetching images:', error)
    res.status(500).json({ error: 'Failed to fetch images' })
  }
})

// Create a new log message
app.post('/api/logs', authenticateSharedPassword, async (req, res) => {
  const { title, message, author, imageUrl } = req.body

  if (!message || !author) {
    return res.status(400).json({ error: 'Message and author are required' })
  }

  try {
    const log = await prisma.logMessage.create({
      data: {
        title: title?.trim() || '',
        message,
        author,
        version,
        imageUrl: imageUrl || null
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
app.put('/api/logs/:id', authenticateSharedPassword, async (req, res) => {
  const logId = parseInt(req.params.id)
  const { title, message, imageUrl } = req.body

  if (!message) {
    return res.status(400).json({ error: 'Message is required' })
  }

  try {
    const updated = await prisma.logMessage.update({
      where: { id: logId },
      data: { 
        title: title?.trim() || '',
        message: message.trim(),
        imageUrl: imageUrl || null
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
app.post('/api/logs/:id/pin', authenticateSharedPassword, async (req, res) => {
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
app.post('/api/logs/:id/archive', authenticateSharedPassword, async (req, res) => {
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
app.post('/api/logs/:id/unarchive', authenticateSharedPassword, async (req, res) => {
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
app.post('/api/logs/:id/sign', authenticateSharedPassword, async (req, res) => {
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
app.post('/api/logs/:id/comments', authenticateSharedPassword, async (req, res) => {
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
app.post('/api/logs/:id/reactions', authenticateSharedPassword, async (req, res) => {
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

// Clear test data
app.post('/api/clear-test-data', async (_req, res) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' })
  }

  try {
    const testTitles = [
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

    const result = await prisma.logMessage.deleteMany({
      where: {
        title: {
          in: testTitles
        }
      }
    })

    res.json({ success: true, deleted: result.count })
  } catch (error) {
    console.error('Error clearing test data:', error)
    res.status(500).json({ error: 'Failed to clear test data' })
  }
})

// Seed test data (for development only)
app.post('/api/seed-test-data', async (_req, res) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' })
  }
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

// Delete a log message
app.delete('/api/logs/:id', authenticateSharedPassword, async (req, res) => {
  const logId = parseInt(req.params.id)

  try {
    await prisma.logMessage.delete({
      where: { id: logId }
    })
    res.json({ success: true, id: logId })
  } catch (error) {
    console.error('Error deleting log:', error)
    res.status(500).json({ error: 'Failed to delete log' })
  }
})

// Delete a comment (and its replies via cascade)
app.delete('/api/comments/:id', authenticateSharedPassword, async (req, res) => {
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
