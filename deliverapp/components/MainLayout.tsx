// Layout component with auth and map integration for deliver-app
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSession } from '@/lib/auth-client';

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) {
      // Redirect to sign in if not authenticated
      // In a real app, you would use router.push('/sign-in')
    }
  }, [isPending, session]);

  if (isPending) {
    return (
      <View style={styles.loadingContainer}>
        Loading indicator
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {session ? (
        <>{children}</>
      ) : (
        <>{children}</>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MainLayout;