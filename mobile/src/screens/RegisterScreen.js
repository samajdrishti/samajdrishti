import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import { authAPI } from '../services/api';

const RegisterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', department: '',
    phone: '', role: 'official'
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleRegister = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      return Alert.alert('Error', 'Please fill in all required fields');
    }

    setLoading(true);
    try {
      const { data } = await authAPI.register(formData);
      Alert.alert('Success', 'Registration successful! Please login.', [
        { text: 'OK', onPress: () => navigation.replace('Login') },
      ]);
    } catch (err) {
      Alert.alert('Registration Failed', err.response?.data?.message || 'Server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name *"
        value={formData.name}
        onChangeText={(v) => handleChange('name', v)}
      />
      <TextInput
        style={styles.input}
        placeholder="Email *"
        value={formData.email}
        onChangeText={(v) => handleChange('email', v)}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password *"
        value={formData.password}
        onChangeText={(v) => handleChange('password', v)}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Department"
        value={formData.department}
        onChangeText={(v) => handleChange('department', v)}
      />
      <TextInput
        style={styles.input}
        placeholder="Phone"
        value={formData.phone}
        onChangeText={(v) => handleChange('phone', v)}
        keyboardType="phone-pad"
      />

      <TouchableOpacity style={styles.registerBtn} onPress={handleRegister} disabled={loading}>
        <Text style={styles.registerBtnText}>
          {loading ? 'Creating Account...' : 'Create Account'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? Sign In</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2c3e50', marginBottom: 30, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 15, fontSize: 16, marginBottom: 15,
  },
  registerBtn: { backgroundColor: '#3498db', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  registerBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  link: { color: '#3498db', textAlign: 'center', marginTop: 20, fontSize: 16 },
});

export default RegisterScreen;
