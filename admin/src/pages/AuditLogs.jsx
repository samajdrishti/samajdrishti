import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Alert, Button, MenuItem, TextField, Divider,
} from '@mui/material';
import { Refresh as RefreshIcon, History as TimestampIcon } from '@mui/icons-material';
import { auditAPI } from '../services/api';

const FALLBACK_LOGS = [
  { id: 1, actor_name: 'system', action: 'inspection.assigned', entity: 'inspection', entity_id: '52', meta: { official: 'Arun Kumar', project_id: 2 }, created_at: '2026-09-29T05:31:00.000Z' },
  { id: 2, actor_name: 'Arun Kumar', action: 'geo_verification.verified', entity: 'inspection', entity_id: '41', meta: { distance_meters: 36, lat: 28.8990, lng: 76.6066 }, created_at: '2026-09-29T05:12:44.000Z' },
  { id: 3, actor_name: 'system', action: 'geo_verification.suspicious', entity: 'inspection', entity_id: '9', meta: { distance_meters: 1840 }, created_at: '2026-09-29T04:58:12.000Z' },
  { id: 4, actor_name: 'Dr. Anjali Verma', action: 'atr.adjudicated', entity: 'atr', entity_id: 3, meta: { verdict: 'APPROVED_AND_CLOSED' }, created_at: '2026-09-29T04:10:03.000Z' },
  { id: 5, actor_name: 'camera-heartbeat', action: 'camera.offline', entity: 'camera', entity_id: '9', meta: { name: 'Main Gate' }, created_at: '2026-09-29T03:44:19.000Z' },
  { id: 6, actor_name: 'Arun Kumar', action: 'evidence.verified', entity: 'evidence', entity_id: '18', meta: { verdict: 'authentic' }, created_at: '2026-09-29T03:20:55.000Z' },
  { id: 7, actor_name: 'system', action: 'inspection.status_changed', entity: 'inspection', entity_id: '41', meta: { from: 'pending', to: 'in_progress' }, created_at: '2026-09-29T02:15:30.000Z' },
  { id: 8, actor_name: 'Vikram Singh', action: 'notification.sent', entity: 'notification', entity_id: '23', meta: { to: 'Amit Patel' }, created_at: '2026-09-29T01:48:12.000Z' },
];

const ENTITIES = ['All', 'inspection', 'camera', 'atr', 'evidence', 'notification', 'vc', 'checklist'];

const fmt = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const pretty = (meta) => {
  if (meta == null) return '';
  if (typeof meta === 'string') {
    try { return JSON.stringify(JSON.parse(meta)); } catch (e) { return meta; }
  }
  try { return JSON.stringify(meta); } catch (e) { return String(meta); }
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState('All');
  const [source, setSource] = useState('backend');

  const load = useCallback(() => {
    setLoading(true);
    auditAPI.list()
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : [];
        if (rows.length) {
          setLogs(rows);
          setSource('backend');
          setError('');
        } else {
          setLogs(FALLBACK_LOGS);
          setSource('fallback');
          setError('Backend has no audit rows yet — showing the demonstration seed below.');
        }
      })
      .catch((err) => {
        setLogs(FALLBACK_LOGS);
        setSource('fallback');
        setError(`${err.response?.data?.message || err.message || 'Failed to reach the API server'}. Showing demonstration seed.`);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = entity === 'All' ? logs : logs.filter((l) => String(l.entity) === entity);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4">Audit Logs</Typography>
          <Typography variant="body2" color="text.secondary">
            Append-only trail of every accountability event in the programme.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            select size="small" label="Entity" value={entity} sx={{ minWidth: 140 }}
            onChange={(e) => setEntity(e.target.value)}
          >
            {ENTITIES.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}
          </TextField>
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2, fontSize: 12.5 }}>
        <strong>Write-once, read-many.</strong> No role — including SYSADMIN — can edit or delete these records.
        {source === 'fallback' ? ' Currently displaying the demonstration seed.' : ' Streaming from the live backend audit service.'}
      </Alert>

      {error && source === 'fallback' && (
        <Alert severity="warning" sx={{ mb: 2, fontSize: 12.5 }}>{error}</Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 120 }}>ID</TableCell>
              <TableCell sx={{ minWidth: 160 }}>Timestamp</TableCell>
              <TableCell>Actor</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell>Action</TableCell>
              <TableCell sx={{ minWidth: 260 }}>Meta</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((l) => (
              <TableRow key={l.id} hover>
                <TableCell>{l.id}</TableCell>
                <TableCell>{fmt(l.created_at)}</TableCell>
                <TableCell>{l.actor_name}</TableCell>
                <TableCell>
                  <Chip
                    label={l.entity ? `${l.entity}#${l.entity_id ?? '?'}` : '—'}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: 10.5, textTransform: 'capitalize' }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11.5 }}>
                    {l.action}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>
                    {pretty(l.meta)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
            {!visible.length && (
              <TableRow>
                <TableCell colSpan={6}>No audit rows for this entity.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{ my: 2.5 }} />

      <Paper sx={{ p: 2, bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <TimestampIcon sx={{ color: '#0369a1' }} />
        <Typography variant="body2" sx={{ color: '#334155' }}>
          Every entry shown here is also referenced from within the inspection dossier and the evidence vault,
          so a single inspection\u2019s timeline can be reconstructed independently.
        </Typography>
      </Paper>
    </Box>
  );
};

export default AuditLogs;