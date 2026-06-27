// Database interface types for User App

export interface DatabaseInterface {
  // Restaurants operations
  getRestaurants: () => Promise<any[]>;
  getRestaurantById: (restaurantId: string) => Promise<any>;
  getRestaurantsByCategory: (category: string) => Promise<any[]>;

  // Menu operations
  getMenuItemsByRestaurant: (restaurantId: string) => Promise<any[]>;
  getMenuCategoriesByRestaurant: (restaurantId: string) => Promise<any[]>;
  getMenuItemById: (menuId: string) => Promise<any>;

  // User/profile operations
  getUserProfile: (userId: string) => Promise<any>;
  createUserProfile: (profileData: any) => Promise<any>;

  // Cart operations
  addToCart: (cartItem: any) => Promise<any>;
  getUserCart: (userId: string) => Promise<any[]>;
  removeFromCart: (cartItemId: string) => Promise<any>;
  clearUserCart: (userId: string) => Promise<any>;

  // Favorites operations
  addToFavorites: (userId: string, restaurantId: string) => Promise<any>;
  removeFavorite: (userId: string, restaurantId: string) => Promise<any>;
  getUserFavorites: (userId: string) => Promise<any[]>;

  // Reviews operations
  addReview: (reviewData: any) => Promise<any>;
  getRestaurantReviews: (restaurantId: string) => Promise<any[]>;

  // Orders operations
  getOrders: (userId?: string) => Promise<any[]>;
  getOrderById: (orderId: string) => Promise<any>;
  createOrder: (orderData: any) => Promise<any>;
  updateOrder: (orderId: string, orderData: any) => Promise<any>;

  // Feedback operations
  getFeedbackByUserId: (userId: string) => Promise<any[]>;
  getFeedbackById: (feedbackId: string) => Promise<any>;
  saveFeedback: (feedbackData: any) => Promise<any>;

  // Sync operations
  syncWithSupabase: (userId?: string) => Promise<boolean>;

  // Generic SQL operations (for direct database manipulation)
  runAsync?: (sql: string, params?: any[]) => Promise<any>;
  getAsync?: (sql: string, params?: any[]) => Promise<any>;
  getAllAsync?: (sql: string, params?: any[]) => Promise<any[]>;
  getFirstAsync?: (sql: string, params?: any[]) => Promise<any>;

  // Close database connection
  close: () => Promise<void>;
}
