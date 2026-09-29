import AsyncStorage from '@react-native-async-storage/async-storage';
import { evidenceAPI, inspectionAPI } from '../services/api';

export const saveOfflineData = async (key, data) => {
  try {
    const existing = await AsyncStorage.getItem(key);
    const existingData = existing ? JSON.parse(existing) : [];
    const newData = [...existingData, ...(Array.isArray(data) ? data : [data])];
    await AsyncStorage.setItem(key, JSON.stringify(newData));
  } catch (err) {
    console.error('Failed to save offline data:', err);
  }
};

export const getOfflineData = async (key) => {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Failed to get offline data:', err);
    return [];
  }
};

export const clearOfflineData = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.error('Failed to clear offline data:', err);
  }
};

export const syncOfflineData = async () => {
  const pendingEvidence = await getOfflineData('pending_evidence');
  const pendingInspections = await getOfflineData('pending_inspections');

  const results = {
    evidence: { synced: 0, failed: 0 },
    inspections: { synced: 0, failed: 0 },
  };

  const failedEvidence = [];
  for (const item of pendingEvidence) {
    try {
      await evidenceAPI.upload(item);
      results.evidence.synced++;
    } catch (err) {
      results.evidence.failed++;
      failedEvidence.push(item);
    }
  }

  const failedInspections = [];
  for (const item of pendingInspections) {
    try {
      await inspectionAPI.updateStatus(item.id, item.data);
      results.inspections.synced++;
    } catch (err) {
      results.inspections.failed++;
      failedInspections.push(item);
    }
  }

  // Only the successfully synced items are dropped - previously the whole queue
  // was cleared as soon as a single upload succeeded, losing pending work.
  if (results.evidence.synced > 0) {
    if (failedEvidence.length) {
      await AsyncStorage.setItem('pending_evidence', JSON.stringify(failedEvidence));
    } else {
      await clearOfflineData('pending_evidence');
    }
  }

  if (results.inspections.synced > 0) {
    if (failedInspections.length) {
      await AsyncStorage.setItem('pending_inspections', JSON.stringify(failedInspections));
    } else {
      await clearOfflineData('pending_inspections');
    }
  }

  return results;
};
