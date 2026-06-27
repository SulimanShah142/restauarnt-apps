// Database entry point for Admins App
// Metro will automatically resolve index.native.ts or index.web.ts based on platform
// This file re-exports types, schema, and getDatabase function

// Re-export types
export type { DatabaseInterface } from './types';

// Re-export schema constants (shared between platforms)
export {
  TABLES,
  AdminSchema,
  RestaurantSchema,
  MenuItemSchema,
  MenuCategorySchema,
  OrderSchema,
  OrderItemSchema,
  FeedbackSchema,
  ReviewSchema,
  AdvertisementSchema,
  AppSettingSchema,
  SettingSchema,
  DeliveryPersonSchema,
  DeliveryAssignmentSchema,
  NotificationSchema,
  PaymentSchema,
  UserSchema,
  ProfileSchema,
  SQLITE_SCHEMA
} from './schema';

// Re-export database recreation function (web only, but safe to import on all platforms)
export { recreateDatabase } from './index.web';

// Re-export getDatabase - Metro will resolve to index.native.ts or index.web.ts based on platform
export { getDatabase } from './index.native';
