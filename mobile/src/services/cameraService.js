import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { PermissionsAndroid, Platform } from 'react-native';

const requestCameraPermission = async () => {
  if (Platform.OS === 'ios') return true;

  try {
    const statuses = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    ]);

    // Only the camera permission is mandatory. Storage is used to keep a copy in
    // the gallery (Android < 10) so a denial must not block capture entirely.
    return statuses[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Camera permission request failed:', err);
    return false;
  }
};

export const capturePhoto = async () => {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return { error: 'Camera permission denied' };

  return new Promise((resolve) => {
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: true,
      },
      (response) => {
        if (response.didCancel) {
          resolve({ error: 'Cancelled' });
        } else if (response.errorCode) {
          resolve({ error: response.errorMessage });
        } else {
          resolve({ asset: response.assets[0] });
        }
      }
    );
  });
};

export const captureVideo = async () => {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return { error: 'Camera permission denied' };

  return new Promise((resolve) => {
    launchCamera(
      {
        mediaType: 'video',
        quality: 0.7,
        durationLimit: 60,
        saveToPhotos: true,
      },
      (response) => {
        if (response.didCancel) {
          resolve({ error: 'Cancelled' });
        } else if (response.errorCode) {
          resolve({ error: response.errorMessage });
        } else {
          resolve({ asset: response.assets[0] });
        }
      }
    );
  });
};

export const pickFromGallery = async (mediaType = 'photo') => {
  return new Promise((resolve) => {
    launchImageLibrary(
      {
        mediaType: mediaType === 'photo' ? 'photo' : 'video',
        quality: mediaType === 'photo' ? 0.8 : 0.7,
      },
      (response) => {
        if (response.didCancel) {
          resolve({ error: 'Cancelled' });
        } else if (response.errorCode) {
          resolve({ error: response.errorMessage });
        } else {
          resolve({ asset: response.assets[0] });
        }
      }
    );
  });
};
