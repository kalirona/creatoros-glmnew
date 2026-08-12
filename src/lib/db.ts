import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Disable query logging in production for performance.
// In development, query logging helps debug but adds ~20% overhead.
const logConfig = process.env.NODE_ENV === 'production' ? [] : ['query']

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logConfig as any,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db