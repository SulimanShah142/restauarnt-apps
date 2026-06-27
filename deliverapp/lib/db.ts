// Mock database implementation to avoid TypeScript errors
// In a real application, you would use the actual mysql2 module

interface MockPool {
  query: (sql: string, params?: any[]) => Promise<[any[], any[]]>;
  execute: (sql: string, params?: any[]) => Promise<[any, any[]]>; // execute returns result object and fields array
  getConnection: () => Promise<any>;
  end: () => Promise<void>;
}

// Create a mock pool implementation
const mockPool: MockPool = {
  query: async (sql: string, params?: any[]) => {
    
    // Return mock data based on the query
    if (sql.includes('SELECT') && sql.includes('delivery_persons')) {
      if (sql.includes('WHERE id =')) {
        // Mock returning a specific delivery person
        return [[{
          id: params?.[0] || '1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1-234-567-8900',
          status: 'available',
          current_latitude: 40.7128,
          current_longitude: -74.0060,
          picture_url: 'https://example.com/john-doe.jpg',
          created_at: new Date(),
          updated_at: new Date()
        }], []]; // Return rows and fields like mysql2
      } else if (sql.includes('WHERE status = \'available\'')) {
        // Mock returning available delivery persons
        return [[{
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1-234-567-8900',
          status: 'available',
          current_latitude: 40.7128,
          current_longitude: -74.0060,
          picture_url: 'https://example.com/john-doe.jpg',
          created_at: new Date(),
          updated_at: new Date()
        }], []]; // Return rows and fields like mysql2
      } else {
        // Mock returning all delivery persons
        return [[{
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1-234-567-8900',
          status: 'available',
          current_latitude: 40.7128,
          current_longitude: -74.0060,
          picture_url: 'https://example.com/john-doe.jpg',
          created_at: new Date(),
          updated_at: new Date()
        }], []]; // Return rows and fields like mysql2
      }
    } else if (sql.includes('SELECT') && sql.includes('orders')) {
      if (sql.includes('WHERE delivery_person_id =')) {
        // Mock returning orders assigned to a delivery person
        return [[{
          id: '1',
          user_id: 'user1',
          total_amount: 25.99,
          status: 'on_the_way',
          delivery_person_id: params?.[0] || '1',
          delivery_address: '123 Main St, City, State',
          delivery_location: {
            latitude: 40.7128,
            longitude: -74.0060
          },
          restaurant_location: {
            latitude: 40.7228,
            longitude: -74.0160
          },
          created_at: new Date(),
          updated_at: new Date()
        }], []]; // Return rows and fields like mysql2
      } else {
        // Mock returning all orders
        return [[{
          id: '1',
          user_id: 'user1',
          total_amount: 25.99,
          status: 'on_the_way',
          delivery_person_id: '1',
          delivery_address: '123 Main St, City, State',
          delivery_location: {
            latitude: 40.7128,
            longitude: -74.0060
          },
          restaurant_location: {
            latitude: 40.7228,
            longitude: -74.0160
          },
          created_at: new Date(),
          updated_at: new Date()
        }], []]; // Return rows and fields like mysql2
      }
    } else {
      return [[], []]; // Return empty rows and fields
    }
  },

  execute: async (sql: string, params?: any[]) => {

    // Handle INSERT, UPDATE, DELETE operations
    if (sql.startsWith('INSERT INTO delivery_persons')) {
      // Mock inserting a delivery person
      return [{ insertId: '1', affectedRows: 1 }, []]; // Return result and fields like mysql2
    } else if (sql.startsWith('UPDATE delivery_persons')) {
      // Mock updating a delivery person
      return [{ affectedRows: 1, changedRows: 1 }, []]; // Return result and fields like mysql2
    } else if (sql.startsWith('DELETE FROM delivery_persons')) {
      // Mock deleting a delivery person
      return [{ affectedRows: 1 }, []]; // Return result and fields like mysql2
    } else if (sql.startsWith('UPDATE orders SET') && sql.includes('delivery_person_id')) {
      // Mock assigning delivery person to order
      return [{ affectedRows: 1 }, []]; // Return result and fields like mysql2
    } else if (sql.startsWith('UPDATE orders SET') && sql.includes('status')) {
      // Mock updating order status
      return [{ affectedRows: 1 }, []]; // Return result and fields like mysql2
    } else {
      // For other operations, return a generic result
      return [{ affectedRows: 0 }, []]; // Return result and fields like mysql2
    }
  },
  
  getConnection: async () => {
    return {
      query: async (sql: string, params?: any[]) => {
        return [ [], [] ]; // Return rows and fields like mysql2
      },
      execute: async (sql: string, params?: any[]) => {
        return [ [], [] ]; // Return rows and fields like mysql2
      },
      release: () => {},
    };
  },
  end: async () => {
    // No-op for mock pool
  },
};

export default mockPool;