import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const username = process.argv[2]
  const password = process.argv[3]

  if (!username || !password) {
    console.error('Usage: tsx scripts/create-admin.ts <username> <password>')
    process.exit(1)
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    const admin = await prisma.admin.create({
      data: {
        username,
        password: hashedPassword
      }
    })
    console.log(`Admin created: ${admin.username}`)
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.error('Username already exists')
    } else {
      console.error('Error:', error)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

