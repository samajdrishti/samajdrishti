import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { authAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Error', 'Please enter email and password');

    setLoading(true);
    try {
      const { data } = await authAPI.login(email.trim(), password);
      // AuthContext persists the session to AsyncStorage for offline reuse.
      await login(data.user, data.token);
    } catch (err) {
      Alert.alert(
        'Login Failed',
        err.response?.data?.message ||
          'Cannot reach the Samaj Drishti API. Check the server address in src/services/api.js.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>🏛️ Samaj Drishti</Text>
        <Text style={styles.subtitle}>AI-Powered Inspection System</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
          <Text style={styles.loginText}>{loading ? 'Signing In...' : 'Sign In'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.link}>Don't have an account? Register</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 30 },
  header: { alignItems: 'center', marginTop: 60, marginBottom: 40 },
  logo: { fontSize: 32, fontWeight: 'bold', color: '#2c3e50' },
  subtitle: { fontSize: 16, color: '#7f8c8d', marginTop: 10 },
  form: { flex: 1 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 15, fontSize: 16, marginBottom: 15,
  },
  loginBtn: {
    backgroundColor: '#3498db', padding: 18, borderRadius: 10,
    alignItems: 'center', marginTop: 10,
  },
  loginText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  link: { color: '#3498db', textAlign: 'center', marginTop: 20, fontSize: 16 },
});

export default LoginScreen;
