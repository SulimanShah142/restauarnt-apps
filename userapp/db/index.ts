// Database entry point for User App
// Metro will automatically resolve index.native.ts or index.web.ts based on platform
// This file re-exports types and schema only

// Re-export types
export type { DatabaseInterface } from './types';

// Re-export schema constants (shared between platforms)
export {
  TABLES,
  OrderSchema,
  RestaurantSchema,
  MenuItemSchema,
  MenuCategorySchema,
  ProfileSchema,
  CartSchema,
  ReviewSchema,
  AddressSchema,
  OrderItemSchema,
  CartItemSchema,
  SQLITE_SCHEMA
} from './schema';

// Re-export getDatabase from platform-specific implementation
// Metro automatically resolves index.native.ts (mobile) or index.web.ts (web)
export { getDatabase } from './index.native';
