import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Alert, Button, Tooltip,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VerifiedUser as VerifiedIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { adminAPI } from '../services/api';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const formatGeo = (coords) => {
  if (!coords) return '-';
  if (typeof coords === 'string') return coords;
  const { lat, lng } = coords;
  if (lat == null || lng == null) return '-';
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
};

const formatDate = (value) => (value ? new Date(value).toLocaleString('en-IN') : '-');

const Evidence = () => {
  const [evidence, setEvidence] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminAPI.getEvidence()
      .then((res) => {
        setEvidence(res.data);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.message || err.message || 'Failed to load evidence'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const verify = async (id) => {
    try {
      await adminAPI.verifyEvidence(id);
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to verify evidence');
    }
  };

  const pending = evidence.filter((e) => !e.verified).length;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Evidence Records</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip size="small" label={`${pending} pending verification`} color={pending ? 'warning' : 'success'} />
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Inspection</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Geo-tag</TableCell>
              <TableCell>Captured</TableCell>
              <TableCell>Verified</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {evidence.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.id}</TableCell>
                <TableCell>#{e.inspection_id}</TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{e.type}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{formatGeo(e.geo_coords)}</TableCell>
                <TableCell>{formatDate(e.timestamp || e.created_at)}</TableCell>
                <TableCell>
                  <Chip label={e.verified ? 'Verified' : 'Pending'} color={e.verified ? 'success' : 'warning'} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={e.file_path ? 'Open file' : 'No file attached'}>
                    <span>
                      <IconButton
                        color="primary"
                        disabled={!e.file_path}
                        onClick={() => window.open(`${API_ORIGIN}${e.file_path}`, '_blank')}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={e.verified ? 'Already verified' : 'Mark as verified'}>
                    <span>
                      <IconButton color="success" disabled={e.verified} onClick={() => verify(e.id)}>
                        <VerifiedIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {!evidence.length && !loading && (
              <TableRow>
                <TableCell colSpan={7}>No evidence uploaded yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Evidence;

