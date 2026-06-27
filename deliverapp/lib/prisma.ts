// Only import and use Prisma on the server side
// Handle gracefully when Prisma is not available

declare global {
  var prisma: any | undefined;
}

// For frontend, we'll export a dummy client and handle the difference
let prisma: any;

// Check if we're in a Node.js environment (server-side)
const isServer = typeof window === 'undefined' && typeof process !== 'undefined';

if (isServer) {
  try {
    // Server-side only - try to import Prisma
    const { PrismaClient } = require("@prisma/client");
    prisma = global.prisma || new PrismaClient();

    if (process.env.NODE_ENV !== "production") global.prisma = prisma;
  } catch (error) {
    console.warn('Prisma not available on server:', error);
    // Create a dummy client that throws errors
    prisma = {
      $connect: () => Promise.reject(new Error('Prisma is not available')),
      $disconnect: () => Promise.reject(new Error('Prisma is not available')),
      $transaction: () => Promise.reject(new Error('Prisma is not available')),
    };
  }
} else {
  // Client-side (browser) - Create a dummy client that throws errors
  // This is just to satisfy TypeScript, but any attempt to use it will fail
  prisma = {
    $connect: () => Promise.reject(new Error('Prisma is not available on the client side')),
    $disconnect: () => Promise.reject(new Error('Prisma is not available on the client side')),
    $transaction: () => Promise.reject(new Error('Prisma is not available on the client side')),
    // Add other methods as needed
  } as any;

  console.warn('Prisma is not available on the client side. Use API calls instead.');
}

export { prisma };
