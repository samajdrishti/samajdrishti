import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Alert, Button, TextField,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { adminAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const statusColors = { pending: 'warning', in_progress: 'info', completed: 'success', flagged: 'error' };
const riskColor = (score) => (score > 70 ? 'error' : score >= 40 ? 'warning' : 'success');

const Inspections = () => {
  const [inspections, setInspections] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    adminAPI.getInspections()
      .then((res) => {
        setInspections(res.data);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.message || err.message || 'Failed to load inspections'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = inspections.filter((i) =>
    !filter ||
    String(i.project_name || '').toLowerCase().includes(filter.toLowerCase()) ||
    String(i.official_name || '').toLowerCase().includes(filter.toLowerCase()) ||
    String(i.status || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h4">Field Inspections</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Filter by project / official / status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Official</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Scheduled</TableCell>
              <TableCell>Completed</TableCell>
              <TableCell>AI Risk</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((i) => (
              <TableRow
                key={i.id}
                hover
                onClick={() => navigate(`/inspections/${i.id}`)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell sx={{ fontWeight: 600 }}>#{i.id}</TableCell>
                <TableCell>{i.project_name}</TableCell>
                <TableCell>{i.official_name || 'Unassigned'}</TableCell>
                <TableCell>
                  <Chip label={String(i.status).replace('_', ' ')} color={statusColors[i.status] || 'default'} size="small" />
                </TableCell>
                <TableCell>{i.scheduled_date}</TableCell>
                <TableCell>{i.completed_date || '-'}</TableCell>
                <TableCell>
                  {i.ai_risk_score != null
                    ? <Chip label={i.ai_risk_score} color={riskColor(i.ai_risk_score)} size="small" />
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
            {!visible.length && !loading && (
              <TableRow>
                <TableCell colSpan={7}>
                  {inspections.length ? 'No inspections match the filter.' : 'No inspections recorded yet.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="caption" color="text.secondary">
        Showing {visible.length} of {inspections.length} inspections. Click a row to open the complete inspection dossier.
      </Typography>
    </Box>
  );
};

export default Inspections;

