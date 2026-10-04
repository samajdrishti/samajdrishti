import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Alert, Button, Tooltip,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VerifiedUser as VerifiedIcon,
  Fingerprint as FingerprintIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { adminAPI, evidenceAPI } from '../services/api';

const formatGeo = (coords) => {
  if (!coords) return '-';
  if (typeof coords === 'string') return coords;
  const { lat, lng } = coords;
  if (lat == null || lng == null) return '-';
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
};

const formatDate = (value) => (value ? new Date(value).toLocaleString('en-IN') : '-');

const INTEGRITY = {
  verified: { label: 'INTEGRITY OK', color: 'success' },
  tampered: { label: 'TAMPERED', color: 'error' },
  missing_file: { label: 'FILE MISSING', color: 'warning' },
  unverified: { label: 'NOT CHECKED', color: 'default' },
  hashed: { label: 'HASHED', color: 'info' },
};

const shortHash = (hash) => (hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : '—');

const Evidence = () => {
  const [evidence, setEvidence] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // Live integrity verdicts, keyed by evidence id (filled on demand).
  const [verdicts, setVerdicts] = useState({});
  const [busy, setBusy] = useState(null);

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

  /** Re-hashes the stored file on the server (read-only, changes nothing). */
  const recheck = async (id) => {
    setBusy(id);
    try {
      const res = await adminAPI.checkEvidenceIntegrity(id);
      setVerdicts((current) => ({ ...current, [id]: res.data.integrity }));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Integrity check failed');
    } finally {
      setBusy(null);
    }
  };

  const recheckAll = async () => {
    const hashed = evidence.filter((e) => hashOf(e));
    if (!hashed.length) return;
    setBusy('all');
    try {
      const results = await Promise.all(
        hashed.map((e) => adminAPI.checkEvidenceIntegrity(e.id).catch(() => null))
      );
      const next = {};
      results.forEach((res, idx) => {
        if (res?.data?.integrity) next[hashed[idx].id] = res.data.integrity;
      });
      setVerdicts(next);
    } finally {
      setBusy(null);
    }
  };

  /** Back-office sign-off: the server re-hashes and refuses tampered files. */
  const verify = async (id) => {
    setBusy(id);
    try {
      const res = await adminAPI.verifyEvidence(id);
      setVerdicts((current) => ({ ...current, [id]: res.data.integrity }));
      if (res.data.integrity?.status === 'tampered') {
        setError(`Evidence #${id} FAILED the integrity check and was not verified.`);
      }
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to verify evidence');
    } finally {
      setBusy(null);
    }
  };

  const hashOf = (item) => item?.sha256_hash || item?.file_hash;
  const statusOf = (item) =>
    verdicts[item.id]?.status ||
    item.integrity_status ||
    (item.verified && hashOf(item) ? 'verified' : hashOf(item) ? 'hashed' : 'unverified');
  const pending = evidence.filter((e) => !e.verified).length;
  const tampered = evidence.filter((e) => statusOf(e) === 'tampered').length;
  const intact = evidence.filter((e) => statusOf(e) === 'verified').length;
  const unhashed = evidence.filter((e) => !hashOf(e)).length;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Evidence Records</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip size="small" label={`${intact} integrity OK`} color={intact ? 'success' : 'default'} variant="outlined" />
          <Chip size="small" label={`${tampered} tampered`} color={tampered ? 'error' : 'default'} variant="outlined" />
          <Chip size="small" label={`${unhashed} pre-chain`} variant="outlined" />
          <Chip size="small" label={`${pending} pending sign-off`} color={pending ? 'warning' : 'success'} />
          <Button
            size="small"
            variant="outlined"
            startIcon={<FingerprintIcon />}
            onClick={recheckAll}
            disabled={busy === 'all'}
          >
            {busy === 'all' ? 'Re-hashing…' : 'Re-check integrity'}
          </Button>
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
              <TableCell>SHA-256</TableCell>
              <TableCell>Integrity</TableCell>
              <TableCell>Sign-off</TableCell>
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
                  <Tooltip title={hashOf(e) || 'No hash recorded (uploaded before the chain existed)'}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11.5, color: hashOf(e) ? '#334155' : '#94a3b8' }}>
                      {shortHash(hashOf(e))}
                    </span>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Tooltip title={verdicts[e.id]?.explanation || 'Hash taken when the officer uploaded this file'}>
                    <span>
                      <Chip
                        label={INTEGRITY[statusOf(e)]?.label || String(statusOf(e))}
                        color={INTEGRITY[statusOf(e)]?.color || 'default'}
                        size="small"
                        variant={statusOf(e) === 'tampered' ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 700, fontSize: 10.5 }}
                      />
                    </span>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Chip label={e.verified ? 'Signed off' : 'Pending'} color={e.verified ? 'success' : 'warning'} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={e.file_path ? 'Open file' : 'No file attached'}>
                    <span>
                      <IconButton
                        color="primary"
                        disabled={!e.file_path}
                        onClick={() => evidenceAPI.openFile(e.file_path)}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Re-hash the stored file on the server">
                    <span>
                      <IconButton color="info" disabled={!hashOf(e) || busy === e.id} onClick={() => recheck(e.id)}>
                        <FingerprintIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={e.verified ? 'Already signed off' : 'Verify integrity and sign off'}>
                    <span>
                      <IconButton color="success" disabled={e.verified || busy === e.id} onClick={() => verify(e.id)}>
                        <VerifiedIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {!evidence.length && !loading && (
              <TableRow>
                <TableCell colSpan={9}>No evidence uploaded yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Evidence;

