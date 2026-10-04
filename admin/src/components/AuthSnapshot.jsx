import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { monitoringAPI } from '../services/api';

/** Authenticated camera frame: fetched as a blob and rendered via an object
 *  URL, so snapshot requests carry the Bearer header instead of a ?token=. */
const AuthSnapshot = ({ cameraId, refreshKey, alt, sx }) => {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    monitoringAPI
      .snapshotBlobUrl(cameraId)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cameraId, refreshKey]);

  if (!src) return <Box sx={{ width: '100%', height: '100%', bgcolor: '#020617' }} />;
  return <Box component="img" src={src} alt={alt} sx={sx} />;
};

export default AuthSnapshot;
