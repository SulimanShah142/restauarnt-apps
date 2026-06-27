// Local Database Service for Deliver App
// Reads data from IndexedDB (web) or SQLite (native) instead of API
// When online: syncs from Supabase, when offline: fetches from local DB
import { getDatabase } from '../db';

export const localDbService = {
  // ==================== ORDERS ====================
  orders: {
    getAll: async () => {
      try {
        const db = await getDatabase();
        const orders = await db.getOrders();
        return orders;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error getting orders:', error);
        return [];
      }
    },

    getByStatus: async (status: string) => {
      try {
        const db = await getDatabase();
        const orders = await db.getOrders(status);
        return orders;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error getting orders:', error);
        return [];
      }
    },

    getById: async (id: string) => {
      try {
        const db = await getDatabase();
        const order = await db.getOrderById(id);
        return order;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error getting order:', error);
        return null;
      }
    },

    updateStatus: async (orderId: string, status: string) => {
      try {
        const db = await getDatabase();
        const order = await db.updateOrderStatus(orderId, status);
        return order;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error updating order status:', error);
        throw error;
      }
    },
  },

  // ==================== DELIVERY ASSIGNMENTS ====================
  deliveryAssignments: {
    getAll: async () => {
      try {
        const db = await getDatabase();
        const assignments = await db.getDeliveryAssignments();
        return assignments;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error getting assignments:', error);
        return [];
      }
    },

    getByDeliveryPersonId: async (deliveryPersonId: string) => {
      try {
        const db = await getDatabase();
        const assignments = await db.getDeliveryAssignments(deliveryPersonId);
        return assignments;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error getting assignments:', error);
        return [];
      }
    },

    getById: async (id: string) => {
      try {
        const db = await getDatabase();
        const assignment = await db.getDeliveryAssignmentById(id);
        return assignment;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error getting assignment:', error);
        return null;
      }
    },

    update: async (assignmentId: string, data: any) => {
      try {
        const db = await getDatabase();
        const assignment = await db.updateDeliveryAssignment(assignmentId, data);
        return assignment;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error updating assignment:', error);
        throw error;
      }
    },
  },

  // ==================== DELIVERY PERSONS ====================
  deliveryPersons: {
    getAll: async () => {
      try {
        const db = await getDatabase();
        const persons = await db.getDeliveryPersons();
        return persons;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error getting delivery persons:', error);
        return [];
      }
    },

    getById: async (id: string) => {
      try {
        const db = await getDatabase();
        const person = await db.getDeliveryPersonById(id);
        return person;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error getting delivery person:', error);
        return null;
      }
    },

    updateLocation: async (personId: string, lat: number, lng: number) => {
      try {
        const db = await getDatabase();
        const person = await db.updateDeliveryPersonLocation(personId, lat, lng);
        return person;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error updating location:', error);
        throw error;
      }
    },
  },

  // ==================== DELIVERY STATISTICS ====================
  deliveryStatistics: {
    getAll: async () => {
      try {
        const db = await getDatabase();
        const statistics = await db.getDeliveryStatistics();
        return statistics;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error getting statistics:', error);
        return [];
      }
    },

    getByDeliveryPersonId: async (deliveryPersonId: string) => {
      try {
        const db = await getDatabase();
        const statistics = await db.getDeliveryStatistics(deliveryPersonId);
        return statistics;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error getting statistics:', error);
        return [];
      }
    },
  },

  // ==================== RESTAURANTS ====================
  restaurants: {
    getAll: async () => {
      try {
        const db = await getDatabase();
        const restaurants = await db.getRestaurants();
        return restaurants;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error getting restaurants:', error);
        return [];
      }
    },

    getById: async (id: string) => {
      try {
        const db = await getDatabase();
        const restaurant = await db.getRestaurantById(id);
        return restaurant;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error getting restaurant:', error);
        return null;
      }
    },
  },

  // ==================== NOTIFICATIONS ====================
  notifications: {
    getAll: async () => {
      try {
        const db = await getDatabase();
        const notifications = await db.getNotifications();
        return notifications;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error getting notifications:', error);
        return [];
      }
    },

    markAsRead: async (id: string) => {
      try {
        const db = await getDatabase();
        const notification = await db.markNotificationAsRead(id);
        return notification;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error marking notification as read:', error);
        throw error;
      }
    },
  },

  // ==================== LOCATION TRACKING ====================
  locationTracking: {
    add: async (data: any) => {
      try {
        const db = await getDatabase();
        const tracking = await db.addLocationTracking(data);
        return tracking;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error adding location tracking:', error);
        throw error;
      }
    },

    getHistory: async (deliveryPersonId: string, orderId: string) => {
      try {
        const db = await getDatabase();
        const history = await db.getLocationHistory(deliveryPersonId, orderId);
        return history;
      } catch (error) {
        console.error('[DeliverLocalDB] ❌ Error getting location history:', error);
        return [];
      }
    },
  },
};
