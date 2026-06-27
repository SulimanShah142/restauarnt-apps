// Database interface types for Deliver App
// Comprehensive interface matching the implementation

export interface DatabaseInterface {
  // ==================== ORDER OPERATIONS ====================
  getOrders: (status?: string) => Promise<any[]>;
  getOrderById: (orderId: string) => Promise<any | null>;
  updateOrderStatus: (orderId: string, status: string, additionalData?: any) => Promise<any>;
  updateOrder: (orderId: string, orderData: any) => Promise<any>;

  // ==================== DELIVERY ASSIGNMENT OPERATIONS ====================
  getDeliveryAssignments: (deliveryPersonId?: string) => Promise<any[]>;
  getDeliveryAssignmentById: (assignmentId: string) => Promise<any | null>;
  createDeliveryAssignment: (assignmentData: any) => Promise<any>;
  updateDeliveryAssignment: (assignmentId: string, assignmentData: any) => Promise<any>;
  deleteDeliveryAssignment: (assignmentId: string) => Promise<any>;

  // ==================== DELIVERY PERSON OPERATIONS ====================
  getDeliveryPersonById: (personId: string) => Promise<any | null>;
  getDeliveryPersons: () => Promise<any[]>;
  updateDeliveryPerson: (personId: string, data: any) => Promise<any>;
  updateDeliveryPersonLocation: (personId: string, lat: number, lng: number) => Promise<any>;
  createDeliveryPerson: (data: any) => Promise<any>;

  // ==================== DELIVERY STATISTICS OPERATIONS ====================
  getDeliveryStatistics: (deliveryPersonId?: string) => Promise<any[]>;
  createDeliveryStatistic: (data: any) => Promise<any>;

  // ==================== LOCATION TRACKING OPERATIONS ====================
  addLocationTracking: (trackingData: any) => Promise<any>;
  getLocationHistory: (deliveryPersonId: string, orderId: string) => Promise<any[]>;

  // ==================== NOTIFICATION OPERATIONS ====================
  getNotifications: (userId?: string) => Promise<any[]>;
  createNotification: (data: any) => Promise<any>;
  markNotificationAsRead: (id: string) => Promise<any>;
  deleteNotification: (id: string) => Promise<any>;

  // ==================== RESTAURANT OPERATIONS ====================
  getRestaurants: () => Promise<any[]>;
  getRestaurantById: (id: string) => Promise<any | null>;

  // ==================== SYNC OPERATIONS ====================
  syncWithSupabase: (options?: { force?: boolean }) => Promise<void>;

  // ==================== CLOSE DATABASE ====================
  close: () => Promise<void>;

  // ==================== GENERIC DATABASE OPERATIONS ====================
  runAsync: (sql: string, params?: any[]) => Promise<any>;
  getAsync: (sql: string, params?: any[]) => Promise<any>;
  getAllAsync: (sql: string, params?: any[]) => Promise<any[]>;
}
