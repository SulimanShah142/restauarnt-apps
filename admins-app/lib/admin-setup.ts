/**
 * Admin Setup Service
 * This service handles initial setup for admin users
 */

export class AdminSetupService {
  /**
   * Ensures the admin user exists in the system
   * This should be called during app initialization or when an admin logs in
   */
  async ensureAdminUserExists(email: string, name: string = 'Admin User'): Promise<boolean> {
    // In the custom auth system, we don't need to ensure the user exists in a database
    // since authentication is handled by checking hardcoded credentials
    // This method can be considered successful if the email matches the admin email
    return email === 'slliman.sarwary08@gmail.com';
  }

  /**
   * Creates an admin user in the system
   * This should be called when setting up the admin account
   */
  async createAdminUser(email: string, name: string = 'Admin User'): Promise<boolean> {
    // In the custom auth system, we don't create users dynamically
    // since authentication is handled by checking hardcoded credentials
    // This method can be considered successful if the email matches the admin email
    return email === 'slliman.sarwary08@gmail.com';
  }
}

// Create a singleton instance of the AdminSetupService
export const adminSetupService = new AdminSetupService();