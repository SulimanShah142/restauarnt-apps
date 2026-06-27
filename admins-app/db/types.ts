// Database interface types for Admins App
// Comprehensive interface matching the implementation

export interface DatabaseInterface {
  // ==================== RESTAURANT OPERATIONS ====================
  getRestaurants: () => Promise<any[]>;
  getRestaurantById: (restaurantId: string) => Promise<any | null>;
  createRestaurant: (restaurantData: any) => Promise<any>;
  updateRestaurant: (restaurantId: string, restaurantData: any) => Promise<any>;
  deleteRestaurant: (restaurantId: string) => Promise<any>;

  // ==================== MENU OPERATIONS ====================
  getMenuItemsByRestaurant: (restaurantId: string) => Promise<any[]>;
  getMenuCategoriesByRestaurant: (restaurantId: string) => Promise<any[]>;
  createMenuItem: (menuItemData: any) => Promise<any>;
  updateMenuItem: (menuId: string, menuItemData: any) => Promise<any>;
  deleteMenuItem: (menuId: string) => Promise<any>;
  createMenuCategory: (categoryData: any) => Promise<any>;
  updateMenuCategory: (categoryId: string, categoryData: any) => Promise<any>;
  deleteMenuCategory: (categoryId: string) => Promise<any>;

  // ==================== ORDER OPERATIONS ====================
  getOrders: (restaurantId?: string) => Promise<any[]>;
  getOrderById: (orderId: string) => Promise<any | null>;
  updateOrderStatus: (orderId: string, status: string, additionalData?: any) => Promise<any>;
  updateOrder: (orderId: string, orderData: any) => Promise<any>;

  // ==================== ADMIN OPERATIONS ====================
  getAdmins: () => Promise<any[]>;
  getAdminById: (adminId: string) => Promise<any | null>;
  getAdminByUserId: (userId: string) => Promise<any | null>;
  createAdmin: (adminData: any) => Promise<any>;
  updateAdmin: (adminId: string, adminData: any) => Promise<any>;
  deleteAdmin: (adminId: string) => Promise<any>;

  // ==================== FEEDBACK OPERATIONS ====================
  getFeedback: (restaurantId?: string) => Promise<any[]>;
  createFeedback: (feedbackData: any) => Promise<any>;
  updateFeedback: (feedbackId: string, feedbackData: any) => Promise<any>;
  deleteFeedback: (feedbackId: string) => Promise<any>;

  // ==================== DELIVERY PERSON OPERATIONS ====================
  getDeliveryPersons: () => Promise<any[]>;
  getDeliveryPersonById: (id: string) => Promise<any | null>;
  createDeliveryPerson: (data: any) => Promise<any>;
  updateDeliveryPerson: (id: string, data: any) => Promise<any>;
  deleteDeliveryPerson: (id: string) => Promise<any>;

  // ==================== DELIVERY ASSIGNMENT OPERATIONS ====================
  getDeliveryAssignments: (orderId?: string) => Promise<any[]>;
  createDeliveryAssignment: (data: any) => Promise<any>;
  updateDeliveryAssignment: (id: string, data: any) => Promise<any>;
  deleteDeliveryAssignment: (id: string) => Promise<any>;

  // ==================== NOTIFICATION OPERATIONS ====================
  getNotifications: (userId?: string) => Promise<any[]>;
  createNotification: (data: any) => Promise<any>;
  markNotificationAsRead: (id: string) => Promise<any>;
  deleteNotification: (id: string) => Promise<any>;

  // ==================== APP SETTINGS OPERATIONS ====================
  getAppSettings: () => Promise<any | null>;
  updateAppSettings: (data: any) => Promise<any>;

  // ==================== SYNC OPERATIONS ====================
  syncWithSupabase: (options?: { force?: boolean }) => Promise<void>;

  // ==================== RESET & CLEAR OPERATIONS ====================
  clearAllData: () => Promise<void>;
  clearSyncTimestamps: () => Promise<void>;

  // ==================== CLOSE DATABASE ====================
  close: () => Promise<void>;

  // ==================== RAW DATABASE OPERATIONS ====================
  // Generic method to execute raw SQL queries (for advanced operations)
  getAllAsync: (sql: string, params?: any[]) => Promise<any[]>;
  getFirstAsync: (sql: string, params?: any[]) => Promise<any>;
  runAsync: (sql: string, params: any[]) => Promise<any>;

  // ==================== SYNC HELPERS (for web/IndexedDB) ====================
  // These are used by sync-utils.ts for incremental sync on web
  getSyncTimestamp?: (tableName: string) => Promise<string>;
  setSyncTimestamp?: (tableName: string) => Promise<void>;
  getDatabase?: () => Promise<any>;
}
