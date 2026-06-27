// lib/admin-sql-service.ts
import pool from './db';

// Admin SQL Service with raw queries
export const adminSqlService = {
  // Get all restaurants
  getAllRestaurants: async () => {
    const execute = `
      SELECT
        r.id,
        r.name,
        r.description,
        r.location,
        r.address,
        r.phone,
        r.email,
        r.rating,
        r.delivery_time,
        r.delivery_fee,
        r.minimum_order,
        r.is_active,
        r.is_available,
        u.name as owner_name,
        u.email as owner_email
      FROM restaurants r
      LEFT JOIN users u ON r.owner_id = u.id
      ORDER BY r.created_at DESC
    `;
    const { rows } = await pool.execute(execute);
    return rows;
  },

  // Get restaurant by ID
  getRestaurantById: async (id: string) => {
    const execute = `
      SELECT
        r.id,
        r.name,
        r.description,
        r.location,
        r.address,
        r.phone,
        r.email,
        r.rating,
        r.delivery_time,
        r.delivery_fee,
        r.minimum_order,
        r.is_active,
        r.is_available,
        u.name as owner_name,
        u.email as owner_email
      FROM restaurants r
      LEFT JOIN users u ON r.owner_id = u.id
      WHERE r.id = $1
    `;
    const { rows } = await pool.execute(execute, [id]);
    return rows.length > 0 ? rows[0] : null;
  },

  // Update restaurant
  updateRestaurant: async (id: string, data: any) => {
    const execute = `
      UPDATE restaurants
      SET name = $1, description = $2, location = $3, address = $4,
          phone = $5, email = $6, delivery_time = $7, delivery_fee = $8,
          minimum_order = $9, is_active = $10, is_available = $11
      WHERE id = $12
    `;
    const result = await pool.execute(execute, [
      data.name,
      data.description,
      data.location,
      data.address,
      data.phone,
      data.email,
      data.deliveryTime,
      data.deliveryFee,
      data.minimumOrder,
      data.isActive,
      data.isAvailable,
      id
    ]);
    return result;
  },

  // Get all users
  getAllUsers: async () => {
    const execute = 'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC';
    const { rows } = await pool.execute(execute);
    return rows;
  },

  // Get user by ID
  getUserById: async (id: string) => {
    const execute = 'SELECT id, email, name, role, created_at FROM users WHERE id = $1';
    const { rows } = await pool.execute(execute, [id]);
    return rows.length > 0 ? rows[0] : null;
  },

  // Get all orders
  getAllOrders: async () => {
    const execute = `
      SELECT
        o.id,
        o.order_number,
        o.status,
        o.total_amount,
        o.delivery_address,
        o.created_at,
        o.updated_at,
        u.name as customer_name,
        u.email as customer_email,
        r.name as restaurant_name,
        dpu.name as delivery_person_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      LEFT JOIN users dpu ON o.delivery_person_id = dpu.id
      ORDER BY o.created_at DESC
    `;
    const { rows } = await pool.execute(execute);
    return rows;
  },

  // Get order by ID
  getOrderById: async (id: string) => {
    const execute = `
      SELECT
        o.id,
        o.order_number,
        o.status,
        o.total_amount,
        o.delivery_address,
        o.delivery_notes,
        o.payment_method,
        o.payment_status,
        o.created_at,
        o.updated_at,
        u.name as customer_name,
        u.email as customer_email,
        r.name as restaurant_name,
        dpu.name as delivery_person_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      LEFT JOIN users dpu ON o.delivery_person_id = dpu.id
      WHERE o.id = $1
    `;
    const { rows } = await pool.execute(execute, [id]);
    return rows.length > 0 ? rows[0] : null;
  },

  // Update order status
  updateOrderStatus: async (id: string, status: string) => {
    const execute = 'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2';
    const result = await pool.execute(execute, [status, id]);
    return result;
  },

  // Get all delivery persons
  getAllDeliveryPersons: async () => {
    const execute = `
      SELECT
        dp.id,
        dp.user_id,
        dp.is_available,
        dp.is_online,
        dp.rating,
        dp.vehicle_type,
        dp.license_plate,
        dp.total_deliveries,
        dp.current_location,
        u.name as person_name,
        u.email as person_email,
        u.phone as person_phone,
        p.avatar_url as profile_picture_url,
        p.full_name as profile_full_name
      FROM delivery_persons dp
      LEFT JOIN users u ON dp.user_id = u.id
      LEFT JOIN profiles p ON dp.user_id = p.id
      ORDER BY dp.created_at DESC
    `;
    const { rows } = await pool.execute(execute);
    return rows;
  },

  // Update delivery person status
  updateDeliveryPersonStatus: async (id: string, isAvailable: boolean, isOnline: boolean) => {
    const execute = 'UPDATE delivery_persons SET is_available = $1, is_online = $2, updated_at = NOW() WHERE id = $3';
    const result = await pool.execute(execute, [isAvailable, isOnline, id]);
    return result;
  },

  // Get order statistics
  getOrderStats: async () => {
    const execute = `
      SELECT
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        AVG(rating) as avg_rating
      FROM orders o
      LEFT JOIN reviews r ON o.id = r.order_id
      WHERE o.status = 'delivered'
    `;
    const { rows } = await pool.execute(execute);
    return rows.length > 0 ? rows[0] : {};
  },

  // Get restaurant performance
  getRestaurantPerformance: async (restaurantId: string) => {
    const execute = `
      SELECT
        r.name as restaurant_name,
        COUNT(o.id) as total_orders,
        SUM(o.total_amount) as total_revenue,
        AVG(rating) as avg_rating
      FROM restaurants r
      LEFT JOIN orders o ON r.id = o.restaurant_id
      LEFT JOIN reviews rev ON o.id = rev.order_id
      WHERE r.id = $1
      GROUP BY r.id
    `;
    const { rows } = await pool.execute(execute, [restaurantId]);
    return rows.length > 0 ? rows[0] : null;
  }
};

export default adminSqlService;