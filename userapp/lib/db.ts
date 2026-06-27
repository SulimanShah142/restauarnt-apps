// Mock database implementation for React Native
// In a real application, you would make API calls to your backend server
// This mock implementation simulates database operations

interface MockPool {
  query: (sql: string, params?: any[]) => Promise<[any[], any[]]>;
}

const mockPool: MockPool = {
  query: async (sql: string, params?: any[]) => {

    // This mock implementation should not be used in the React Native app
    // Instead, the restaurant-service.ts should make API calls to the backend
    // Return empty results to prevent errors
    return [[], []];
  }
};

export default mockPool;