/// <reference types="react-native" />

// Process env for TypeScript
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL: string;
    EXPO_PUBLIC_SUPABASE_KEY: string;
    EXPO_PUBLIC_GOOGLE_MAP_KEY: string;
    EXPO_PUBLIC_LOCATION_IQ_TOKEN: string;
    EXPO_PUBLIC_MAPTILER_KEY: string;
  }
}
