// Sync Bridge for Deliver App - Re-exports sync-utils for compatibility
// All sync logic is now in sync-utils.ts with comprehensive incremental sync

export {
  checkNetworkStatus,
  syncProfiles,
  syncRestaurants,
  syncOrders,
  syncOrderItems,
  syncDeliveryPersons,
  syncDeliveryAssignments,
  syncNotifications,
  fullSync,
  smartSync,
  getFromLocal,
} from '../sync-utils';

// Re-export default
export { default } from '../sync-utils';
