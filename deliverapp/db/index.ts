// Database entry point for Deliver App
// Metro will automatically resolve index.native.ts or index.web.ts based on platform
// This file re-exports types, schema, and getDatabase function

// Re-export types
export type { DatabaseInterface } from './types';

// Re-export schema constants (shared between platforms)
export {
  TABLES,
  OrderSchema,
  OrderItemSchema,
  DeliveryPersonSchema,
  DeliveryAssignmentSchema,
  DeliveryStatisticSchema,
  RestaurantSchema,
  NotificationSchema,
  LocationTrackingSchema,
  UserSchema,
  ProfileSchema,
  SQLITE_SCHEMA
} from './schema';

// Re-export getDatabase - Metro will resolve to index.native.ts or index.web.ts based on platform
export { getDatabase } from './index.native';
