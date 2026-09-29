import React, { useState, useContext, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { inspectionAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { syncOfflineData } from '../utils/offlineStorage';

const DashboardScreen = ({ navigation }) => {
  const [inspections, setInspections] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useContext(AuthContext);

  const fetchInspections = async () => {
    try {
      const { data } = await inspectionAPI.getAssigned();
      setInspections(data);
    } catch (err) {
      console.error('Failed to fetch inspections:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchInspections(), syncOfflineData()]);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchInspections();
    }, [])
  );

  const renderInspection = ({ item }) => (
    <TouchableOpacity
      style={styles.inspectionCard}
      onPress={() => navigation.navigate('InspectionDetail', { inspection: item })}
    >
      <Text style={styles.projectName}>{item.project_name}</Text>
      <View style={styles.inspectionInfo}>
        <Text style={styles.infoText}>📍 Location: {item.location || 'N/A'}</Text>
        <Text style={styles.infoText}>📅 Scheduled: {item.scheduled_date}</Text>
        <Text style={[styles.status, styles[`status_${item.status}`]]}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </Text>
        {item.ai_risk_score && (
          <Text style={styles.riskScore}>⚠️ AI Risk Score: {item.ai_risk_score}%</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome, {user?.name}</Text>
        <Text style={styles.subtitle}>Your Assigned Inspections</Text>
      </View>

      <FlatList
        data={inspections}
        renderItem={renderInspection}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No inspections assigned</Text>}
      />

      <TouchableOpacity
        style={styles.syncBtn}
        onPress={onRefresh}
      >
        <Text style={styles.syncText}>Sync Offline Data</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50' },
  subtitle: { fontSize: 14, color: '#7f8c8d', marginTop: 4 },
  list: { padding: 15 },
  inspectionCard: {
    backgroundColor: 'white', borderRadius: 12, padding: 18,
    marginBottom: 12, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1,
  },
  projectName: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', marginBottom: 8 },
  infoText: { fontSize: 14, color: '#344956', marginVertical: 2 },
  status: { fontSize: 12, fontWeight: 'bold', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, alignSelf: 'flex-start', marginTop: 6 },
  status_pending: { backgroundColor: '#fff3cd', color: '#856404' },
  status_in_progress: { backgroundColor: '#d1ecf1', color: '#0c5460' },
  status_completed: { backgroundColor: '#d4edda', color: '#155724' },
  status_flagged: { backgroundColor: '#f8d7da', color: '#721c24' },
  riskScore: { fontSize: 12, color: '#e74c3c', marginTop: 4, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, color: '#95a5a6', fontSize: 16 },
  syncBtn: { backgroundColor: '#27ae60', padding: 15, borderRadius: 10,
    alignItems: 'center', margin: 15 },
  syncText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default DashboardScreen;
