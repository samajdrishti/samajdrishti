import React, { useContext } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { AuthContext } from '../context/AuthContext';

/**
 * Renders a splash screen while the persisted session is restored, then mounts
 * exactly one navigator: the authenticated stack or the auth (login) stack.
 */
const AuthWrapper = ({ authStack, appStack }) => {
  const { restoring, isAuthenticated } = useContext(AuthContext);

  if (restoring) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Initializing Samaj Drishti...</Text>
      </View>
    );
  }

  return isAuthenticated ? appStack : authStack;
};

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 20, fontSize: 18, color: '#2c3e50' },
});

export default AuthWrapper;

