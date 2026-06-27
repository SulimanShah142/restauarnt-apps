// Mock database implementation to avoid TypeScript errors
// In a real application, you would use the actual mysql2 module

interface MockPool {
  execute: (sql: string, params?: any[]) => Promise<any>;
}

// Create a mock pool implementation
const mockPool: MockPool = {
  execute: async (sql: string, params?: any[]) => {
    // Return mock data based on the query
    if (sql.includes('SELECT') && sql.includes('restaurants')) {
      return [[
        { id: '1', name: 'Test Restaurant', is_active: true, rating: 4.5 }
      ], []]; // Return rows and fields like mysql2
    } else if (sql.includes('SELECT') && sql.includes('users')) {
      return [[
        { id: '1', email: 'test@example.com', name: 'Test User' }
      ], []];
    } else if (sql.includes('SELECT') && sql.includes('orders')) {
      return [[
        { id: '1', order_number: 'ORD001', status: 'delivered', total_amount: 25.99 }
      ], []];
    } else {
      return [[], []]; // Return empty rows and fields
    }
  },
};

export default mockPool;