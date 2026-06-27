// Sync Bridge for Admins App - Re-exports sync-utils for compatibility
// All sync logic is now in sync-utils.ts with comprehensive incremental sync

export {
  checkNetworkStatus,
  syncProfiles,
  syncAdmins,
  syncRestaurants,
  syncMenuCategories,
  syncMenuItems,
  syncOrders,
  syncOrderItems,
  syncFeedback,
  syncAppSettings,
  syncDeliveryPersons,
  syncDeliveryAssignments,
  syncWithSupabase,
  fullSync,
  smartSync,
  getFromLocal,
} from '../sync-utils';

// Re-export default
export { default } from '../sync-utils';
