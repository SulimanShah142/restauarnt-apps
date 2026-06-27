// Empty module for expo-sqlite on web
// This prevents expo-sqlite from being bundled on web

export default {};
export const openDatabaseAsync = () => {
  throw new Error('SQLite is not available on web');
};
