// Layout component with sidebar navigation for users-app
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { router, usePathname } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLargeDevice, setIsLargeDevice] = useState(false);
  const pathname = usePathname();

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setIsLoading(false);
    };
    loadSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      setSession(_session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const { width } = Dimensions.get('window');
    setIsLargeDevice(width > 800); // Changed to 800px threshold

    // Auto-open sidebar on large devices (PC/tablet)
    if (width > 800) {
      setSidebarOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      // Redirect to sign in if not authenticated
      // In a real app, you would use router.push('/sign-in')
    }
  }, [session]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#C41E26" />
      </View>
    );
  }

  // Navigation items
  const navItems = [
    { name: 'Menu', path: '/(tabs)/menu' },
    { name: 'Cart', path: '/(tabs)/cart' },
    { name: 'Orders', path: '/(tabs)/order' },
    { name: 'Feedback', path: '/(tabs)/feedback' },
  ];

  // Close sidebar when navigating on small devices
  const handleNavigation = (path: string) => {
    router.push(path as any);
    if (!isLargeDevice) {
      setSidebarOpen(false);
    }
  };

  return (
    <View style={styles.container}>
      Sidebar
      <View style={[
        styles.sidebar, 
        { 
          transform: [{ translateX: sidebarOpen ? 0 : -280 }],
          width: 280,
          left: isLargeDevice ? 0 : -280
        }
      ]}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>Restaurant App</Text>
          {!isLargeDevice && (
            <TouchableOpacity onPress={() => setSidebarOpen(false)}>
              <Text style={styles.closeButton}>×</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <ScrollView style={styles.navContainer}>
          {navItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.navItem,
                pathname === item.path && styles.activeNavItem
              ]}
              onPress={() => handleNavigation(item.path)}
            >
              <Text style={[
                styles.navText,
                pathname === item.path && styles.activeNavText
              ]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <View style={styles.userSection}>
          <Text style={styles.userName}>
            {session?.user?.email || 'Guest User'}
          </Text>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={() => {
              // Sign out functionality would go here
            }}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      Overlay for small devices
      {!isLargeDevice && sidebarOpen && (
        <TouchableOpacity 
          style={styles.overlay} 
          onPress={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <View style={[
        styles.mainContent,
        { marginLeft: isLargeDevice ? 280 : 0 }
      ]}>
        {/* Hamburger menu for small devices */}
        {!isLargeDevice && (
          <TouchableOpacity 
            style={styles.hamburger}
            onPress={() => setSidebarOpen(!sidebarOpen)}
          >
            <Text style={styles.hamburgerText}>☰</Text>
          </TouchableOpacity>
        )}
        
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#fff',
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  navContainer: {
    flex: 1,
    paddingTop: 10,
  },
  navItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  activeNavItem: {
    backgroundColor: '#FFECEC',
    borderLeftWidth: 4,
    borderLeftColor: '#C41E26',
  },
  navText: {
    fontSize: 16,
    color: '#333',
  },
  activeNavText: {
    fontWeight: 'bold',
    color: '#C41E26',
  },
  userSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  userName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  logoutButton: {
    backgroundColor: '#C41E26',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 50,
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  hamburger: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  hamburgerText: {
    fontSize: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MainLayout;