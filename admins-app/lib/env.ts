// lib/env.ts
// Environment variables for the admin app
// Note: Admin credentials are hardcoded in lib/admin-auth.ts for security

// Define the environment variables interface
interface EnvVars {
  EXPO_PUBLIC_ADMIN_EMAIL?: string; // Deprecated: credentials are hardcoded
  EXPO_PUBLIC_ADMIN_PASSWORD?: string; // Deprecated: credentials are hardcoded
}

// Default values - admin credentials are now hardcoded in admin-auth.ts
const DEFAULT_ENV: EnvVars = {
  EXPO_PUBLIC_ADMIN_EMAIL: undefined, // No longer used
  EXPO_PUBLIC_ADMIN_PASSWORD: undefined // No longer used
};

// Function to get environment variables
export const getEnvVar = (key: keyof EnvVars): string | undefined => {
  // In React Native, environment variables are accessed differently
  // The values are injected at build time by Metro bundler
  const value = process.env[key];

  if (!value) {
    // Return default value if not set
    return DEFAULT_ENV[key];
  }

  return value;
};

// Admin credentials are now hardcoded in admin-auth.ts
// ADMIN_CREDENTIALS export removed for security