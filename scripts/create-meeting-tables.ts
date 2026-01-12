import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

async function main() {
  try {
    // Read the migration SQL file
    const migrationPath = join(process.cwd(), 'prisma/migrations/20241129000011_add_meetings/migration.sql')
    const sql = readFileSync(migrationPath, 'utf-8')
    
    // Split by semicolons and execute each statement
    const statements = sql.split(';').filter(s => s.trim().length > 0)
    
    for (const statement of statements) {
      const trimmed = statement.trim()
      if (trimmed) {
        console.log('Executing:', trimmed.substring(0, 50) + '...')
        await prisma.$executeRawUnsafe(trimmed)
      }
    }
    
    console.log('✅ Meeting tables created successfully!')
  } catch (error: any) {
    if (error.message?.includes('already exists') || error.code === '42P07') {
      console.log('✅ Tables already exist')
    } else {
      console.error('❌ Error:', error.message)
      process.exit(1)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main()


