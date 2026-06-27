// Only import and use Prisma on the server side
// Handle the case where PrismaClient doesn't exist

// Define PrismaClient type locally since the module might not export it
interface PrismaClientInterface {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $transaction<T>(fn: (prisma: any) => Promise<T>): Promise<T>;
  [key: string]: any;
}

// Dynamically check if PrismaClient is available
let PrismaClient: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const prismaModule = require("@prisma/client");
  PrismaClient = prismaModule.PrismaClient;
} catch (error) {
  console.warn('Prisma client not available:', error);
  PrismaClient = null;
}

declare global {
  var prisma: PrismaClientInterface | undefined;
}

// For frontend, we'll export a dummy client and handle the difference
let prisma: PrismaClientInterface;

// Check if we're in a Node.js environment (server-side) and PrismaClient is available
const isServer = typeof window === 'undefined' && typeof process !== 'undefined';

if (isServer && PrismaClient) {
  // Server-side only
  prisma = global.prisma || new PrismaClient();

  if (process.env.NODE_ENV !== "production") global.prisma = prisma;
} else {
  // Client-side (browser) or Prisma not available - Create a dummy client that throws errors
  // This is just to satisfy TypeScript, but any attempt to use it will fail
  prisma = {
    $connect: () => Promise.reject(new Error('Prisma is not available on the client side')),
    $disconnect: () => Promise.reject(new Error('Prisma is not available on the client side')),
    $transaction: () => Promise.reject(new Error('Prisma is not available on the client side')),
    // Add other methods as needed
  } as PrismaClientInterface;

  console.warn('Prisma is not available on the client side. Use API calls instead.');
}

export { prisma };
export type { PrismaClientInterface as PrismaClient };