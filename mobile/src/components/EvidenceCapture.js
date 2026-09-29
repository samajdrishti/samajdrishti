import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { capturePhoto, captureVideo, pickFromGallery } from '../services/cameraService';
import { getCurrentLocation } from '../services/locationService';
import { evidenceAPI } from '../services/api';
import { saveOfflineData } from '../utils/offlineStorage';

const EvidenceCapture = ({ inspectionId, onEvidenceCaptured }) => {
  const [photo, setPhoto] = useState(null);
  const [location, setLocation] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    const loc = await getCurrentLocation();
    setLocation(loc);
  };

  const handleCapture = async () => {
    const result = await capturePhoto();
    if (result.asset) setPhoto(result.asset);
    if (result.error) Alert.alert('Error', result.error);
  };

  const handleVideo = async () => {
    const result = await captureVideo();
    if (result.asset) setPhoto(result.asset);
    if (result.error) Alert.alert('Error', result.error);
  };

  const handleGallery = async () => {
    const result = await pickFromGallery('photo');
    if (result.asset) setPhoto(result.asset);
    if (result.error) Alert.alert('Error', result.error);
  };

  const handleSubmit = async (type) => {
    if (!photo || !location) {
      Alert.alert('Error', 'Please capture evidence and ensure location is available');
      return;
    }

    setUploading(true);
    const evidenceData = {
      inspection_id: inspectionId,
      type,
      geo_coords: { lat: location.lat, lng: location.lng },
      timestamp: new Date().toISOString(),
      file: photo,
    };

    try {
      await evidenceAPI.upload(evidenceData);
      Alert.alert('Success', 'Evidence uploaded successfully');
      onEvidenceCaptured && onEvidenceCaptured();
      setPhoto(null);
    } catch (err) {
      await saveOfflineData('pending_evidence', evidenceData);
      Alert.alert('Offline', 'Evidence saved locally. Will sync when online.');
      onEvidenceCaptured && onEvidenceCaptured();
      setPhoto(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Capture Evidence</Text>
        {location && (
          <Text style={styles.location}>
            📍 {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </Text>
        )}
      </View>

      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.preview} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No evidence captured</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleCapture}>
          <Text style={styles.actionText}>📷 Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleVideo}>
          <Text style={styles.actionText}>🎥 Video</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleGallery}>
          <Text style={styles.actionText}>🖼️ Gallery</Text>
        </TouchableOpacity>
      </View>

      {photo && (
        <View style={styles.uploadSection}>
          <TouchableOpacity
            style={[styles.submitBtn, uploading && styles.disabledBtn]}
            onPress={() => handleSubmit('photo')}
            disabled={uploading}
          >
            <Text style={styles.submitText}>
              {uploading ? 'Uploading...' : 'Submit Evidence'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50' },
  location: { fontSize: 14, color: '#7f8c8d', marginTop: 8 },
  preview: { width: '100%', height: 250, borderRadius: 10, marginBottom: 20 },
  placeholder: {
    width: '100%', height: 250, borderRadius: 10,
    backgroundColor: '#ecf0f1', justifyContent: 'center', alignItems: 'center',
    marginBottom: 20
  },
  placeholderText: { color: '#95a5a6', fontSize: 16 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  actionBtn: { padding: 15, backgroundColor: '#3498db', borderRadius: 8 },
  actionText: { color: 'white', fontWeight: 'bold' },
  uploadSection: { marginTop: 10 },
  submitBtn: { backgroundColor: '#27ae60', padding: 18, borderRadius: 10, alignItems: 'center' },
  disabledBtn: { backgroundColor: '#95a5a6' },
  submitText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});

export default EvidenceCapture;
