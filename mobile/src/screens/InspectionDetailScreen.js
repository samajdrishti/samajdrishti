import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import EvidenceCapture from '../components/EvidenceCapture';
import { inspectionAPI } from '../services/api';

const InspectionDetailScreen = ({ navigation, route }) => {
  const { inspection } = route.params;
  const [status, setStatus] = useState(inspection.status);

  const updateStatus = async (newStatus) => {
    try {
      await inspectionAPI.updateStatus(inspection.id, {
        status: newStatus,
        notes: '',
        completed_date: new Date().toISOString(),
      });
      setStatus(newStatus);
      Alert.alert('Success', `Inspection status updated to ${newStatus}`);
    } catch (err) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleStart = () => {
    Alert.alert('Start Inspection', 'Mark this inspection as in progress?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start', onPress: () => updateStatus('in_progress') },
    ]);
  };

  const handleComplete = () => {
    Alert.alert('Complete Inspection', 'Mark this inspection as completed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: () => updateStatus('completed') },
    ]);
  };

  const handleFlag = () => {
    Alert.alert('Flag Inspection', 'Flag this inspection for review?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Flag',
        onPress: () => updateStatus('flagged'),
        style: 'destructive',
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.details}>
        <Text style={styles.projectName}>{inspection.project_name}</Text>
        <Text style={styles.location}>📍 {inspection.location}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Scheduled:</Text>
          <Text style={styles.value}>{inspection.scheduled_date}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Status:</Text>
          <Text style={styles.value}>{status}</Text>
        </View>
        {inspection.ai_risk_score && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>AI Risk Score:</Text>
            <Text style={[styles.value, styles.riskText]}>{inspection.ai_risk_score}%</Text>
          </View>
        )}
      </View>

      {status === 'pending' && (
        <TouchableOpacity style={styles.primaryBtn} onPress={handleStart}>
          <Text style={styles.primaryBtnText}>Start Inspection</Text>
        </TouchableOpacity>
      )}

      {status === 'in_progress' && (
        <>
          <EvidenceCapture
            inspectionId={inspection.id}
            onEvidenceCaptured={() => navigation.goBack()}
          />
          <TouchableOpacity style={styles.completeBtn} onPress={handleComplete}>
            <Text style={styles.completeBtnText}>Complete Inspection</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.flagBtn} onPress={handleFlag} disabled={status === 'completed'}>
        <Text style={styles.flagBtnText}>🚩 Flag for Review</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  details: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginBottom: 20 },
  projectName: { fontSize: 22, fontWeight: 'bold', color: '#2c3e50', marginBottom: 8 },
  location: { fontSize: 16, color: '#7f8c8d', marginBottom: 12 },
  infoRow: { flexDirection: 'row', marginVertical: 5 },
  label: { fontWeight: 'bold', color: '#344956', width: 120 },
  value: { color: '#2c3e50', flex: 1 },
  riskText: { color: '#e74c3c', fontWeight: 'bold' },
  primaryBtn: { backgroundColor: '#3498db', padding: 18, borderRadius: 10, alignItems: 'center', marginBottom: 15 },
  primaryBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  completeBtn: { backgroundColor: '#27ae60', padding: 18, borderRadius: 10, alignItems: 'center', marginVertical: 15 },
  completeBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  flagBtn: { backgroundColor: '#fff3cd', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  flagBtnText: { color: '#856404', fontWeight: 'bold', fontSize: 16 },
});

export default InspectionDetailScreen;
