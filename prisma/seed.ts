import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

async function main() {
  console.log('Seeding database with test posts...')

  const now = new Date()
  
  for (let i = 0; i < 10; i++) {
    // Random date within the last 6 months
    const monthsAgo = Math.floor(Math.random() * 6)
    const daysAgo = Math.floor(Math.random() * 28)
    const date = new Date(now)
    date.setMonth(date.getMonth() - monthsAgo)
    date.setDate(date.getDate() - daysAgo)

    const author = authors[Math.floor(Math.random() * authors.length)]
    const title = titles[i]
    const message = messages[i]

    // Some posts are archived (older than 30 days and not pinned)
    const daysSinceCreated = (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)
    const shouldArchive = daysSinceCreated > 30 && Math.random() > 0.3

    await prisma.logMessage.create({
      data: {
        title,
        message,
        author,
        version: '0.4.3',
        pinned: false,
        archived: shouldArchive,
        archivedAt: shouldArchive ? new Date() : null,
        createdAt: date
      }
    })

    console.log(`Created: "${title}" by ${author} (${date.toLocaleDateString('sv-SE')})${shouldArchive ? ' [archived]' : ''}`)
  }

  console.log('Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

